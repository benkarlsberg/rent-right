-- Tenant resolution of a repair request. Existing log_entries policies already
-- cover every column, so row level security stays as it is.

alter table public.log_entries add column if not exists status text not null default 'open';
alter table public.log_entries add column if not exists resolved_at timestamptz;
alter table public.log_entries add column if not exists resolved_by text;
alter table public.log_entries add column if not exists resolution_note text;

alter table public.log_entries drop constraint if exists log_entries_status_check;
alter table public.log_entries
  add constraint log_entries_status_check check (status in ('open', 'pending_confirm', 'resolved'));

alter table public.log_entries drop constraint if exists log_entries_resolved_by_check;
alter table public.log_entries
  add constraint log_entries_resolved_by_check check (resolved_by is null or resolved_by in ('tenant', 'landlord'));
