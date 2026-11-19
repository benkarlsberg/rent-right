-- Landlord portal accounts are separate from the household.
-- Creating a link does not insert unit_members, so is_unit_member() stays false.

create table public.landlord_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.landlord_links (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  landlord_user_id uuid references auth.users (id) on delete cascade,
  invited_email text not null,
  token_hash text,
  source_message_id uuid references public.messages (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint landlord_links_active_user check (status <> 'active' or landlord_user_id is not null)
);

create index landlord_links_unit_idx on public.landlord_links (unit_id);
create index landlord_links_landlord_idx on public.landlord_links (landlord_user_id);
create unique index landlord_links_token_hash_idx on public.landlord_links (token_hash) where token_hash is not null;
create unique index landlord_links_one_active_idx on public.landlord_links (unit_id, landlord_user_id) where status = 'active';

create or replace function public.is_unit_landlord(unit uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target uuid := unit;
begin
  return exists (
    select 1
    from public.landlord_links as links
    where links.unit_id = target
      and links.landlord_user_id = auth.uid()
      and links.status = 'active'
      and links.revoked_at is null
      and (links.expires_at is null or links.expires_at > now())
      and exists (
        select 1
        from public.landlord_accounts as accounts
        where accounts.user_id = links.landlord_user_id
      )
  );
end;
$$;

alter table public.landlord_accounts enable row level security;
alter table public.landlord_links enable row level security;
alter table public.landlord_accounts force row level security;
alter table public.landlord_links force row level security;

create policy landlord_accounts_select on public.landlord_accounts
  for select to authenticated
  using (user_id = auth.uid());

create policy landlord_links_select on public.landlord_links
  for select to authenticated
  using (public.is_unit_member(unit_id) or landlord_user_id = auth.uid());

create policy landlord_links_insert on public.landlord_links
  for insert to authenticated
  with check (public.is_unit_member(unit_id));

create policy landlord_links_update on public.landlord_links
  for update to authenticated
  using (public.is_unit_member(unit_id))
  with check (public.is_unit_member(unit_id));

create policy landlord_links_delete on public.landlord_links
  for delete to authenticated
  using (public.is_unit_member(unit_id));

grant select, insert, update, delete on public.landlord_accounts to authenticated, service_role;
grant select, insert, update, delete on public.landlord_links to authenticated, service_role;
grant execute on function public.is_unit_landlord(uuid) to anon, authenticated, service_role;
