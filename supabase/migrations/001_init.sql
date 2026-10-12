-- Rent Right production schema for Supabase Postgres.
-- The local app uses SQLite with the same relationships so it runs without a cloud account.
-- Apply this file in the Supabase SQL editor or CLI. Enable MFA on the Supabase dashboard account.
-- Service-role keys bypass RLS; the Next.js server must still filter by membership.

create extension if not exists pgcrypto;

create or replace function public.is_unit_member(target_unit uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.unit_members m
    where m.unit_id = target_unit
      and m.user_id = auth.uid()
  );
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  locale text not null default 'en' check (locale in ('en', 'es')),
  low_bandwidth boolean not null default false,
  phone text,
  created_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  street text not null,
  unit_number text,
  city text not null,
  postal_code text,
  region text,
  jurisdiction text not null,
  jurisdiction_confirmed boolean not null default false,
  rso_status text,
  rstpo_tier text,
  landlord_name text,
  landlord_email text,
  landlord_phone text,
  relay_local text not null unique,
  rent_cents integer,
  deposit_cents integer,
  move_in_date date,
  created_at timestamptz not null default now()
);

create table public.unit_members (
  unit_id uuid not null references public.units (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'roommate')),
  created_at timestamptz not null default now(),
  primary key (unit_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  token_hash text not null,
  email text,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.log_entries (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version_group uuid not null,
  version integer not null,
  revises_id uuid,
  type text not null,
  notice_kind text,
  severity text,
  room text,
  description text not null,
  flags jsonb not null default '{}'::jsonb,
  prev_hash text not null,
  content_hash text not null,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  log_entry_id uuid references public.log_entries (id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound')),
  from_email text not null,
  to_email text not null,
  cc_email text,
  subject text not null,
  body_enc text not null,
  delivery_status text not null,
  delivery_detail text,
  open_indicative boolean not null default false,
  provider_id text,
  response_token_hash text,
  created_at timestamptz not null default now(),
  status_at timestamptz not null default now()
);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  rule_id text not null,
  kind text not null,
  anchor_date date,
  due_date date,
  explanation text not null,
  explanation_es text not null,
  computation text not null,
  source_id uuid,
  status text not null default 'open',
  unsure boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reminder_sent (
  deadline_id uuid not null references public.deadlines (id) on delete cascade,
  slot text not null,
  sent_at timestamptz not null default now(),
  channel text not null,
  primary key (deadline_id, slot)
);

create table public.condition_reports (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('move_in', 'move_out')),
  rooms jsonb not null,
  notes text,
  content_hash text,
  ack_token_hash text,
  acknowledged_at timestamptz,
  ack_name text,
  created_at timestamptz not null default now()
);

create table public.deposits (
  unit_id uuid primary key references public.units (id) on delete cascade,
  amount_cents integer,
  received_date date,
  move_out_date date,
  forwarding_address text,
  landlord_deductions text,
  tenant_notes text,
  updated_at timestamptz not null default now()
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_cents integer not null,
  period_start date,
  period_end date,
  paid_on date not null,
  method text not null,
  notes text,
  receipt_file_id uuid,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.lease_reviews (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text,
  text_hash text not null,
  rules_version text not null,
  model text,
  cached boolean not null default false,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  review_id uuid not null references public.lease_reviews (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create table public.rent_checks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  unit_id uuid references public.units (id) on delete cascade,
  role text not null,
  locale text not null,
  content text not null,
  rule_ids jsonb not null default '[]'::jsonb,
  unsure boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  unit_id uuid references public.units (id) on delete cascade,
  name text not null,
  mime text not null,
  bytes integer not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  href text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.landlord_responses (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  message_id uuid references public.messages (id) on delete set null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.landlord_blocks (
  unit_id uuid primary key references public.units (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references public.units (id) on delete set null,
  source text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.mailed_notices (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  log_entry_id uuid references public.log_entries (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  receipt_file_id uuid references public.files (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.magic_links (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Local-mode magic links are not used when Supabase Auth sends the email.
-- Keep the table locked down: no anon or authenticated access.

alter table public.profiles enable row level security;
alter table public.units enable row level security;
alter table public.unit_members enable row level security;
alter table public.invites enable row level security;
alter table public.log_entries enable row level security;
alter table public.messages enable row level security;
alter table public.deadlines enable row level security;
alter table public.reminder_sent enable row level security;
alter table public.condition_reports enable row level security;
alter table public.deposits enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.lease_reviews enable row level security;
alter table public.feedback enable row level security;
alter table public.rent_checks enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.files enable row level security;
alter table public.notifications enable row level security;
alter table public.landlord_responses enable row level security;
alter table public.landlord_blocks enable row level security;
alter table public.abuse_reports enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.mailed_notices enable row level security;
alter table public.magic_links enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());

create policy units_select on public.units for select to authenticated using (public.is_unit_member(id));
create policy units_insert on public.units for insert to authenticated with check (created_by = auth.uid());
create policy units_update on public.units for update to authenticated using (public.is_unit_member(id)) with check (public.is_unit_member(id));

create policy unit_members_select on public.unit_members for select to authenticated using (user_id = auth.uid() or public.is_unit_member(unit_id));

create policy invites_select on public.invites for select to authenticated using (public.is_unit_member(unit_id) or created_by = auth.uid());
create policy invites_insert on public.invites for insert to authenticated with check (created_by = auth.uid() and public.is_unit_member(unit_id));

create policy log_entries_all on public.log_entries for all to authenticated using (public.is_unit_member(unit_id)) with check (public.is_unit_member(unit_id) and user_id = auth.uid());

create policy messages_select on public.messages for select to authenticated using (public.is_unit_member(unit_id));
create policy messages_insert on public.messages for insert to authenticated with check (public.is_unit_member(unit_id));

create policy deadlines_all on public.deadlines for all to authenticated using (public.is_unit_member(unit_id)) with check (public.is_unit_member(unit_id));

create policy reminder_sent_select on public.reminder_sent for select to authenticated using (
  exists (select 1 from public.deadlines d where d.id = deadline_id and public.is_unit_member(d.unit_id))
);

create policy condition_reports_all on public.condition_reports for all to authenticated using (public.is_unit_member(unit_id)) with check (public.is_unit_member(unit_id));

create policy deposits_all on public.deposits for all to authenticated using (public.is_unit_member(unit_id)) with check (public.is_unit_member(unit_id));

create policy ledger_all on public.ledger_entries for all to authenticated using (public.is_unit_member(unit_id)) with check (public.is_unit_member(unit_id) and user_id = auth.uid());

create policy lease_reviews_all on public.lease_reviews for all to authenticated using (public.is_unit_member(unit_id)) with check (public.is_unit_member(unit_id) and user_id = auth.uid());

create policy feedback_select on public.feedback for select to authenticated using (user_id = auth.uid());
create policy feedback_insert on public.feedback for insert to authenticated with check (user_id = auth.uid());

create policy rent_checks_all on public.rent_checks for all to authenticated using (public.is_unit_member(unit_id)) with check (public.is_unit_member(unit_id) and user_id = auth.uid());

create policy assistant_select on public.assistant_messages for select to authenticated using (user_id = auth.uid());
create policy assistant_insert on public.assistant_messages for insert to authenticated with check (user_id = auth.uid());

create policy files_select on public.files for select to authenticated using (user_id = auth.uid() or (unit_id is not null and public.is_unit_member(unit_id)));
create policy files_insert on public.files for insert to authenticated with check (user_id = auth.uid());

create policy notifications_all on public.notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy landlord_responses_select on public.landlord_responses for select to authenticated using (public.is_unit_member(unit_id));

create policy landlord_blocks_select on public.landlord_blocks for select to authenticated using (public.is_unit_member(unit_id));

create policy abuse_reports_insert on public.abuse_reports for insert to authenticated with check (unit_id is null or public.is_unit_member(unit_id));

create policy push_all on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy mailed_all on public.mailed_notices for all to authenticated using (public.is_unit_member(unit_id)) with check (public.is_unit_member(unit_id) and user_id = auth.uid());

create policy magic_links_deny on public.magic_links for select to authenticated using (id is null and email is null);
