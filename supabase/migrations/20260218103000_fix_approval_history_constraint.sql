-- Migration: Fix approval_history constraint to allow new actions
-- Auto-generated to fix "violates check constraint" errors

-- 1. Drop existing constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'approval_history_action_check'
    ) THEN
        ALTER TABLE public.approval_history DROP CONSTRAINT approval_history_action_check;
    END IF;
END $$;

-- 2. Add updated constraint with all valid actions
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
    'cancelled'
));
