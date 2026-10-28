-- Homes outside California are stored and usable. supported stays true for existing rows.
alter table public.units add column if not exists supported boolean not null default true;
