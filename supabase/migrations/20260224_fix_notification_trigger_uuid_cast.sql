-- Migration: Fix UUID cast error in notification trigger
-- The trigger `create_notification_on_approval_change` was trying to SELECT `created_by`
-- (which might be an email like "davi.guedes") INTO a UUID variable (`creator_user_id`).
-- This causes a "22P02 invalid input syntax for type uuid" error when the trigger fires.
-- This migration updates the trigger to use the `_resolve_user_id` helper safely.

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
