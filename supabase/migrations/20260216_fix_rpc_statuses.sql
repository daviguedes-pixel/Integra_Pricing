-- Migration: Fix RPCs, Permissions, Constraints, Missing Columns AND Helper Functions
-- CORRECTION 1: profile_permissions is unique per ROLE (perfil).
-- CORRECTION 2: approval_history constraint needs to allow new actions.
-- CORRECTION 3: price_suggestions needs 'arla_price' column.
-- CORRECTION 4: Helper function _resolve_user_id is missing.

-- ============================================================================
-- 0. ADD MISSING COLUMNS
-- ============================================================================
DO $$
BEGIN
    -- Add arla_price if it doesn't exist, OR alter it if it does (to ensure correct type)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'arla_price') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN arla_price NUMERIC(10,4);
    ELSE
        -- Ensure it is NUMERIC(10,4) if it already exists (fixing previous integer creation)
        ALTER TABLE public.price_suggestions ALTER COLUMN arla_price TYPE NUMERIC(10,4);
    END IF;

    -- Add final_price (which was previously renamed to cost_price, but we are re-adding it effectively as the approved price?)
    -- Actually, if this is intended to track the FINAL AGREED price separate from cost, it should be NUMERIC.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'final_price') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN final_price NUMERIC(10,4);
    ELSE
        ALTER TABLE public.price_suggestions ALTER COLUMN final_price TYPE NUMERIC(10,4);
    END IF;
    -- Add last_observation column to price_suggestions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'last_observation') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN last_observation TEXT;
    END IF;

    -- Add evidence_url column to price_suggestions if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'evidence_url') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN evidence_url TEXT;
    END IF;
END $$;

-- ============================================================================
-- 0.1. HELPER FUNCTIONS
-- ============================================================================

