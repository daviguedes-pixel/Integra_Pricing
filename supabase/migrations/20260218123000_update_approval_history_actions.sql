-- Migration: Update approval_history constraint to include all used actions
-- Fixes "new row for relation \"approval_history\" violates check constraint \"approval_history_action_check\""
-- Adds: accepted_suggestion, justification_provided, evidence_provided

DO $$ 
BEGIN
    -- Drop existing constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'approval_history_action_check'
    ) THEN
        ALTER TABLE public.approval_history DROP CONSTRAINT approval_history_action_check;
    END IF;
END $$;

-- Recreate constraint with all valid actions
ALTER TABLE public.approval_history 
ADD CONSTRAINT approval_history_action_check 
CHECK (action IN (
    'approved', 
    'rejected', 
    'price_suggested', 
    'request_justification', 
    'request_evidence', 
    'appealed', 
    'accepted',
    'cancelled',
    'accepted_suggestion',
    'justification_provided',
    'evidence_provided'
));
