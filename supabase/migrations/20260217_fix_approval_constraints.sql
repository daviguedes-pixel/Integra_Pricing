-- Migration: Fix Approval Flows, Constraints, and RPCs (Consolidated & Safe)

-- 1. Drop existing constraint if it exists
ALTER TABLE public.approval_history DROP CONSTRAINT IF EXISTS approval_history_action_check;

-- 2. CLEANUP: Update any existing rows that might violate the new constraint
-- We map unknown actions to 'created' or 'approved' appropriately, or just 'created' as fallback.
-- This prevents the "check constraint violated" error.
UPDATE public.approval_history
SET action = 'created'
WHERE action NOT IN (
    'created', 
    'approved', 
    'rejected', 
    'price_suggested', 
    'justification_requested', 
    'evidence_requested', 
    'justification_provided', 
    'evidence_provided', 
    'appealed', 
    'suggestion_accepted'
);

-- 3. Add the corrected check constraint with ALL possible actions
ALTER TABLE public.approval_history
ADD CONSTRAINT approval_history_action_check
CHECK (action IN (
    'created', 
    'approved', 
    'rejected', 
    'price_suggested', 
    'justification_requested', 
    'evidence_requested', 
    'justification_provided', 
    'evidence_provided', 
    'appealed', 
    'suggestion_accepted'
));

-- 3b. Add evidence_product column if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_suggestions' AND column_name = 'evidence_product') THEN
        ALTER TABLE public.price_suggestions ADD COLUMN evidence_product text;
    END IF;
END $$;

-- 4. Update request_evidence RPC to support 'product' selection
-- DROP first to allow return type change (json -> jsonb)
DROP FUNCTION IF EXISTS public.request_evidence(uuid, text, text);

CREATE OR REPLACE FUNCTION public.request_evidence(
    p_request_id uuid,
    p_product text, -- 'principal' or 'arla'
    p_observations text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_request public.price_suggestions%ROWTYPE;
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();

    -- Get request
    SELECT * INTO v_request FROM public.price_suggestions WHERE id = p_request_id;
    
    IF v_request.id IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    -- Update request status
    UPDATE public.price_suggestions
    SET status = 'awaiting_evidence',
        evidence_product = p_product,
        updated_at = now()
    WHERE id = p_request_id;

    -- Insert into history
    INSERT INTO public.approval_history (
        suggestion_id,
        user_id,
        action,
        observations,
        new_status
    ) VALUES (
        p_request_id,
        v_user_id,
        'evidence_requested',
        COALESCE(p_observations, 'Evidência solicitada para: ' || p_product),
        'awaiting_evidence'
    );

    RETURN jsonb_build_object('success', true);
END;
$function$;