-- Function to safely resolve a user ID from text (UUID string or Email/Name)
CREATE OR REPLACE FUNCTION public._resolve_user_id(p_identifier text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- 1. Try casting to UUID if it looks like one
    IF p_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN p_identifier::uuid;
    END IF;

    -- 2. Try looking up by email or name in user_profiles
    SELECT user_id INTO v_user_id 
    FROM public.user_profiles 
    WHERE email = p_identifier OR nome = p_identifier 
    LIMIT 1;

    RETURN v_user_id;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Overload for UUID input (just returns itself) - Handles the error case where input is already UUID
CREATE OR REPLACE FUNCTION public._resolve_user_id(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN p_id;
END;
$$;


-- ============================================================================
-- 1. FIX APPROVAL HISTORY CONSTRAINT
-- ============================================================================
DO $$
BEGIN
    -- Drop the restrictive check constraint
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_history_action_check') THEN
        ALTER TABLE public.approval_history DROP CONSTRAINT approval_history_action_check;
    END IF;

    -- Add the new, expanded check constraint
    ALTER TABLE public.approval_history 
    ADD CONSTRAINT approval_history_action_check 
    CHECK (action IN ('approved', 'rejected', 'price_suggested', 'request_justification', 'request_evidence', 'appealed', 'justification_provided', 'evidence_provided', 'accepted_suggestion'));
    
    -- Ensure status column length in price_suggestions is sufficient (if it was limited)
    -- usually text or varchar(255), so likely fine.
END $$;


-- ============================================================================
-- 2. ENSURE ROLE PERMISSIONS EXIST
-- ============================================================================
DO $$
DECLARE
    r text;
BEGIN
    -- Define the approval roles
    FOREACH r IN ARRAY ARRAY['analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing', 'admin', 'gerente']
    LOOP
        -- Upsert permission configuration for the role
        INSERT INTO public.profile_permissions (perfil, can_approve, created_at, updated_at)
        VALUES (r, true, now(), now())
        ON CONFLICT (perfil) DO UPDATE
        SET can_approve = true,
            updated_at = now();
    END LOOP;
    
    -- Ensure admin keys are set
    UPDATE public.profile_permissions
    SET 
      tax_management = true,
      station_management = true,
      client_management = true,
      audit_logs = true,
      settings = true,
      gestao = true,
      approval_margin_config = true,
      gestao_stations = true,
      gestao_clients = true,
      gestao_payment_methods = true
    WHERE perfil = 'admin';

END $$;


-- ============================================================================
-- 3. APPROVE PRICE REQUEST
-- ============================================================================
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
BEGIN
    v_user_id := auth.uid();

    -- 1. Fetch & Validate
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    -- ALLOW 'pending' OR 'appealed'
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    
    -- FIX: Look up permissions by PROFILE (perfil)
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'approved', v_current_level, p_observations
    );

    -- 4. Check if this profile can finalize (has margin authority)
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
            last_observation = p_observations -- Save observation
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
            UPDATE public.price_suggestions
            SET approval_level = (v_next_approver->>'level')::integer,
                current_approver_id = (v_next_approver->>'user_id')::uuid,
                current_approver_name = v_next_approver->>'user_name',
                approvals_count = COALESCE(approvals_count, 0) + 1,
                last_approver_action_by = v_user_id,
                last_observation = p_observations -- Save observation
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
        ELSE
            -- No one else in chain → final approval by current user
            UPDATE public.price_suggestions
            SET status = 'approved',
                approved_by = v_user_id,
                approved_at = now(),
                current_approver_id = v_user_id,
                current_approver_name = v_approver_name,
                approvals_count = COALESCE(approvals_count, 0) + 1,
                last_approver_action_by = v_user_id,
                last_observation = p_observations -- Save observation
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
END;
$$;


-- ============================================================================
-- 4. REJECT PRICE REQUEST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_price_request(
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
    v_next_approver json;
BEGIN
    v_user_id := auth.uid();

    -- 1. Fetch & Validate
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    -- ALLOW 'pending' OR 'appealed'
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    
    -- FIX: Look up permissions by PROFILE (perfil)
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'rejected', v_current_level, p_observations
    );

    -- 4. ALWAYS try to escalate
    v_next_approver := public._find_next_approver(
        p_request_id, v_request.created_by, v_current_level, v_request.margin_cents
    );

    IF (v_next_approver->>'found')::boolean THEN
        -- Escalate to next approver
        UPDATE public.price_suggestions
        SET status = 'pending',
            approval_level = (v_next_approver->>'level')::integer,
            current_approver_id = (v_next_approver->>'user_id')::uuid,
            current_approver_name = v_next_approver->>'user_name',
            rejections_count = COALESCE(rejections_count, 0) + 1,
            last_approver_action_by = v_user_id,
            rejection_reason = p_observations, -- Keep rejection reason in its specific column
            last_observation = p_observations -- AND in last_observation for consistency
        WHERE id = p_request_id;

        -- Notify next approver
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            (v_next_approver->>'user_id')::uuid,
            'Solicitação Escalada para Revisão',
            'Uma solicitação foi rejeitada por ' || v_approver_name || ' e escalada para sua revisão',
            'approval_pending',
            p_request_id,
            false
        );

        RETURN json_build_object('success', true, 'status', 'pending', 'action', 'escalated', 'nextLevel', (v_next_approver->>'level')::integer);
    ELSE
        -- No one else in chain → final rejection
        UPDATE public.price_suggestions
        SET status = 'rejected',
            approved_by = v_user_id,
            approved_at = now(),
            current_approver_id = NULL,
            current_approver_name = NULL,
            rejections_count = COALESCE(rejections_count, 0) + 1,
            last_approver_action_by = v_user_id,
            rejection_reason = p_observations,
            last_observation = p_observations
        WHERE id = p_request_id;

        -- Notify Requester
        IF v_request.created_by IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (
                public._resolve_user_id(v_request.created_by),
                'Solicitação Rejeitada ❌',
                'Sua solicitação foi rejeitada por ' || v_approver_name,
                'price_rejected',
                p_request_id,
                false
            );
        END IF;

        RETURN json_build_object('success', true, 'status', 'rejected', 'action', 'terminated');
    END IF;
END;
$$;


