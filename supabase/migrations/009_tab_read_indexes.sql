-- Tab reads filter by unit and look up the latest log version. These indexes
-- match those queries. The membership lookup in primaryUnit filters by user.
create index if not exists unit_members_user_idx on public.unit_members (user_id);
create index if not exists log_entries_unit_idx on public.log_entries (unit_id, event_date desc, created_at desc);
create index if not exists log_entries_version_idx on public.log_entries (version_group, version desc);
create index if not exists messages_unit_created_idx on public.messages (unit_id, created_at);
create index if not exists deadlines_unit_due_idx on public.deadlines (unit_id, due_date);
