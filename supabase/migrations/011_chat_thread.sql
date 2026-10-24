-- Two ids per chat row: which conversation it belongs to, and which message it answers.
-- Clearing a chat archives the rows. The next message starts a new conversation id.

alter table public.assistant_messages add column if not exists conversation_id uuid;
alter table public.assistant_messages add column if not exists reply_to_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assistant_messages_reply_to_id_fkey'
  ) then
    alter table public.assistant_messages
      add constraint assistant_messages_reply_to_id_fkey
      foreign key (reply_to_id) references public.assistant_messages (id) on delete set null;
  end if;
end $$;

create index if not exists assistant_messages_conversation_idx
  on public.assistant_messages (conversation_id, created_at);
