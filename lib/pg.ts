import { AsyncLocalStorage } from "async_hooks";
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;
type Tx = postgres.TransactionSql;

type Scope = { userId: string | null };

const actors = new AsyncLocalStorage<Scope>();
const requestClients = new AsyncLocalStorage<Sql>();
let pool: Sql | null = null;

function cloudflareRuntime(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

const connectionHint = "Use the Supabase Postgres URI (direct or session pooler, port 5432).";

export function normalizeDatabaseUrl(raw: string): string {
  const text = unwrapDatabaseUrl(raw);
  if (!text) throw new Error("DATABASE_URL is required. Use local Postgres or the Supabase connection string.");
  const extracted = extractConnection(text, raw);
  const rebuilt = rebuildUserinfo(extracted);
  assertDriverAccepts(rebuilt, raw);
  return withSupabaseSsl(rebuilt);
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required. Use local Postgres or the Supabase connection string.");
  return normalizeDatabaseUrl(url);
}

function createSql(url: string, hyperdrive: boolean): Sql {
  const parsed = new URL(url);
  const transactionPool = !hyperdrive && (parsed.port === "6543" || parsed.searchParams.get("pgbouncer") === "true");
  return postgres(url, {
    max: hyperdrive ? 1 : 8,
    idle_timeout: 20,
    connect_timeout: hyperdrive ? 10 : 20,
    fetch_types: !hyperdrive,
    prepare: hyperdrive ? false : !transactionPool,
    ...(hyperdrive ? { ssl: false as const } : {}),
    onnotice: () => {},
    types: {
      bigint: {
        to: 20,
        from: [20],
        parse: (value: string) => Number(value),
        serialize: (value: number) => String(value),
      },
    },
  });
}

export function getSql(): Sql {
  if (cloudflareRuntime()) {
    const current = requestClients.getStore();
    if (current) return current;
    throw new Error("Database client is not ready.");
  }
  if (!pool) pool = createSql(databaseUrl(), false);
  return pool;
}

async function client(): Promise<Sql> {
  if (!cloudflareRuntime()) return getSql();
  const current = requestClients.getStore();
  if (current) return current;
  const { env } = await import("cloudflare:workers");
  const binding = env.HYPERDRIVE?.connectionString;
  if (!binding) throw new Error("Database binding is not configured.");
  const sql = createSql(binding, true);
  requestClients.enterWith(sql);
  return sql;
}

export async function closeSql(): Promise<void> {
  if (pool) {
    await pool.end({ timeout: 5 });
    pool = null;
  }
}

export function poolerCandidates(password: string, supabaseUrl: string, region: string): string[] {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const pass = encodeURIComponent(password);
  const user = encodeURIComponent(`postgres.${ref}`);
  return [
    `postgresql://${user}:${pass}@aws-0-${region}.pooler.supabase.com:5432/postgres?sslmode=require`,
    `postgresql://${user}:${pass}@aws-1-${region}.pooler.supabase.com:5432/postgres?sslmode=require`,
    `postgresql://postgres:${pass}@db.${ref}.supabase.co:5432/postgres?sslmode=require`,
  ];
}

function unwrapDatabaseUrl(raw: string): string {
  let text = raw.replace(/^\uFEFF/, "").trim();
  for (let i = 0; i < 2; i += 1) {
    text = text.replace(/^(?:export\s+)?DATABASE_URL\s*=\s*/i, "").trim();
    const wrapped = text.match(/^(["'“”])([\s\S]*)\1$/);
    if (wrapped) text = wrapped[2].trim();
  }
  return text.replace(/^jdbc:/i, "").trim();
}

function extractConnection(text: string, raw: string): string {
  if (/^postgres(?:ql)?:\/\//i.test(text)) return text;
  const embedded = text.match(/postgres(?:ql)?:\/\/\S+/i);
  if (embedded) return embedded[0];
  if (/(^|\s)(?:host|user|password)\s*=/i.test(text)) return libpqToUrl(text, raw);
  if (/^https?:\/\//i.test(text)) {
    throw new Error(`DATABASE_URL is an HTTP URL, not a Postgres connection string (${describeDatabaseUrl(raw)}). ${connectionHint}`);
  }
  throw new Error(`DATABASE_URL is not a valid Postgres connection string (${describeDatabaseUrl(raw)}). ${connectionHint}`);
}

function libpqToUrl(text: string, raw: string): string {
  const values = new Map<string, string>();
  const pattern = /([A-Za-z_]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|(\S+))/g;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    for (const match of trimmed.matchAll(pattern)) {
      values.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
    }
  }
  const host = values.get("host");
  const user = values.get("user") ?? values.get("username");
  if (!host || !user) {
    throw new Error(`DATABASE_URL is missing host or user (${describeDatabaseUrl(raw)}). ${connectionHint}`);
  }
  const pass = values.get("password") ?? values.get("pass") ?? "";
  const port = values.get("port") ?? "5432";
  const database = values.get("dbname") ?? values.get("database") ?? "postgres";
  const sslmode = values.get("sslmode");
  const query = sslmode ? `?sslmode=${encodeURIComponent(sslmode)}` : "";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${database}${query}`;
}

function rebuildUserinfo(url: string): string {
  const match = url.match(/^(postgres(?:ql)?):\/\/([\s\S]+)$/i);
  if (!match) return url;
  const scheme = match[1].toLowerCase();
  const rest = match[2];
  const at = rest.lastIndexOf("@");
  if (at === -1) return `${scheme}://${rest}`;
  const userinfo = rest.slice(0, at);
  const after = rest.slice(at + 1);
  const colon = userinfo.indexOf(":");
  const user = colon === -1 ? userinfo : userinfo.slice(0, colon);
  const pass = colon === -1 ? "" : userinfo.slice(colon + 1);
  const encodedUser = encodeURIComponent(safeDecode(user));
  const encodedPass = encodeURIComponent(safeDecode(pass));
  const auth = colon === -1 ? encodedUser : `${encodedUser}:${encodedPass}`;
  return `${scheme}://${auth}@${after}`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function withSupabaseSsl(url: string): string {
  if (!/supabase\.(co|com)/i.test(url)) return url;
  if (/[?&]sslmode=/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
}

function assertDriverAccepts(url: string, raw: string): void {
  try {
    let host = url.slice(url.indexOf("://") + 3).split(/[?/]/)[0];
    host = decodeURIComponent(host.slice(host.indexOf("@") + 1));
    new URL(url.replace(host, host.split(",")[0]));
  } catch {
    throw new Error(`DATABASE_URL is not a valid Postgres connection string (${describeDatabaseUrl(raw)}). ${connectionHint}`);
  }
}

function describeDatabaseUrl(raw: string): string {
  const scheme = raw.trim().match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
  return [
    `length=${raw.length}`,
    `scheme=${scheme ? scheme[1].toLowerCase() : "none"}`,
    `lines=${raw.split(/\r?\n/).length}`,
    `whitespace=${/\s/.test(raw)}`,
    `quotes=${/["'“”]/.test(raw)}`,
    `at=${(raw.match(/@/g) ?? []).length}`,
    `hash=${raw.includes("#")}`,
    `brackets=${/[[\]]/.test(raw)}`,
    `underscore=${raw.includes("_")}`,
    `hyphen=${raw.includes("-")}`,
    `dot=${raw.includes(".")}`,
    `digit=${/\d/.test(raw)}`,
    `sbPrefix=${raw.startsWith("sb_")}`,
    `publishableLabel=${raw === "sb_publishable_"}`,
    `regionLabel=${/^aws-\d-[a-z]+(?:-[a-z]+)*-\d+$/.test(raw)}`,
  ].join(", ");
}

function placeholders(sql: string): string {
  let index = 0;
  let out = "";
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (char === "'") {
      const end = sql.indexOf("'", i + 1);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(i, stop + 1);
      i = stop;
      continue;
    }
    if (char === "?") {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += char;
  }
  return out;
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) {
    if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0) {
      return value.toISOString().slice(0, 10);
    }
    return value.toISOString();
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype) {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalize(item)]));
    }
  }
  return value;
}

