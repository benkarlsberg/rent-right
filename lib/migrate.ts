import { readdirSync, readFileSync } from "fs";
import path from "path";
import { getSql } from "@/lib/pg";

const root = process.cwd();

async function authUidExists(): Promise<boolean> {
  const sql = getSql();
  const rows = await sql<{ ok: boolean }[]>`
    select exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'auth' and p.proname = 'uid'
    ) as ok
  `;
  return Boolean(rows[0]?.ok);
}

export async function migrate(): Promise<void> {
  const sql = getSql();
  await sql.unsafe("create schema if not exists meta");
  await sql.unsafe("create table if not exists meta.schema_migrations (id text primary key, applied_at timestamptz not null default now())");
  if (!(await authUidExists())) {
    const local = readFileSync(path.join(root, "supabase/local/00_auth.sql"), "utf8");
    await sql.unsafe(local);
  }
  const dir = path.join(root, "supabase/migrations");
  const files = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    const seen = await sql<{ id: string }[]>`select id from meta.schema_migrations where id = ${file}`;
    if (seen.length) continue;
    await sql.unsafe(readFileSync(path.join(dir, file), "utf8"));
    await sql`insert into meta.schema_migrations (id) values (${file})`;
  }
}

export async function resetDatabase(): Promise<void> {
  const sql = getSql();
  await sql.unsafe("drop schema if exists public cascade");
  await sql.unsafe("drop schema if exists storage cascade");
  await sql.unsafe("drop schema if exists meta cascade");
  await sql.unsafe("create schema public");
  await sql.unsafe("drop schema if exists auth cascade");
  await migrate();
}
