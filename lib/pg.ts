import { AsyncLocalStorage } from "async_hooks";
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;
type Tx = postgres.TransactionSql;

type Scope = { userId: string | null };

const actors = new AsyncLocalStorage<Scope>();
let pool: Sql | null = null;

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required. Use local Postgres or the Supabase connection string.");
  return url;
}

export function getSql(): Sql {
  if (!pool) {
    pool = postgres(databaseUrl(), {
      max: 8,
      idle_timeout: 20,
      connect_timeout: 15,
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
  return pool;
}

export async function closeSql(): Promise<void> {
  if (pool) {
    await pool.end({ timeout: 5 });
    pool = null;
  }
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

async function execute(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[]; count: number }> {
  const text = placeholders(sql);
  const userId = actors.getStore()?.userId ?? null;
  return getSql().begin(async (tx) => {
    await applyRole(tx, userId);
    const result = await tx.unsafe(text, params as never[]);
    const rows = (result as unknown as Record<string, unknown>[]).map((row) => normalize(row) as Record<string, unknown>);
    return { rows, count: Number((result as { count?: number }).count ?? rows.length) };
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
