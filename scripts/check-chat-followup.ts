import { randomUUID } from "crypto";
import { isCiphertext, readChatText } from "@/lib/chat-text";
import { signSession } from "@/lib/crypto";
import { createUnit, deleteUserAccount, getUser, type UnitInput } from "@/lib/db";
import { closeSql, getSql } from "@/lib/pg";

const FIRST = "The first item was a rent note. The second item is my security deposit.";
const SECOND = "what about the second one?";

function redact(message: string): string {
  const secrets = [process.env.DATABASE_URL ?? "", process.env.DATA_ENCRYPTION_KEY ?? "", process.env.AUTH_SECRET ?? "", FIRST, SECOND].filter((item) => item.length >= 4);
  let out = message;
  for (const secret of secrets) out = out.split(secret).join("[redacted]");
  return out.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

function filler(dataType: string): unknown {
  if (dataType === "uuid") return "00000000-0000-0000-0000-000000000000";
  if (dataType === "boolean") return false;
  if (dataType.includes("json")) return "{}";
  if (dataType.includes("timestamp") || dataType === "date") return new Date().toISOString();
  if (dataType.includes("int") || dataType.includes("numeric")) return 0;
  return "";
}

async function insertAuthUser(id: string, email: string): Promise<void> {
  const sql = getSql();
  const columns = await sql<{ column_name: string; is_nullable: string; column_default: string | null; data_type: string }[]>`
    select column_name, is_nullable, column_default, data_type
    from information_schema.columns
    where table_schema = 'auth' and table_name = 'users'
  `;
  const values = new Map<string, unknown>([
    ["id", id],
    ["email", email],
    ["role", "authenticated"],
    ["aud", "authenticated"],
    ["email_confirmed_at", new Date().toISOString()],
  ]);
  for (const column of columns) {
    if (values.has(column.column_name)) continue;
    if (column.is_nullable === "NO" && column.column_default == null) values.set(column.column_name, filler(column.data_type));
  }
  const names = [...values.keys()].filter((name) => columns.some((column) => column.column_name === name));
  await sql`insert into auth.users ${sql(Object.fromEntries(names.map((name) => [name, values.get(name)])), ...names)}`;
  const now = new Date().toISOString();
  await sql`
    insert into profiles (id, email, name, locale, phone, created_at)
    values (${id}, ${email}, ${"Chat Check"}, 'en', '', ${now})
    on conflict (id) do update set email = excluded.email
  `;
}

function unitInput(): UnitInput {
  return {
    street: "1842 N Echo Park Ave",
    unitNumber: "3",
    city: "Los Angeles",
    postalCode: "90026",
    region: "Los Angeles County",
    jurisdiction: "city_la",
    jurisdictionConfirmed: true,
    rsoStatus: "unsure",
    rstpoTier: "unsure",
    landlordName: "Elena Vasquez",
    landlordEmail: "elena.vasquez@example.com",
    landlordPhone: "",
    rentCents: 215_000,
    depositCents: null,
    moveInDate: "2024-05-01",
    leaseEndDate: null,
  };
}

async function post(token: string, path: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const response = await fetch(`https://api.rentrightportal.com/api/v1/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) as Record<string, unknown> : null };
}

function usedPriorContext(body: Record<string, unknown> | null): boolean {
  const items = Array.isArray(body?.items) ? body.items as { role?: string; ruleId?: string | null; headline?: string; detail?: string; status?: string }[] : [];
  const card = [...items].reverse().find((item) => item.role === "card");
  if (!card) return false;
  return /CA-CC-1950\.5|deposit|depósito/i.test(`${card.ruleId || ""} ${card.headline || ""} ${card.status || ""} ${card.detail || ""}`);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required.");
  if (!process.env.DATA_ENCRYPTION_KEY) throw new Error("DATA_ENCRYPTION_KEY is required.");
  const id = randomUUID();
  const email = `chat-check-${Date.now()}@example.com`;
  await insertAuthUser(id, email);
  try {
    const user = await getUser(id);
    if (!user) throw new Error("The check account was not created.");
    await createUnit(user.id, unitInput());
    const token = signSession(user.id);
    const session = await post(token, "unit", {
      street: "1842 N Echo Park Ave",
      unitNumber: "3",
      city: "Los Angeles",
      postalCode: "90026",
      region: "Los Angeles County",
      jurisdiction: "city_la",
      jurisdictionConfirmed: true,
      landlordName: "Elena Vasquez",
      landlordEmail: "elena.vasquez@example.com",
      rent: "2150",
    });
    if (session.status !== 200) throw new Error(`Unit setup returned ${session.status}.`);
    const first = await post(token, "thread", { text: FIRST });
    const second = await post(token, "thread", { text: SECOND });
    if (first.status !== 200 || second.status !== 200) throw new Error(`Chat returned ${first.status} then ${second.status}.`);
    const rows = await getSql()<{ id: string; role: string; content: string; conversation_id: string | null; reply_to_id: string | null }[]>`
      select id, role, content, conversation_id, reply_to_id
      from assistant_messages
      where user_id = ${user.id}
      order by created_at
    `;
    const conversations = new Set(rows.map((row) => row.conversation_id).filter(Boolean));
    const users = rows.filter((row) => row.role === "user");
    const encrypted = rows.length > 0 && rows.every((row) => isCiphertext(row.content));
    const textsMatch = users.length >= 2 && readChatText(users[0].content) === FIRST && readChatText(users[1].content) === SECOND;
    const linked = Boolean(users[1]?.reply_to_id && rows.some((row) => row.role === "assistant" && row.id === users[1].reply_to_id));
    const sameConversation = conversations.size === 1;
    const prior = usedPriorContext(second.json);
    console.log(`followup_rows: ${rows.length}`);
    console.log(`followup_encrypted: ${encrypted && textsMatch}`);
    console.log(`followup_same_conversation: ${sameConversation}`);
    console.log(`followup_reply_linked: ${linked}`);
    console.log(`followup_used_prior_context: ${prior}`);
    if (!encrypted || !textsMatch || !sameConversation || !linked) process.exitCode = 1;
  } finally {
    await deleteUserAccount(id).catch(() => {});
    await closeSql();
  }
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redact(message));
  await closeSql().catch(() => {});
  process.exit(1);
});
