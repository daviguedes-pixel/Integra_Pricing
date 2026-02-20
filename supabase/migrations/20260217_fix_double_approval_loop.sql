-- Migration: Fix Double Approval Loop (Auto-advance if same approver)
-- 
-- Fixes the issue where a user with multiple approval roles/levels has to approve the same request multiple times.
-- Implements a loop in approve_price_request to checking if the "next approver" is the current user,
-- and if so, auto-advances the approval level.

CREATE OR REPLACE FUNCTION public.approve_price_request(
    p_request_id uuid,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_permissions public.profile_permissions;
    v_approver_name text;
    v_current_level integer;
    v_can_finalize boolean;
    v_next_approver json;
    v_loop_safety integer := 0;
BEGIN
    v_user_id := auth.uid();

    -- 1. Initial Validation (only once)
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    -- ALLOW 'pending' OR 'appealed'
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    -- FIX: Look up permissions by PROFILE (perfil) to be safe, or ID. Using PERFIL as verified before.
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    
    -- LOOP to handle multi-level approval
    LOOP
        v_loop_safety := v_loop_safety + 1;
        IF v_loop_safety > 20 THEN RAISE EXCEPTION 'Approval loop exceeded safety limit'; END IF;

        -- Reload request data to get current level
        SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
        v_current_level := COALESCE(v_request.approval_level, 1);

        -- Audit Trail for THIS level
        -- Only insert if we haven't already for this level/action in this transaction? 
        -- Actually, we want to record that we approved THIS level.
        -- If we loop, we do it again for the next level.
        INSERT INTO public.approval_history (
            suggestion_id, approver_id, approver_name, action, approval_level, observations
        ) VALUES (
            p_request_id, v_user_id, v_approver_name, 'approved', v_current_level, p_observations
        );

        -- 4. Check if this profile can finalize (has margin authority)
        -- Note: We check against the CURRENT user's profile.
        -- If I am 'SuperUser' and I can finalize, I finalize immediately.
        v_can_finalize := public._can_profile_finalize(v_profile.perfil, v_request.margin_cents);

        IF v_can_finalize THEN
            -- FINAL APPROVAL
            UPDATE public.price_suggestions
            SET status = 'approved',
                approved_by = v_user_id,
                approved_at = now(),
                current_approver_id = v_user_id,
                current_approver_name = v_approver_name,
                approvals_count = COALESCE(approvals_count, 0) + 1,
                last_approver_action_by = v_user_id,
                last_observation = p_observations
            WHERE id = p_request_id;

            -- Notify Requester
            IF v_request.created_by IS NOT NULL THEN
                INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
                VALUES (
                    public._resolve_user_id(v_request.created_by),
                    'Solicitação Aprovada ✅',
                    'Sua solicitação foi aprovada por ' || v_approver_name,
                    'request_approved',
                    p_request_id,
                    false
                );
            END IF;

            RETURN json_build_object('success', true, 'status', 'approved');
        ELSE
            -- ESCALATE to next approver
            v_next_approver := public._find_next_approver(
                p_request_id, v_request.created_by, v_current_level, v_request.margin_cents
            );

            IF (v_next_approver->>'found')::boolean THEN
                -- CHECK IF NEXT APPROVER IS ME
                IF (v_next_approver->>'user_id')::uuid = v_user_id THEN
                    -- IT IS ME! Auto-advance level and LOOP.
                    
                    -- Update request to the next level so the loop sees it
                    UPDATE public.price_suggestions
                    SET approval_level = (v_next_approver->>'level')::integer,
                        approvals_count = COALESCE(approvals_count, 0) + 1
                    WHERE id = p_request_id;
                    
                    -- Continue loop (which logs history for new level and checks finalize again)
                    CONTINUE;
                ELSE
                    -- HANDOFF to someone else
                    UPDATE public.price_suggestions
                    SET approval_level = (v_next_approver->>'level')::integer,
                        current_approver_id = (v_next_approver->>'user_id')::uuid,
                        current_approver_name = v_next_approver->>'user_name',
                        approvals_count = COALESCE(approvals_count, 0) + 1,
                        last_approver_action_by = v_user_id,
                        last_observation = p_observations,
                        status = 'pending' -- ensure it stays pending
                    WHERE id = p_request_id;

                    -- Notify next approver
                    INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
                    VALUES (
                        (v_next_approver->>'user_id')::uuid,
                        'Nova Aprovação Pendente',
                        'Solicitação aguardando sua aprovação (Nível ' || (v_next_approver->>'level') || ')',
                        'approval_pending',
                        p_request_id,
                        false
                    );

                    RETURN json_build_object('success', true, 'status', 'pending', 'nextLevel', (v_next_approver->>'level')::integer);
                END IF;
            ELSE
                -- No one else in chain → final approval by current user
                -- (Even if I couldn't finalize by margin, if no one else is there, I am the final word)
                UPDATE public.price_suggestions
                SET status = 'approved',
                    approved_by = v_user_id,
                    approved_at = now(),
                    current_approver_id = v_user_id,
                    current_approver_name = v_approver_name,
                    approvals_count = COALESCE(approvals_count, 0) + 1,
                    last_approver_action_by = v_user_id,
                    last_observation = p_observations
                WHERE id = p_request_id;

                IF v_request.created_by IS NOT NULL THEN
                    INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
                    VALUES (
                        public._resolve_user_id(v_request.created_by),
                        'Solicitação Aprovada ✅',
                        'Sua solicitação foi aprovada por ' || v_approver_name,
                        'request_approved',
                        p_request_id,
                        false
                    );
                END IF;

                RETURN json_build_object('success', true, 'status', 'approved');
            END IF;
        END IF;
    END LOOP;
END;
$$;
