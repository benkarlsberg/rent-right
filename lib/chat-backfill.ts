import { randomUUID } from "crypto";
import { encryptChatText, isCiphertext } from "@/lib/chat-text";
import { getSql } from "@/lib/pg";

export type ChatBackfillCounts = {
  messagesEncrypted: number;
  messagesAlready: number;
  draftsEncrypted: number;
  draftsAlready: number;
  conversations: number;
  repliesSet: number;
};

type MessageRow = {
  id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: Date | string;
  archived_at: Date | string | null;
  conversation_id: string | null;
  reply_to_id: string | null;
};

function stamp(value: Date | string | null): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function draftPlain(value: unknown): string | null {
  if (typeof value === "string") {
    if (isCiphertext(value)) return null;
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object") return JSON.stringify(parsed);
    } catch {
      // A plain sentence stored as a jsonb string is wrapped below.
    }
    return JSON.stringify({ text: value });
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return null;
}

export async function backfillChat(): Promise<ChatBackfillCounts> {
  const sql = getSql();
  const counts: ChatBackfillCounts = {
    messagesEncrypted: 0,
    messagesAlready: 0,
    draftsEncrypted: 0,
    draftsAlready: 0,
    conversations: 0,
    repliesSet: 0,
  };
  const messages = await sql<MessageRow[]>`
    select id, user_id, role, content, created_at, archived_at, conversation_id, reply_to_id
    from assistant_messages
  `;
  const groups = new Map<string, MessageRow[]>();
  for (const row of messages) {
    const key = `${row.user_id}\0${stamp(row.archived_at)}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  counts.conversations = groups.size;
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const at = stamp(a.created_at).localeCompare(stamp(b.created_at));
      if (at) return at;
      return a.id.localeCompare(b.id);
    });
    const existing = [...new Set(group.map((row) => row.conversation_id).filter((id): id is string => Boolean(id)))];
    const fill = existing[0] ?? randomUUID();
    let lastUser: string | null = null;
    let lastAssistant: string | null = null;
    for (const row of group) {
      const conversationId = row.conversation_id ?? fill;
      const replyTo = row.role === "user" ? lastAssistant : row.role === "assistant" ? lastUser : null;
      if (row.role === "user") lastUser = row.id;
      if (row.role === "assistant") lastAssistant = row.id;
      const already = isCiphertext(row.content);
      if (already) counts.messagesAlready += 1;
      else counts.messagesEncrypted += 1;
      const nextContent = already ? row.content : encryptChatText(row.content);
      const linkChanged = conversationId !== row.conversation_id || (replyTo ?? null) !== (row.reply_to_id ?? null);
      if (already && !linkChanged) continue;
      await sql`
        update assistant_messages
        set content = ${nextContent}, conversation_id = ${conversationId}, reply_to_id = ${replyTo}
        where id = ${row.id}
      `;
      if (linkChanged && (replyTo ?? null) !== (row.reply_to_id ?? null)) counts.repliesSet += 1;
    }
  }

  const drafts = await sql<{ id: string; payload: unknown }[]>`select id, payload from chat_drafts`;
  for (const draft of drafts) {
    const payload = draft.payload;
    if (typeof payload === "string" && isCiphertext(payload)) {
      counts.draftsAlready += 1;
      continue;
    }
    const plain = draftPlain(payload);
    if (plain == null) continue;
    counts.draftsEncrypted += 1;
    await sql`update chat_drafts set payload = ${sql.json(encryptChatText(plain))} where id = ${draft.id}`;
  }
  return counts;
}
