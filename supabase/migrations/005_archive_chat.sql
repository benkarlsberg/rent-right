alter table public.assistant_messages add column if not exists archived_at timestamptz;

create index if not exists assistant_messages_visible_idx
  on public.assistant_messages (user_id, created_at)
  where archived_at is null;