-- ============================================================================
-- 5. SUGGEST PRICE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.suggest_price_request(
    p_request_id uuid,
    p_suggested_price numeric,
    p_observations text DEFAULT NULL,
    p_arla_price numeric DEFAULT NULL
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
    -- v_price_val and v_arla_val used to be cents/integers, now keeping native numeric
    v_price_val numeric; 
    v_arla_val numeric;
    v_new_margin_cents integer;
BEGIN
    v_user_id := auth.uid();

    -- 1. Fetch & Validate
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    -- ALLOW 'pending' OR 'appealed'
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    IF p_suggested_price IS NULL OR p_suggested_price <= 0 THEN
        RAISE EXCEPTION 'Suggested price must be greater than 0';
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    
    -- FIX: Look up permissions by PROFILE (perfil)
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);
    
    -- FIX: Do not multiply by 100. Store as raw numeric to match column type (NUMERIC).
    v_price_val := p_suggested_price;
    v_arla_val := p_arla_price;

    -- FIX: Calculate new margin (Price - Cost) * 100
    -- Assuming cost_price is the column holding the cost.
    v_new_margin_cents := ((p_suggested_price - COALESCE(v_request.cost_price, 0)) * 100)::integer;

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'price_suggested',
        v_current_level,
        COALESCE(p_observations, '') || ' | Preço sugerido: R$ ' || p_suggested_price::text
    );

    -- 4. Update request
    UPDATE public.price_suggestions
    SET status = 'price_suggested',
        suggested_price = v_price_val,
        final_price = v_price_val, -- Assuming final_price is also NUMERIC now
        arla_price = COALESCE(v_arla_val, arla_price),
        margin_cents = v_new_margin_cents,
        current_approver_id = v_user_id,
        current_approver_name = v_approver_name,
        last_approver_action_by = v_user_id,
        last_observation = p_observations -- Save observation
    WHERE id = p_request_id;

    -- 5. Notify Requester
    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            public._resolve_user_id(v_request.created_by),
            'Preço Sugerido 💰',
            v_approver_name || ' sugeriu um novo preço para sua solicitação. Aceite ou recorra.',
            'price_suggested',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'price_suggested', 'suggestedPrice', p_suggested_price);
END;
$$;


-- ============================================================================
-- 6. REQUEST JUSTIFICATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_justification(
    p_request_id uuid,
    p_observations text
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
BEGIN
    v_user_id := auth.uid();

    -- 1. Validate
    IF p_observations IS NULL OR trim(p_observations) = '' THEN
        RAISE EXCEPTION 'Observations are required when requesting justification';
    END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    -- ALLOW 'pending' OR 'appealed'
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;

    -- FIX: Look up permissions by PROFILE (perfil)
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'request_justification',
        v_current_level, p_observations
    );

    -- 4. Update request
    UPDATE public.price_suggestions
    SET status = 'awaiting_justification',
        last_approver_action_by = v_user_id,
        last_observation = p_observations -- Save observation
    WHERE id = p_request_id;

    -- 5. Notify Requester
    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            public._resolve_user_id(v_request.created_by),
            'Justificativa Solicitada 📝',
            v_approver_name || ' solicitou uma justificativa para sua solicitação de preço.',
            'justification_requested',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'awaiting_justification');
END;
$$;


-- ============================================================================
-- 7. REQUEST EVIDENCE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_evidence(
    p_request_id uuid,
    p_product text,
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
BEGIN
    v_user_id := auth.uid();

    -- 1. Validate
    IF p_product NOT IN ('principal', 'arla') THEN
        RAISE EXCEPTION 'Product must be "principal" or "arla"';
    END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    -- ALLOW 'pending' OR 'appealed'
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;

    -- FIX: Look up permissions by PROFILE (perfil)
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'request_evidence',
        v_current_level,
        COALESCE(p_observations, '') || ' | Produto: ' || p_product
    );

    -- 4. Update request
    UPDATE public.price_suggestions
    SET status = 'awaiting_evidence',
        evidence_product = p_product,
        last_approver_action_by = v_user_id,
        last_observation = p_observations -- Save observation
    WHERE id = p_request_id;

    -- 5. Notify Requester
    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            public._resolve_user_id(v_request.created_by),
            'Referência Solicitada 📎',
            v_approver_name || ' solicitou uma referência de preço (' || 
            CASE WHEN p_product = 'principal' THEN 'Produto Principal' ELSE 'ARLA' END || ').',
            'evidence_requested',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'awaiting_evidence', 'evidenceProduct', p_product);
END;
$$;



-- ============================================================================
-- 8. PROVIDE JUSTIFICATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provide_justification(
    p_request_id uuid,
    p_justification text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
    v_approver_name text;
BEGIN
    v_user_id := auth.uid();

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    
    -- VALIDATION: Must be actionable
    IF v_request.status NOT IN ('awaiting_justification') THEN
        RAISE EXCEPTION 'Request is not awaiting justification';
    END IF;

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, 'Solicitante (Resposta)', 'justification_provided',
        v_request.approval_level, p_justification
    );

    -- 4. Update request -> BACK TO PENDING
    UPDATE public.price_suggestions
    SET status = 'pending',
        last_observation = p_justification -- Save observation
    WHERE id = p_request_id;

    -- 5. Notify Current Approver
    IF v_request.current_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            v_request.current_approver_id,
            'Justificativa Fornecida 💬',
            'O solicitante forneceu a justificativa solicitada.',
            'justification_provided',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;


