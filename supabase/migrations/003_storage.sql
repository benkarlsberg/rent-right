-- Encrypted tenant files live in the private `tenant-files` bucket.
-- Object names are `{user_id}/{file_id}`. The app still encrypts bytes before upload.
-- Skipped quietly when this database has no Supabase storage catalog.

do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('tenant-files', 'tenant-files', false)
  on conflict (id) do nothing;

  execute 'alter table storage.objects enable row level security';
  execute 'alter table storage.buckets enable row level security';

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tenant_files_select') then
    create policy tenant_files_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'tenant-files'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tenant_files_insert') then
    create policy tenant_files_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'tenant-files'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tenant_files_delete') then
    create policy tenant_files_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'tenant-files'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'buckets' and policyname = 'tenant_files_bucket_read') then
    create policy tenant_files_bucket_read on storage.buckets
      for select to authenticated
      using (id = 'tenant-files');
  end if;
exception
  when insufficient_privilege then
    raise notice 'storage policies were left unchanged';
end $$;
