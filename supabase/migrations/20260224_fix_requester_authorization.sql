-- Migration: Fix Requester Authorization
-- Fixes the `Não autorizado` exception in provide_evidence and provide_justification
-- The previous logic only checked `created_by`, ignoring `requested_by`. This blocks users
-- from providing evidence/justification if the request was created on their behalf.

-- ============================================================================
-- 1. PROVIDE_EVIDENCE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provide_evidence(
    p_request_id text,
    p_attachment_url text,
    p_observations text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_requester_name text;
    v_current_attachments text[];
    v_is_authorized boolean := false;
BEGIN
    BEGIN
        v_id := p_request_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'ID de solicitação inválido: ' || p_request_id || '. Esperado UUID.');
    END;

    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Não encontrada'; END IF;
    IF v_request.status != 'awaiting_evidence' THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    -- CHECK AUTHORIZATION (created_by OR requested_by)
    IF v_request.created_by IS NOT NULL THEN
        IF public._resolve_user_id(v_request.created_by::text) = v_user_id OR v_request.created_by::text = v_user_id::text THEN
            v_is_authorized := true;
        END IF;
    END IF;

    IF NOT v_is_authorized AND v_request.requested_by IS NOT NULL THEN
        IF public._resolve_user_id(v_request.requested_by::text) = v_user_id OR v_request.requested_by::text = v_user_id::text THEN
            v_is_authorized := true;
        END IF;
    END IF;

    IF NOT v_is_authorized THEN 
        RAISE EXCEPTION 'Não autorizado'; 
    END IF;

    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    v_requester_name := COALESCE(v_profile.nome, v_profile.email, 'Solicitante');

    v_current_attachments := COALESCE(v_request.attachments, ARRAY[]::text[]);
    IF p_attachment_url IS NOT NULL AND p_attachment_url != '' THEN
        v_current_attachments := array_append(v_current_attachments, p_attachment_url);
    END IF;

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations, attachment_url)
    VALUES (v_id, v_user_id, v_requester_name, 'evidence_provided', v_request.approval_level, COALESCE(p_observations, 'Enviada.'), p_attachment_url);

    UPDATE public.price_suggestions
    SET status = 'pending', evidence_url = COALESCE(p_attachment_url, evidence_url),
        attachments = v_current_attachments, evidence_product = NULL
    WHERE id = v_id;

    IF v_request.last_approver_action_by IS NOT NULL THEN
        IF public._resolve_user_id(v_request.last_approver_action_by::text) IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (public._resolve_user_id(v_request.last_approver_action_by::text), 'Referência Fornecida 📎', v_requester_name || ' enviou referência.', 'evidence_provided', v_id, false);
        END IF;
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;

-- ============================================================================
-- 2. PROVIDE_JUSTIFICATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provide_justification(
    p_request_id text,
    p_justification text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
    v_user_id uuid;
    v_request public.price_suggestions;
    v_profile public.user_profiles;
    v_requester_name text;
    v_is_authorized boolean := false;
BEGIN
    BEGIN
        v_id := p_request_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'ID de solicitação inválido: ' || p_request_id || '. Esperado UUID.');
    END;

    v_user_id := auth.uid();
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Não encontrada'; END IF;
    IF v_request.status != 'awaiting_justification' THEN RAISE EXCEPTION 'Estado inválido'; END IF;

    -- CHECK AUTHORIZATION (created_by OR requested_by)
    IF v_request.created_by IS NOT NULL THEN
        IF public._resolve_user_id(v_request.created_by::text) = v_user_id OR v_request.created_by::text = v_user_id::text THEN
            v_is_authorized := true;
        END IF;
    END IF;

    IF NOT v_is_authorized AND v_request.requested_by IS NOT NULL THEN
        IF public._resolve_user_id(v_request.requested_by::text) = v_user_id OR v_request.requested_by::text = v_user_id::text THEN
            v_is_authorized := true;
        END IF;
    END IF;

    IF NOT v_is_authorized THEN 
        RAISE EXCEPTION 'Não autorizado'; 
    END IF;

    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id = v_user_id;
    v_requester_name := COALESCE(v_profile.nome, v_profile.email, 'Solicitante');

    INSERT INTO public.approval_history (suggestion_id, approver_id, approver_name, action, approval_level, observations)
    VALUES (v_id, v_user_id, v_requester_name, 'justification_provided', v_request.approval_level, p_justification);

    UPDATE public.price_suggestions
    SET status = 'pending', last_observation = p_justification
    WHERE id = v_id;

    IF v_request.last_approver_action_by IS NOT NULL THEN
        IF public._resolve_user_id(v_request.last_approver_action_by::text) IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
            VALUES (public._resolve_user_id(v_request.last_approver_action_by::text), 'Justificativa Enviada 💬', v_requester_name || ' enviou justificativa.', 'justification_provided', v_id, false);
        END IF;
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;

-- ============================================================================
-- 3. FIX NOTIFICATION TRIGGER UUID CAST ERROR
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_create_notification_on_approval_change ON public.price_suggestions;

CREATE OR REPLACE FUNCTION public.create_notification_on_approval_change()
RETURNS TRIGGER AS $$
DECLARE
  creator_user_id UUID;
  notification_message TEXT;
BEGIN
  -- Resolves the creator to a UUID safely (handles both UUIDs and Emails/Names)
  -- Uses COALESCE to fallback to requested_by if created_by is null or unresolvable
  SELECT COALESCE(
      public._resolve_user_id(created_by::text),
      public._resolve_user_id(requested_by::text)
  ) INTO creator_user_id
  FROM public.price_suggestions
  WHERE id = NEW.id;
  
  -- If we couldn't resolve a valid UUID to notify, just exit gracefully
  IF creator_user_id IS NULL THEN
      RETURN NEW;
  END IF;

  -- Só criar notificação se o status mudou para approved ou rejected
  IF NEW.status IN ('approved', 'rejected') AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    IF NEW.status = 'approved' THEN
      notification_message := 'Sua solicitação de preço foi aprovada!';
      INSERT INTO public.notifications (user_id, suggestion_id, type, title, message)
      VALUES (creator_user_id, NEW.id, NEW.status, 'Preço Aprovado', notification_message);
    ELSE
      notification_message := 'Sua solicitação de preço foi rejeitada.';
      INSERT INTO public.notifications (user_id, suggestion_id, type, title, message)
      VALUES (creator_user_id, NEW.id, NEW.status, 'Preço Rejeitado', notification_message);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_create_notification_on_approval_change
AFTER UPDATE OF status ON public.price_suggestions
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION create_notification_on_approval_change();