-- ============================================================================
-- 9. PROVIDE EVIDENCE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provide_evidence(
    p_request_id uuid,
    p_attachment_url text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
BEGIN
    v_user_id := auth.uid();

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

    -- VALIDATION
    IF v_request.status NOT IN ('awaiting_evidence') THEN
        RAISE EXCEPTION 'Request is not awaiting evidence';
    END IF;

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, 'Solicitante (Evidência)', 'evidence_provided',
        v_request.approval_level, 
        COALESCE(p_observations, '') || ' | URL: ' || p_attachment_url
    );

    -- 4. Update request -> BACK TO PENDING
    UPDATE public.price_suggestions
    SET status = 'pending',
        evidence_url = p_attachment_url,
        last_observation = p_observations -- Save observation
    WHERE id = p_request_id;

    -- 5. Notify Approver
    IF v_request.current_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            v_request.current_approver_id,
            'Evidência Anexada 📎',
            'O solicitante anexou a evidência solicitada.',
            'evidence_provided',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending', 'evidenceUrl', p_attachment_url);
END;
$$;


-- ============================================================================
-- 10. APPEAL PRICE REQUEST (Counter-Offer)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.appeal_price_request(
    p_request_id uuid,
    p_new_price numeric,
    p_observations text DEFAULT NULL,
    p_arla_price numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_request public.price_suggestions;
BEGIN
    v_user_id := auth.uid();

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

    IF v_request.status NOT IN ('price_suggested') THEN
        RAISE EXCEPTION 'Request is not in price suggestion mode';
    END IF;

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, 'Solicitante (Recurso)', 'appealed',
        v_request.approval_level,
        COALESCE(p_observations, '') || ' | Contraproposta: R$ ' || p_new_price::text
    );

    -- 4. Update request -> BACK TO PENDING (or Appealed status if prefered, but pending puts it back in queue)
    -- Usually appeals go back to the SAME approver or handled as a new pending item.
    -- Let's set to 'appealed' to distinguish, but Approval logic allows 'appealed' to be approved.
    UPDATE public.price_suggestions
    SET status = 'appealed',
        suggested_price = p_new_price, -- Update the price to the new desired one? Or keep original? 
                                       -- Usually requester updates "suggested_price" to their new offer.
        last_observation = p_observations -- Save observation
    WHERE id = p_request_id;

    -- 5. Notify Approver
    IF v_request.current_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            v_request.current_approver_id,
            'Recurso de Preço ↩️',
            'O solicitante enviou uma contraproposta/recurso.',
            'appealed',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'appealed', 'newPrice', p_new_price);
END;
$$;


-- ============================================================================
-- 11. ACCEPT SUGGESTED PRICE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_suggested_price(
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
    v_approver_name text;
    v_can_finalize boolean;
    v_profile public.user_profiles;
BEGIN
    v_user_id := auth.uid();
    
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

    IF v_request.status NOT IN ('price_suggested') THEN
        RAISE EXCEPTION 'Request is not in price suggestion mode';
    END IF;

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, 'Solicitante', 'accepted_suggestion',
        v_request.approval_level,
        COALESCE(p_observations, 'Aceito o preço sugerido.')
    );

    -- 4. Check if we need further approval?
    -- Usually if requester accepts approver's price, it is APPROVED immediately?
    -- OR it goes back to approver to Finalize?
    -- Let's assume it becomes APPROVED because the Approver already 'Suggested' (i.e. pre-approved) this price.
    
    UPDATE public.price_suggestions
    SET status = 'approved',
        approved_by = v_request.current_approver_id, -- Attributed to the approver who suggested it?
        approved_at = now(),
        last_approver_action_by = v_user_id,
        last_observation = p_observations
    WHERE id = p_request_id;

    -- Notify Approver that it was accepted
    IF v_request.current_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            v_request.current_approver_id,
            'Sugestão Aceita ✅',
            'O solicitante aceitou o preço sugerido. Solicitação Aprovada.',
            'suggestion_accepted',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'approved');
