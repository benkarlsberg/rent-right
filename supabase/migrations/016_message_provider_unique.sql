create unique index if not exists messages_provider_id_key
  on public.messages (provider_id)
  where provider_id is not null and provider_id <> '';
