-- Encrypted file bytes for workers that cannot write a local disk and do not
-- have object storage configured. The blob is inserted only after the matching
-- files row exists, and it is removed with that file.

create table if not exists public.file_blobs (
  id uuid primary key references public.files (id) on delete cascade,
  body bytea not null
);

alter table public.file_blobs enable row level security;

drop policy if exists file_blobs_select on public.file_blobs;
create policy file_blobs_select on public.file_blobs
  for select to authenticated
  using (
    exists (
      select 1 from public.files f
      where f.id = file_blobs.id
        and (f.user_id = auth.uid() or (f.unit_id is not null and public.is_unit_member(f.unit_id)))
    )
  );

drop policy if exists file_blobs_insert on public.file_blobs;
create policy file_blobs_insert on public.file_blobs
  for insert to authenticated
  with check (
    exists (
      select 1 from public.files f
      where f.id = file_blobs.id and f.user_id = auth.uid()
    )
  );

drop policy if exists file_blobs_update on public.file_blobs;
create policy file_blobs_update on public.file_blobs
  for update to authenticated
  using (
    exists (
      select 1 from public.files f
      where f.id = file_blobs.id and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.files f
      where f.id = file_blobs.id and f.user_id = auth.uid()
    )
  );

drop policy if exists file_blobs_delete on public.file_blobs;
create policy file_blobs_delete on public.file_blobs
  for delete to authenticated
  using (
    exists (
      select 1 from public.files f
      where f.id = file_blobs.id
        and (f.user_id = auth.uid() or (f.unit_id is not null and public.is_unit_member(f.unit_id)))
    )
  );

grant select, insert, update, delete on public.file_blobs to authenticated, service_role;
