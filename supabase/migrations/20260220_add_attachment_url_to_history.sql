-- Migration: Add attachment_url to approval_history and update RPCs
-- Allows evidence links to be displayed in the activity timeline

-- 1. Add column to approval_history
ALTER TABLE public.approval_history 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Update provide_evidence RPC to populate the new column
CREATE OR REPLACE FUNCTION public.provide_evidence(
    p_request_id text, -- Changed to text for flexibility with PostgREST
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
    v_profile public.user_profiles;
    v_requester_name text;
    v_last_approver_id uuid;
    v_current_attachments text[];
BEGIN
    v_user_id := auth.uid();

    -- 1. Validate
    IF p_attachment_url IS NULL OR trim(p_attachment_url) = '' THEN
        RAISE EXCEPTION 'Attachment URL is required';
    END IF;

    -- Use TEXT comparison for safety
    SELECT * INTO v_request FROM public.price_suggestions WHERE id::text = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_request.status != 'awaiting_evidence' THEN RAISE EXCEPTION 'Request is not awaiting evidence'; END IF;
    
    -- Robust comparison for created_by
    IF public._resolve_user_id(v_request.created_by::text) != v_user_id 
       AND v_request.created_by::text != v_user_id::text THEN
        RAISE EXCEPTION 'Only the requester can provide evidence';
    END IF;

    -- 2. User name
    SELECT nome, email INTO v_profile FROM public.user_profiles WHERE user_id::text = v_user_id::text;
    v_requester_name := COALESCE(v_profile.nome, v_profile.email, 'Solicitante');

    v_last_approver_id := v_request.last_approver_action_by;

    -- 3. Append attachment to suggestion table (main record)
    v_current_attachments := COALESCE(v_request.attachments, ARRAY[]::text[]);
    v_current_attachments := array_append(v_current_attachments, p_attachment_url);

    -- 4. Audit Trail (Now with attachment_url)
    INSERT INTO public.approval_history (
        suggestion_id, 
        approver_id, 
        approver_name, 
        action, 
        approval_level, 
        observations,
        attachment_url
    ) VALUES (
        p_request_id::uuid, -- Try casting back to uuid for the history table if it's uuid
        v_user_id, 
        v_requester_name, 
        'evidence_provided',
        v_request.approval_level, 
        COALESCE(p_observations, 'Evidência anexada via arquivo.'),
        p_attachment_url
    );

    -- 5. Update request status
    UPDATE public.price_suggestions
    SET status = 'pending',
        attachments = v_current_attachments,
        evidence_product = NULL
    WHERE id::text = p_request_id;

    -- 6. Notify the approver who requested evidence
    IF v_last_approver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, suggestion_id, read)
        VALUES (
            v_last_approver_id,
            'Referência Recebida ✅',
            v_requester_name || ' anexou a referência de preço solicitada.',
            'evidence_provided',
            p_request_id::uuid, -- Try casting back to uuid
            false
        );
    END IF;

    RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;
