create unique index if not exists messages_one_repair_draft
  on public.messages (log_entry_id)
  where delivery_status = 'draft' and log_entry_id is not null;