END;
$$;

-- ============================================================================
-- 0.1. HELPER FUNCTIONS
-- ============================================================================

-- Function to safely resolve a user ID from text (UUID string or Email/Name)
CREATE OR REPLACE FUNCTION public._resolve_user_id(p_identifier text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- 1. Try casting to UUID if it looks like one
    IF p_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN p_identifier::uuid;
    END IF;

    -- 2. Try looking up by email or name in user_profiles
    SELECT user_id INTO v_user_id 
    FROM public.user_profiles 
    WHERE email = p_identifier OR nome = p_identifier 
    LIMIT 1;

    RETURN v_user_id;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Overload for UUID input (just returns itself) - Handles the error case where input is already UUID
CREATE OR REPLACE FUNCTION public._resolve_user_id(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN p_id;
END;
$$;


-- ============================================================================
-- 1. FIX APPROVAL HISTORY CONSTRAINT
-- ============================================================================
DO $$
BEGIN
    -- Drop the restrictive check constraint
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_history_action_check') THEN
        ALTER TABLE public.approval_history DROP CONSTRAINT approval_history_action_check;
    END IF;

    -- Add the new, expanded check constraint
    ALTER TABLE public.approval_history 
    ADD CONSTRAINT approval_history_action_check 
    CHECK (action IN ('approved', 'rejected', 'price_suggested', 'request_justification', 'request_evidence', 'appealed'));
    
    -- Ensure status column length in price_suggestions is sufficient (if it was limited)
    -- usually text or varchar(255), so likely fine.
END $$;


-- ============================================================================
-- 2. ENSURE ROLE PERMISSIONS EXIST
-- ============================================================================
DO $$
DECLARE
    r text;
BEGIN
    -- Define the approval roles
    FOREACH r IN ARRAY ARRAY['analista_pricing', 'supervisor_comercial', 'diretor_comercial', 'diretor_pricing', 'admin', 'gerente']
    LOOP
        -- Upsert permission configuration for the role
        INSERT INTO public.profile_permissions (perfil, can_approve, created_at, updated_at)
        VALUES (r, true, now(), now())
        ON CONFLICT (perfil) DO UPDATE
        SET can_approve = true,
            updated_at = now();
    END LOOP;
    
    -- Ensure admin keys are set
    UPDATE public.profile_permissions
    SET 
      tax_management = true,
      station_management = true,
      client_management = true,
      audit_logs = true,
      settings = true,
      gestao = true,
      approval_margin_config = true,
      gestao_stations = true,
      gestao_clients = true,
      gestao_payment_methods = true
    WHERE perfil = 'admin';

END $$;


-- ============================================================================
-- 3. APPROVE PRICE REQUEST
-- ============================================================================
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
BEGIN
    v_user_id := auth.uid();

    -- 1. Fetch & Validate
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    -- ALLOW 'pending' OR 'appealed'
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    
    -- FIX: Look up permissions by PROFILE (perfil)
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'approved', v_current_level, p_observations
    );

    -- 4. Check if this profile can finalize (has margin authority)
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
            last_observation = p_observations -- Save observation
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
            UPDATE public.price_suggestions
            SET approval_level = (v_next_approver->>'level')::integer,
                current_approver_id = (v_next_approver->>'user_id')::uuid,
                current_approver_name = v_next_approver->>'user_name',
                approvals_count = COALESCE(approvals_count, 0) + 1,
                last_approver_action_by = v_user_id,
                last_observation = p_observations -- Save observation
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
        ELSE
            -- No one else in chain → final approval by current user
            UPDATE public.price_suggestions
            SET status = 'approved',
                approved_by = v_user_id,
                approved_at = now(),
                current_approver_id = v_user_id,
                current_approver_name = v_approver_name,
                approvals_count = COALESCE(approvals_count, 0) + 1,
                last_approver_action_by = v_user_id,
                last_observation = p_observations -- Save observation
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
END;
$$;


-- ============================================================================
-- 4. REJECT PRICE REQUEST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_price_request(
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
    v_next_approver json;
BEGIN
    v_user_id := auth.uid();

    -- 1. Fetch & Validate
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    -- ALLOW 'pending' OR 'appealed'
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    
    -- FIX: Look up permissions by PROFILE (perfil)
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'rejected', v_current_level, p_observations
    );

    -- 4. ALWAYS try to escalate
    v_next_approver := public._find_next_approver(
        p_request_id, v_request.created_by, v_current_level, v_request.margin_cents
    );

    IF (v_next_approver->>'found')::boolean THEN
        -- Escalate to next approver
        UPDATE public.price_suggestions
        SET status = 'pending',
            approval_level = (v_next_approver->>'level')::integer,
            current_approver_id = (v_next_approver->>'user_id')::uuid,
            current_approver_name = v_next_approver->>'user_name',
            rejections_count = COALESCE(rejections_count, 0) + 1,
            last_approver_action_by = v_user_id,
            rejection_reason = p_observations, -- Keep rejection reason in its specific column
            last_observation = p_observations -- AND in last_observation for consistency
        WHERE id = p_request_id;

        -- Notify next approver
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            (v_next_approver->>'user_id')::uuid,
            'Solicitação Escalada para Revisão',
            'Uma solicitação foi rejeitada por ' || v_approver_name || ' e escalada para sua revisão',
            'approval_pending',
            p_request_id,
            false
        );

        RETURN json_build_object('success', true, 'status', 'pending', 'action', 'escalated', 'nextLevel', (v_next_approver->>'level')::integer);
    ELSE
        -- No one else in chain → final rejection
        UPDATE public.price_suggestions
        SET status = 'rejected',
            approved_by = v_user_id,
            approved_at = now(),
            current_approver_id = NULL,
            current_approver_name = NULL,
            rejections_count = COALESCE(rejections_count, 0) + 1,
            last_approver_action_by = v_user_id,
            rejection_reason = p_observations,
            last_observation = p_observations
        WHERE id = p_request_id;

        -- Notify Requester
        IF v_request.created_by IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (
                public._resolve_user_id(v_request.created_by),
                'Solicitação Rejeitada ❌',
                'Sua solicitação foi rejeitada por ' || v_approver_name,
                'price_rejected',
                p_request_id,
                false
            );
        END IF;

        RETURN json_build_object('success', true, 'status', 'rejected', 'action', 'terminated');
    END IF;
