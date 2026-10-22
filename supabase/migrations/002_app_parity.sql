-- Columns and tables the app writes that were not in the first Supabase draft,
-- plus foreign keys that keep a shared unit when one roommate deletes an account.

alter table public.log_entries add column if not exists photo_file_id uuid references public.files (id) on delete set null;
alter table public.log_entries add column if not exists event_date date;
alter table public.messages add column if not exists response_token text;
alter table public.condition_reports add column if not exists ack_token text;

create unique index if not exists profiles_email_key on public.profiles (email);
create index if not exists messages_response_token_idx on public.messages (response_token);

create table if not exists public.chat_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  status text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_drafts enable row level security;

-- Keep unit records when a roommate remains. The app moves created_by first.
alter table public.units drop constraint if exists units_created_by_fkey;
alter table public.units
  add constraint units_created_by_fkey foreign key (created_by) references auth.users (id) on delete restrict;

alter table public.log_entries drop constraint if exists log_entries_user_id_fkey;
alter table public.log_entries alter column user_id drop not null;
alter table public.log_entries
  add constraint log_entries_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

alter table public.condition_reports drop constraint if exists condition_reports_user_id_fkey;
alter table public.condition_reports alter column user_id drop not null;
alter table public.condition_reports
  add constraint condition_reports_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

alter table public.ledger_entries drop constraint if exists ledger_entries_user_id_fkey;
alter table public.ledger_entries alter column user_id drop not null;
alter table public.ledger_entries
  add constraint ledger_entries_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

alter table public.lease_reviews drop constraint if exists lease_reviews_user_id_fkey;
alter table public.lease_reviews alter column user_id drop not null;
alter table public.lease_reviews
  add constraint lease_reviews_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

alter table public.rent_checks drop constraint if exists rent_checks_user_id_fkey;
alter table public.rent_checks alter column user_id drop not null;
alter table public.rent_checks
  add constraint rent_checks_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

alter table public.files drop constraint if exists files_user_id_fkey;
alter table public.files alter column user_id drop not null;
alter table public.files
  add constraint files_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

alter table public.mailed_notices drop constraint if exists mailed_notices_user_id_fkey;
alter table public.mailed_notices alter column user_id drop not null;
alter table public.mailed_notices
  add constraint mailed_notices_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

drop policy if exists unit_members_insert on public.unit_members;
drop policy if exists unit_members_delete on public.unit_members;
drop policy if exists units_delete on public.units;
drop policy if exists messages_delete on public.messages;
drop policy if exists files_delete on public.files;
drop policy if exists files_update on public.files;
drop policy if exists assistant_update on public.assistant_messages;
drop policy if exists assistant_delete on public.assistant_messages;
drop policy if exists feedback_delete on public.feedback;
drop policy if exists invites_delete on public.invites;
drop policy if exists landlord_responses_delete on public.landlord_responses;
drop policy if exists landlord_blocks_delete on public.landlord_blocks;
drop policy if exists reminder_sent_all on public.reminder_sent;
drop policy if exists profiles_delete on public.profiles;
drop policy if exists chat_drafts_all on public.chat_drafts;

create policy unit_members_insert on public.unit_members
  for insert to authenticated with check (user_id = auth.uid());
create policy unit_members_delete on public.unit_members
  for delete to authenticated using (user_id = auth.uid() or public.is_unit_member(unit_id));

create policy units_delete on public.units
  for delete to authenticated using (created_by = auth.uid());

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (public.is_unit_member(unit_id) and user_id = auth.uid());

create policy messages_delete on public.messages
  for delete to authenticated using (public.is_unit_member(unit_id));

create policy files_delete on public.files
  for delete to authenticated using (user_id = auth.uid() or (unit_id is not null and public.is_unit_member(unit_id)));
create policy files_update on public.files
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy assistant_update on public.assistant_messages
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy assistant_delete on public.assistant_messages
  for delete to authenticated using (user_id = auth.uid());

create policy feedback_delete on public.feedback
  for delete to authenticated using (user_id = auth.uid());

create policy invites_delete on public.invites
  for delete to authenticated using (created_by = auth.uid() or public.is_unit_member(unit_id));

create policy landlord_responses_delete on public.landlord_responses
  for delete to authenticated using (public.is_unit_member(unit_id));

create policy landlord_blocks_delete on public.landlord_blocks
  for delete to authenticated using (public.is_unit_member(unit_id));

create policy reminder_sent_all on public.reminder_sent
  for all to authenticated
  using (exists (select 1 from public.deadlines d where d.id = deadline_id and public.is_unit_member(d.unit_id)))
  with check (exists (select 1 from public.deadlines d where d.id = deadline_id and public.is_unit_member(d.unit_id)));

create policy profiles_delete on public.profiles
  for delete to authenticated using (id = auth.uid());

create policy chat_drafts_all on public.chat_drafts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant execute on function public.is_unit_member(uuid) to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

do $$
declare
  name text;
begin
  for name in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I force row level security', name);
  end loop;
end $$;
