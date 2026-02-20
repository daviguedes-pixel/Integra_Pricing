-- CRITICAL FIX: Remove persistent faulty triggers that send "Price Rejected" notifications
-- This script ensures no old triggers are firing on price_suggestions updates

DROP TRIGGER IF EXISTS price_rejected_notification ON public.price_suggestions;
DROP TRIGGER IF EXISTS price_approved_notification ON public.price_suggestions;

-- Drop functions that might be called by these triggers (if they exist)
DROP FUNCTION IF EXISTS public.notify_price_rejected(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.notify_price_rejected();
DROP FUNCTION IF EXISTS public.notify_price_approved(UUID, TEXT);

-- Also drop the new named trigger if it's causing issues (we will rely on frontend manual notification for now to be safe)
-- Or ensure it has the correct WHEN validation
DROP TRIGGER IF EXISTS trigger_create_notification_on_approval_change ON public.price_suggestions;

-- We can recreate the "correct" trigger if needed in the future, but for now, 
-- since the frontend (Approvals.tsx) is handling notifications manually and correctly,
-- we should REMOVE the automatic DB triggers to prevent double/false notifications.
