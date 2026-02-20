-- Create a table for general approval settings
create table if not exists public.approval_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by text
);

-- Enable RLS
alter table public.approval_settings enable row level security;

-- Policies
create policy "Calculated settings are viewable by everyone"
  on public.approval_settings for select
  using (true);

create policy "Settings are updating by admins only"
  on public.approval_settings for all
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid()
      and role = 'admin'
    )
  );

-- Insert default values
insert into public.approval_settings (key, value, description)
values 
  ('max_appeals', '1'::jsonb, 'Número máximo de vezes que um solicitante pode recorrer de uma sugestão de preço'),
  ('require_observation_on_reject', 'true'::jsonb, 'Obrigar observação ao rejeitar'),
  ('notify_requester_on_suggestion', 'true'::jsonb, 'Notificar solicitante quando houver sugestão de preço'),
  ('rejection_action', '"terminate"'::jsonb, 'Ação ao rejeitar: "terminate" (encerra o fluxo) ou "escalate" (passa para o próximo aprovador)'),
  ('no_rule_approval_action', '"chain"'::jsonb, 'Ação ao aprovar sem regra específica: "direct" (aprova imediatamente) ou "chain" (segue a hierarquia padrão)')
on conflict (key) do update 
set value = excluded.value, description = excluded.description;
