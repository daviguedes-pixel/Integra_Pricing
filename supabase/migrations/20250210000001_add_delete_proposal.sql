-- Allow deleting commercial proposals
-- 1. Add DELETE policy
create policy "Users can delete their own proposals"
    on public.commercial_proposals for delete
    using (created_by = auth.uid() or exists (
        select 1 from public.profile_permissions 
        where id = auth.uid() and (admin = true or can_delete = true)
    ));

-- 2. Update foreign key to allow deletion (Unlink suggestions instead of deleting them, or Cascade?)
-- We will use SET NULL to preserve the price suggestions history even if the proposal wrapper is deleted
-- First drop the existing constraint if it exists (need to know the name, usually price_suggestions_proposal_id_fkey)

do $$
declare
    constraint_name text;
begin
    -- Find the constraint name
    select con.conname into constraint_name
    from pg_catalog.pg_constraint con
    inner join pg_catalog.pg_class rel on rel.oid = con.conrelid
    inner join pg_catalog.pg_namespace nsp on nsp.oid = connamespace
    where nsp.nspname = 'public'
      and rel.relname = 'price_suggestions'
      and con.contype = 'f'
      and exists (
          select 1 
          from pg_attribute a 
          where a.attrelid = con.conrelid 
            and a.attnum = any(con.conkey) 
            and a.attname = 'proposal_id'
      );

    -- If found, drop and recreate with ON DELETE SET NULL
    if constraint_name is not null then
        execute 'alter table public.price_suggestions drop constraint ' || constraint_name;
        execute 'alter table public.price_suggestions add constraint ' || constraint_name || 
                ' foreign key (proposal_id) references public.commercial_proposals(id) on delete set null';
    end if;
end $$;