export function hasUserActor(): boolean {
  return Boolean(actors.getStore()?.userId);
}

export function adoptActor(userId: string | null) {
  actors.enterWith({ userId });
}

async function applyRole(tx: Tx, userId: string | null) {
  await tx.unsafe("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
  if (userId) await tx.unsafe("set local role authenticated");
}

export async function withActor<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  const current = actors.getStore();
  if (current && current.userId === userId) return fn();
  return actors.run({ userId }, fn);
}

export async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const current = actors.getStore();
  if (current?.userId && current.userId !== userId) {
    throw new Error("You do not have access to that unit.");
  }
  return withActor(userId, fn);
}

function readResult(result: unknown): { rows: Record<string, unknown>[]; count: number } {
  const rows = (result as Record<string, unknown>[]).map((row) => normalize(row) as Record<string, unknown>);
  return { rows, count: Number((result as { count?: number }).count ?? rows.length) };
}

async function execute(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[]; count: number }> {
  const text = placeholders(sql);
  const userId = actors.getStore()?.userId ?? null;
  const db = await client();
  if (!userId) return readResult(await db.unsafe(text, params as never[]));
  return db.begin(async (tx) => {
    await applyRole(tx, userId);
    return readResult(await tx.unsafe(text, params as never[]));
  }) as Promise<{ rows: Record<string, unknown>[]; count: number }>;
}

export async function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await execute(sql, params);
  return result.rows as T[];
}

export async function one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await all<T>(sql, params);
  return rows[0];
}

export async function run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  const result = await execute(sql, params);
  return { changes: result.count };
}
