-- Migration: Add resubmit_price_requests_to_review stored procedure
-- and allow 'resubmitted' in approval_history_action_check.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_history_action_check') THEN
        ALTER TABLE public.approval_history DROP CONSTRAINT approval_history_action_check;
    END IF;
    ALTER TABLE public.approval_history
    ADD CONSTRAINT approval_history_action_check
    CHECK (action IN ('approved', 'rejected', 'price_suggested', 'request_justification',
                      'request_evidence', 'appealed', 'justification_provided',
                      'evidence_provided', 'accepted_suggestion', 'resubmitted'));
END $$;

-- RPC to Resubmit Requests to Review
CREATE OR REPLACE FUNCTION public.resubmit_price_requests_to_review(
    p_request_ids text[],
    p_user_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req_id text;
    v_id uuid;
    v_request public.price_suggestions;
    v_new_margin integer;
    v_creator_uuid uuid;
    v_current_level integer;
    
    v_success_count integer := 0;
    v_error_count integer := 0;
    v_errors text[] := ARRAY[]::text[];
BEGIN
    v_creator_uuid := public._resolve_user_id(p_user_id);
    
    FOREACH v_req_id IN ARRAY p_request_ids LOOP
        BEGIN
            v_id := v_req_id::uuid;
            
            SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
            
            IF NOT FOUND THEN
                v_error_count := v_error_count + 1;
                v_errors := array_append(v_errors, 'Solicitação ' || v_req_id || ' não encontrada');
                CONTINUE;
            END IF;
            
            IF v_request.status = 'approved' THEN
                v_error_count := v_error_count + 1;
                v_errors := array_append(v_errors, 'Solicitação ' || v_req_id || ' já está aprovada');
                CONTINUE;
            END IF;

            -- Recalculate margin
            v_new_margin := ((COALESCE(v_request.suggested_price, v_request.final_price, 0) - COALESCE(v_request.cost_price, 0)) * 100)::integer;
            
            v_current_level := COALESCE(v_request.approval_level, 1);
            
            DECLARE
                v_last_approver_id uuid;
                v_last_approver_name text;
            BEGIN
                -- Find the last approver who rejected or acted on it from the same level
                SELECT approver_id, approver_name INTO v_last_approver_id, v_last_approver_name
                FROM public.approval_history
                WHERE suggestion_id = v_id AND approver_id != v_creator_uuid
                ORDER BY created_at DESC
                LIMIT 1;
                
                IF v_last_approver_id IS NULL THEN
                	-- Use fallback config if there's no previous approver
                    v_last_approver_id := (public._find_next_approver(v_id, v_request.created_by::text, COALESCE(v_current_level - 1, 0), v_new_margin)->>'user_id')::uuid;
                    v_last_approver_name := public._find_next_approver(v_id, v_request.created_by::text, COALESCE(v_current_level - 1, 0), v_new_margin)->>'user_name';
                END IF;
                
                -- Update request
                UPDATE public.price_suggestions
                SET status = 'pending',
                    margin_cents = v_new_margin,
                    current_approver_id = v_last_approver_id,
                    current_approver_name = v_last_approver_name,
                    rejection_reason = NULL
                WHERE id = v_id;
                
                -- Add history entry
                INSERT INTO public.approval_history (
                    suggestion_id, approver_id, approver_name, action, approval_level, observations
                ) VALUES (v_id, v_creator_uuid, 'Solicitante', 'resubmitted', v_current_level, 'Re-enviado para revisão com custo atualizado.');
                
                v_success_count := v_success_count + 1;
                
            EXCEPTION WHEN OTHERS THEN
                v_error_count := v_error_count + 1;
                v_errors := array_append(v_errors, 'Erro na solicitação ' || v_req_id || ': ' || SQLERRM);
            END;
        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_errors := array_append(v_errors, 'Erro fatal em ' || v_req_id || ': ' || SQLERRM);
        END;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'processed', v_success_count,
        'errors', v_error_count,
        'error_details', v_errors
    );
END;
$$;