END;
$$;


-- ============================================================================
-- 5. SUGGEST PRICE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.suggest_price_request(
    p_request_id uuid,
    p_suggested_price numeric,
    p_observations text DEFAULT NULL,
    p_arla_price numeric DEFAULT NULL
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
    -- v_price_val and v_arla_val used to be cents/integers, now keeping native numeric
    v_price_val numeric; 
    v_arla_val numeric;
    v_new_margin_cents integer;
BEGIN
    v_user_id := auth.uid();

    -- 1. Fetch & Validate
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    -- ALLOW 'pending' OR 'appealed'
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    IF p_suggested_price IS NULL OR p_suggested_price <= 0 THEN
        RAISE EXCEPTION 'Suggested price must be greater than 0';
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    
    -- FIX: Look up permissions by PROFILE (perfil)
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);
    
    -- FIX: Do not multiply by 100. Store as raw numeric to match column type (NUMERIC).
    v_price_val := p_suggested_price;
    v_arla_val := p_arla_price;

    -- FIX: Calculate new margin (Price - Cost) * 100
    -- Assuming cost_price is the column holding the cost.
    v_new_margin_cents := ((p_suggested_price - COALESCE(v_request.cost_price, 0)) * 100)::integer;

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'price_suggested',
        v_current_level,
        COALESCE(p_observations, '') || ' | Preço sugerido: R$ ' || p_suggested_price::text
    );

    -- 4. Update request
    UPDATE public.price_suggestions
    SET status = 'price_suggested',
        suggested_price = v_price_val,
        final_price = v_price_val, -- Assuming final_price is also NUMERIC now
        arla_price = COALESCE(v_arla_val, arla_price),
        margin_cents = v_new_margin_cents,
        current_approver_id = v_user_id,
        current_approver_name = v_approver_name,
        last_approver_action_by = v_user_id,
        last_observation = p_observations -- Save observation
    WHERE id = p_request_id;

    -- 5. Notify Requester
    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            public._resolve_user_id(v_request.created_by),
            'Preço Sugerido 💰',
            v_approver_name || ' sugeriu um novo preço para sua solicitação. Aceite ou recorra.',
            'price_suggested',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'price_suggested', 'suggestedPrice', p_suggested_price);
END;
$$;


