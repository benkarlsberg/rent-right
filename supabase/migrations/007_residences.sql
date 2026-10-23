-- Residences stay on public.units. These columns mark a move and the lease end.
-- Existing row policies on units and profiles already cover every column.

alter table public.units add column if not exists archived_at timestamptz;
alter table public.units add column if not exists lease_end_date date;
alter table public.units add column if not exists moved_from_unit_id uuid references public.units (id) on delete set null;
alter table public.profiles add column if not exists active_unit_id uuid references public.units (id) on delete set null;

create index if not exists units_moved_from_idx on public.units (moved_from_unit_id);
create index if not exists profiles_active_unit_idx on public.profiles (active_unit_id);
