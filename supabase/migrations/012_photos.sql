create table if not exists public.photos (
  id uuid primary key,
  unit_id uuid not null references public.units (id) on delete cascade,
  user_id uuid,
  file_id uuid not null,
  room text,
  caption text,
  link text not null default 'none',
  log_id uuid,
  report_id uuid,
  created_at timestamptz not null default now(),
  constraint photos_link_check check (link in ('move_in', 'move_out', 'issue', 'none'))
);

create index if not exists photos_unit_idx on public.photos (unit_id, created_at desc);
create index if not exists photos_log_idx on public.photos (log_id);

alter table public.photos enable row level security;

drop policy if exists photos_all on public.photos;
create policy photos_all on public.photos
  for all to authenticated
  using (public.is_unit_member(unit_id))
  with check (public.is_unit_member(unit_id));

grant select, insert, update, delete on public.photos to authenticated, service_role;

-- Move-in and move-out rows with no photo are not records.
delete from public.condition_reports
where not exists (
  select 1
  from jsonb_array_elements(case when jsonb_typeof(rooms) = 'array' then rooms else '[]'::jsonb end) as room
  where coalesce(room->>'photoFileId', '') <> ''
);