-- ============================================================================
-- 6. REQUEST JUSTIFICATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_justification(
    p_request_id uuid,
    p_observations text
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
BEGIN
    v_user_id := auth.uid();

    -- 1. Validate
    IF p_observations IS NULL OR trim(p_observations) = '' THEN
        RAISE EXCEPTION 'Observations are required when requesting justification';
    END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    -- ALLOW 'pending' OR 'appealed'
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;

    -- FIX: Look up permissions by PROFILE (perfil)
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'request_justification',
        v_current_level, p_observations
    );

    -- 4. Update request
    UPDATE public.price_suggestions
    SET status = 'awaiting_justification',
        last_approver_action_by = v_user_id,
        last_observation = p_observations -- Save observation
    WHERE id = p_request_id;

    -- 5. Notify Requester
    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            public._resolve_user_id(v_request.created_by),
            'Justificativa Solicitada 📝',
            v_approver_name || ' solicitou uma justificativa para sua solicitação de preço.',
            'justification_requested',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'awaiting_justification');
END;
$$;


-- ============================================================================
-- 7. REQUEST EVIDENCE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_evidence(
    p_request_id uuid,
    p_product text,
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
BEGIN
    v_user_id := auth.uid();

    -- 1. Validate
    IF p_product NOT IN ('principal', 'arla') THEN
        RAISE EXCEPTION 'Product must be "principal" or "arla"';
    END IF;

    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    -- ALLOW 'pending' OR 'appealed'
    IF v_request.status NOT IN ('pending', 'appealed') THEN 
        RAISE EXCEPTION 'Request is not pending approval or appealed'; 
    END IF;

    -- 2. User Profile & Permissions
    SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;

    -- FIX: Look up permissions by PROFILE (perfil)
    SELECT * INTO v_permissions FROM public.profile_permissions WHERE perfil = v_profile.perfil;

    IF v_permissions IS NULL OR NOT v_permissions.can_approve THEN
        RAISE EXCEPTION 'User (Role: %) does not have approval permissions', v_profile.perfil;
    END IF;

    v_approver_name := COALESCE(v_profile.nome, v_profile.email, 'Aprovador');
    v_current_level := COALESCE(v_request.approval_level, 1);

    -- 3. Audit Trail
    INSERT INTO public.approval_history (
        suggestion_id, approver_id, approver_name, action, approval_level, observations
    ) VALUES (
        p_request_id, v_user_id, v_approver_name, 'request_evidence',
        v_current_level,
        COALESCE(p_observations, '') || ' | Produto: ' || p_product
    );

    -- 4. Update request
    UPDATE public.price_suggestions
    SET status = 'awaiting_evidence',
        evidence_product = p_product,
        last_approver_action_by = v_user_id,
        last_observation = p_observations -- Save observation
    WHERE id = p_request_id;

    -- 5. Notify Requester
    IF v_request.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            public._resolve_user_id(v_request.created_by),
            'Referência Solicitada 📎',
            v_approver_name || ' solicitou uma referência de preço (' || 
            CASE WHEN p_product = 'principal' THEN 'Produto Principal' ELSE 'ARLA' END || ').',
            'evidence_requested',
            p_request_id,
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'awaiting_evidence', 'evidenceProduct', p_product);
END;
$$;


-- ============================================================================
-- 12. CREATE PRICE REQUEST (Updated to include evidence_url)
-- ============================================================================

-- Drop previous signature (17 params) to avoid ambiguity
DROP FUNCTION IF EXISTS public.create_price_request(
    text, text, numeric, integer, text, text, text, text, numeric, numeric, numeric, uuid, text, numeric, numeric, numeric, numeric
);

-- Drop previous versions to avoid "cannot change name of input parameter" error
DROP FUNCTION IF EXISTS public.create_price_request(text,text,numeric,integer,text,text,text,text,numeric,numeric,numeric,uuid,text,numeric,numeric,numeric,numeric,text);

