-- Migration: New columns for approval actions overhaul
-- appeal_count: tracks how many times a requester has appealed a suggested price (max 1)
-- evidence_product: which product needs evidence ('principal' | 'arla')
-- last_approver_action_by: who performed the last approver action (for return-to-flow routing)

ALTER TABLE public.price_suggestions
  ADD COLUMN IF NOT EXISTS appeal_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_product text,
  ADD COLUMN IF NOT EXISTS last_approver_action_by uuid REFERENCES auth.users(id);

-- Index for quick lookup of pending items by approval level
CREATE INDEX IF NOT EXISTS idx_price_suggestions_approval_level_status
  ON public.price_suggestions (approval_level, status)
  WHERE status IN ('pending', 'price_suggested', 'awaiting_justification', 'awaiting_evidence');
