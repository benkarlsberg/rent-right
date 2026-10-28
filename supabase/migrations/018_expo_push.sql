alter table public.profiles add column if not exists push_enabled boolean not null default true;

create table if not exists public.expo_push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expo_push_tokens_user on public.expo_push_tokens (user_id);

grant select, insert, update, delete on public.expo_push_tokens to authenticated, service_role;

alter table public.expo_push_tokens enable row level security;

drop policy if exists expo_push_own on public.expo_push_tokens;
create policy expo_push_own on public.expo_push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