CREATE OR REPLACE FUNCTION public.create_price_request(
    p_station_id text,
    p_product text,
    p_final_price numeric,
    p_margin_cents integer DEFAULT 0,
    p_client_id text DEFAULT NULL,
    p_payment_method_id text DEFAULT NULL,
    p_observations text DEFAULT NULL,
    p_status text DEFAULT 'pending',
    p_purchase_cost numeric DEFAULT 0,
    p_freight_cost numeric DEFAULT 0,
    p_cost_price numeric DEFAULT 0,
    p_batch_id uuid DEFAULT NULL,
    p_batch_name text DEFAULT NULL,
    p_volume_made numeric DEFAULT 0,
    p_volume_projected numeric DEFAULT 0,
    p_arla_purchase_price numeric DEFAULT 0,
    p_arla_cost_price numeric DEFAULT 0,
    p_current_price numeric DEFAULT 0,
    p_evidence_url text DEFAULT NULL
)
RETURNS public.price_suggestions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_new_request public.price_suggestions;
    v_cost_data record;
    v_purchase_cost numeric;
    v_freight_cost numeric;
    v_total_cost numeric;
    v_margin_cents integer := p_margin_cents;
    
    v_base_nome text := 'Manual';
    v_base_uf text := '';
    v_forma_entrega text := '';
    v_base_bandeira text := '';
    v_base_codigo text := '';
BEGIN
    v_user_id := auth.uid();
    
    -- Basic validation
    IF p_station_id IS NULL OR p_product IS NULL OR p_final_price IS NULL OR p_final_price <= 0 THEN
        RAISE EXCEPTION 'Missing required fields or invalid price: station_id, product, or final_price > 0';
    END IF;

    -- Initialize costs with passed values
    v_purchase_cost := p_purchase_cost;
    v_freight_cost := p_freight_cost;
    v_total_cost := p_cost_price;

    -- Try to fetch current costs from get_lowest_cost_freight to fill IF passed values are zero
    IF v_purchase_cost = 0 OR v_total_cost = 0 THEN
        BEGIN
            SELECT custo, frete, custo_total, base_nome, base_uf, forma_entrega, base_bandeira, base_codigo
            INTO v_cost_data
            FROM public.get_lowest_cost_freight(p_station_id, p_product)
            LIMIT 1;

            IF FOUND THEN
                v_purchase_cost := COALESCE(NULLIF(v_purchase_cost, 0), v_cost_data.custo);
                v_freight_cost := COALESCE(NULLIF(v_freight_cost, 0), v_cost_data.frete);
                v_total_cost := COALESCE(NULLIF(v_total_cost, 0), v_cost_data.custo_total);
                
                v_base_nome := COALESCE(v_cost_data.base_nome, 'Manual');
                v_base_uf := COALESCE(v_cost_data.base_uf, '');
                v_forma_entrega := COALESCE(v_cost_data.forma_entrega, '');
                v_base_bandeira := COALESCE(v_cost_data.base_bandeira, '');
                v_base_codigo := COALESCE(v_cost_data.base_codigo, '');
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not fetch lowest cost freight, using passed values';
        END;
    END IF;
        
    -- Recalculate margin in cents: (final_price - total_cost) * 100
    IF v_total_cost IS NOT NULL AND v_total_cost > 0 THEN
        v_margin_cents := ((p_final_price - v_total_cost) * 100)::integer;
    ELSE
        v_total_cost := COALESCE(v_total_cost, 0);
    END IF;

    -- Insert request with enriched cost data
    INSERT INTO public.price_suggestions (
        station_id,
        product,
        final_price,
        current_price,
        purchase_cost,
        freight_cost,
        cost_price,
        margin_cents,
        client_id,
        payment_method_id,
        observations,
        status,
        created_by,
        price_origin_base,
        price_origin_uf,
        price_origin_delivery,
        price_origin_bandeira,
        price_origin_code,
        batch_id,
        batch_name,
        volume_made,
        volume_projected,
        arla_purchase_price,
        arla_cost_price,
        approval_level,
        approvals_count,
        total_approvers,
        evidence_url
    ) VALUES (
        p_station_id,
        p_product::public.product_type,
        p_final_price,
        p_current_price,
        v_purchase_cost,
        v_freight_cost,
        v_total_cost,
        v_margin_cents,
        p_client_id,
        p_payment_method_id,
        p_observations,
        p_status::public.approval_status,
        v_user_id,
        v_base_nome,
        v_base_uf,
        v_forma_entrega,
        v_base_bandeira,
        v_base_codigo,
        p_batch_id,
        p_batch_name,
        p_volume_made,
        p_volume_projected,
        p_arla_purchase_price,
        p_arla_cost_price,
        1,
        0,
        1,
        p_evidence_url
    ) RETURNING * INTO v_new_request;

    RETURN v_new_request;
END;
$$;
