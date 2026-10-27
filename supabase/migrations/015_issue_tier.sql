-- Issue triage. Existing repair rows take a tier from the severity already stored.
-- Policies on log_entries already cover every column.

alter table public.log_entries add column if not exists tier text;

update public.log_entries
set tier = case
  when severity in (
    'no_heat', 'no_water', 'no_electricity', 'gas_leak',
    'sewage', 'flood', 'no_toilet', 'door', 'window', 'co_alarm', 'fire', 'wiring'
  ) then 'urgent'
  else 'routine'
end
where type = 'repair' and tier is null;

alter table public.log_entries drop constraint if exists log_entries_tier_check;
alter table public.log_entries
  add constraint log_entries_tier_check
  check (tier is null or tier in ('routine', 'urgent', 'possible_violation'));
