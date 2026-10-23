alter table public.magic_links add column if not exists provider_token text;
alter table public.magic_links add column if not exists provider_hash text;

create index if not exists magic_links_provider_hash_idx on public.magic_links (provider_hash);
