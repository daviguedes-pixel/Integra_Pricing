-- Add can_view_all_proposals to profile_permissions
do $$
begin
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profile_permissions' and column_name = 'can_view_all_proposals') then
        alter table public.profile_permissions add column can_view_all_proposals boolean default false;
    end if;
end $$;

-- Update defaults
update public.profile_permissions set can_view_all_proposals = true where admin = true;

-- Create standard commercial proposals table
create table if not exists public.commercial_proposals (
    id uuid not null default gen_random_uuid() primary key,
    proposal_number serial not null, -- Numéro sequencial legível para humanos
    client_id uuid references public.clients(id), -- Cliente UUID
    client_name text, -- Nome do cliente (denormalized for ease/legacy)
    status text not null default 'draft' check (status in ('draft', 'sent', 'pending_approval', 'approved', 'rejected', 'expired', 'canceled')),
    
    -- Valores totais
    total_value numeric,
    total_volume numeric,
    
    -- Datas
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    valid_until timestamp with time zone,
    sent_at timestamp with time zone,
    
    -- Responsáveis
    created_by uuid references auth.users(id),
    approved_by uuid references auth.users(id),
    
    -- Infos adicionais
    payment_method_id uuid references public.payment_methods(id),
    observations text,
    internal_notes text,
    metadata jsonb default '{}'::jsonb
);

-- Habilitar RLS
alter table public.commercial_proposals enable row level security;

-- Policies (Drop if exists to avoid errors on re-run)
drop policy if exists "Users can view their own proposals" on public.commercial_proposals;
create policy "Users can view their own proposals"
    on public.commercial_proposals for select
    using (created_by = auth.uid() or exists (
        select 1 from public.profile_permissions 
        where id = auth.uid() and (admin = true or can_view_all_proposals = true)
    ));

drop policy if exists "Users can insert their own proposals" on public.commercial_proposals;
create policy "Users can insert their own proposals"
    on public.commercial_proposals for insert
    with check (created_by = auth.uid());

drop policy if exists "Users can update their own proposals" on public.commercial_proposals;
create policy "Users can update their own proposals"
    on public.commercial_proposals for update
    using (created_by = auth.uid() or exists (
        select 1 from public.profile_permissions 
        where id = auth.uid() and (admin = true)
    ));

-- Create proposal items (separeted from price_suggestions for clean structure)
-- Items can be promoted to price_suggestions for approval
create table if not exists public.proposal_items (
    id uuid not null default gen_random_uuid() primary key,
    proposal_id uuid references public.commercial_proposals(id) on delete cascade,
    product text not null, -- 'gasolina_comum', 'diesel_s10', etc
    
    -- Preços e Quantidades
    quantity numeric not null default 0, -- Em litros/m3
    unit_price numeric not null default 0, -- Preço unitário proposto
    total_price numeric not null default 0, -- unit_price * quantity
    
    -- Custos e Margens (snapshot no momento da proposta)
    cost_price numeric,
    freight_price numeric,
    base_price numeric, -- cost + freight
    margin_value numeric, -- unit_price - base_price
    margin_percent numeric,
    
    -- Origem/Posto
    station_id uuid references public.stations(id), -- Se for específico de um posto
    
    created_at timestamp with time zone default now()
);

-- Habilitar RLS para items
alter table public.proposal_items enable row level security;

drop policy if exists "Users can view items of visible proposals" on public.proposal_items;
create policy "Users can view items of visible proposals"
    on public.proposal_items for select
    using (exists (
        select 1 from public.commercial_proposals p
        where p.id = proposal_items.proposal_id
        and (p.created_by = auth.uid() or exists (
            select 1 from public.profile_permissions 
            where id = auth.uid() and (admin = true or can_view_all_proposals = true)
        ))
    ));

drop policy if exists "Users can manage items of their proposals" on public.proposal_items;
create policy "Users can manage items of their proposals"
    on public.proposal_items for all
    using (exists (
        select 1 from public.commercial_proposals p
        where p.id = proposal_items.proposal_id
        and p.created_by = auth.uid()
    ));

-- Link price_suggestions to proposals (if needed)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'price_suggestions' and column_name = 'proposal_id') then
        alter table public.price_suggestions 
        add column proposal_id uuid references public.commercial_proposals(id);
    end if;
end $$;

-- Indexes
create index if not exists idx_commercial_proposals_client_id on public.commercial_proposals(client_id);
create index if not exists idx_commercial_proposals_created_by on public.commercial_proposals(created_by);
create index if not exists idx_commercial_proposals_status on public.commercial_proposals(status);
create index if not exists idx_proposal_items_proposal_id on public.proposal_items(proposal_id);
