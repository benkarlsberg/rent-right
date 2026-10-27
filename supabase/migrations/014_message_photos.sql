alter table public.photos add column if not exists message_id uuid;

create index if not exists photos_message_idx on public.photos (message_id);
