-- Ensure approval_settings table exists (in case previous migration failed)
create table if not exists public.approval_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by text
);

-- Enable RLS if not enabled
alter table public.approval_settings enable row level security;

-- Drop incorrect policy if exists from failed migration
drop policy if exists "Settings are updating by admins only" on public.approval_settings;

-- Create correct policies
create policy "Calculated settings are viewable by everyone"
  on public.approval_settings for select
  using (true);

create policy "Settings are updating by admins only"
  on public.approval_settings for all
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid()
      and role = 'admin'  -- Correct column name
    )
  );

-- Insert default values if not exist
insert into public.approval_settings (key, value, description)
values 
  ('max_appeals', '1'::jsonb, 'Número máximo de vezes que um solicitante pode recorrer de uma sugestão de preço')
on conflict (key) do nothing;

-- Create the secure RPC function
CREATE OR REPLACE FUNCTION handle_requester_response(
  p_suggestion_id UUID,
  p_action TEXT, -- 'approve' or 'reject'
  p_observations TEXT,
  p_user_email TEXT,
  p_user_name TEXT
) RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_max_appeals INT := 1;
  v_appeal_count INT;
  v_new_status TEXT;
  v_action_key TEXT;
  v_settings_val JSONB;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status FROM price_suggestions WHERE id = p_suggestion_id;
  
  -- Get max appeals setting
  SELECT value INTO v_settings_val FROM approval_settings WHERE key = 'max_appeals';
  IF v_settings_val IS NOT NULL THEN
    -- Handle both number and string JSON formats
    BEGIN
      v_max_appeals := (v_settings_val #>> '{}')::int;
    EXCEPTION WHEN OTHERS THEN
      v_max_appeals := 1;
    END;
  END IF;

  -- Logic based on status
  IF v_current_status = 'price_suggested' THEN
    IF p_action = 'approve' THEN
      v_new_status := 'approved';
      v_action_key := 'accepted_suggestion';
    ELSE -- reject
      -- Check appeal count
      SELECT COUNT(*) INTO v_appeal_count 
      FROM approval_history 
      WHERE suggestion_id = p_suggestion_id AND action = 'appealed_suggestion';
      
      IF v_appeal_count >= v_max_appeals THEN
        v_new_status := 'rejected';
        v_action_key := 'rejected_suggestion';
      ELSE
        v_new_status := 'pending';
        v_action_key := 'appealed_suggestion';
      END IF;
    END IF;
  
  ELSIF v_current_status IN ('awaiting_justification', 'awaiting_evidence') THEN
      v_new_status := 'pending';
      v_action_key := 'responded_request';
      
  ELSIF v_current_status = 'pending' THEN
      IF p_action = 'reject' THEN
        v_new_status := 'cancelled';
        v_action_key := 'cancelled_by_requester';
      END IF;
  END IF;

  -- Apply Update
  IF v_new_status IS NOT NULL THEN
    UPDATE price_suggestions SET status = v_new_status WHERE id = p_suggestion_id;
    
    INSERT INTO approval_history (suggestion_id, approver_name, action, observations, approval_level)
    VALUES (p_suggestion_id, COALESCE(p_user_name, p_user_email), v_action_key, p_observations, 0);
    
    RETURN jsonb_build_object('success', true, 'new_status', v_new_status, 'action_key', v_action_key, 'message', 
       CASE 
         WHEN v_action_key = 'appealed_suggestion' THEN 'Recurso enviado com sucesso!'
         WHEN v_action_key = 'rejected_suggestion' THEN 'Solicitação rejeitada após limite de recursos.'
         ELSE 'Resposta enviada com sucesso!'
       END
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'message', 'Nenhuma ação aplicável para o estado atual.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
