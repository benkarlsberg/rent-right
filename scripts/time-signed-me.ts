import postgres from "postgres";
import { signSession } from "@/lib/crypto";
import { normalizeDatabaseUrl } from "@/lib/pg";
import { DEMO_EMAIL } from "@/lib/sample";

const origins = ["https://api.rentrightportal.com", "https://app.rentrightportal.com"];

function redact(message: string): string {
  const secrets = [process.env.DATABASE_URL ?? "", process.env.AUTH_SECRET ?? ""].filter((item) => item.length >= 4);
  let out = message;
  for (const secret of secrets) {
    out = out.split(secret).join("[redacted]");
    try {
      out = out.split(encodeURIComponent(secret)).join("[redacted]");
    } catch {
      // The secret is not a URI component.
    }
  }
  return out.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]");
}

async function lookup(): Promise<{ id: string; hasUnit: boolean } | null> {
  const sql = postgres(normalizeDatabaseUrl(process.env.DATABASE_URL ?? ""), {
    max: 1,
    connect_timeout: 15,
    prepare: false,
    idle_timeout: 1,
    onnotice: () => {},
  });
  try {
    const preferred = process.env.ACCOUNT_EMAIL?.trim().toLowerCase();
    const rows = preferred
      ? await sql<{ id: string; has_unit: boolean }[]>`
          select p.id, exists(select 1 from unit_members m where m.user_id = p.id) as has_unit
          from profiles p
          where lower(p.email) = ${preferred}
          limit 1
        `
      : await sql<{ id: string; has_unit: boolean }[]>`
          select p.id, exists(select 1 from unit_members m where m.user_id = p.id) as has_unit
          from profiles p
          where p.email <> ${DEMO_EMAIL}
          order by exists(select 1 from unit_members m where m.user_id = p.id) desc, p.created_at desc
          limit 1
        `;
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, hasUnit: Boolean(row.has_unit) };
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

async function timeOrigin(origin: string, token: string): Promise<void> {
  const label = origin.includes("api.") ? "api" : "app";
  const started = Date.now();
  try {
    const response = await fetch(`${origin}/api/v1/me`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "user-agent": "Mozilla/5.0",
      },
      signal: AbortSignal.timeout(20_000),
    });
    const ms = Date.now() - started;
    const body = (await response.json().catch(() => null)) as { needsUnit?: boolean; user?: unknown; error?: string } | null;
    console.log(`${label}_status: ${response.status}`);
    console.log(`${label}_ms: ${ms}`);
    console.log(`${label}_needs_unit: ${body?.needsUnit === true}`);
    console.log(`${label}_has_user: ${Boolean(body?.user)}`);
    console.log(`${label}_error: ${body?.error ?? ""}`);
    console.log(`${label}_server_timing: ${response.headers.get("server-timing") ?? ""}`);
  } catch (error) {
    const ms = Date.now() - started;
    const message = error instanceof Error ? error.message : "request failed";
    console.log(`${label}_status: timeout`);
    console.log(`${label}_ms: ${ms}`);
    console.log(`${label}_error: ${redact(message)}`);
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required.");
  const account = await lookup();
  console.log(`found: ${Boolean(account)}`);
  if (!account) throw new Error("No real account was found.");
  console.log(`has_unit: ${account.hasUnit}`);
  const token = signSession(account.id);
  for (const origin of origins) await timeOrigin(origin, token);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Time check failed.";
  console.error(redact(message));
  process.exit(1);
});
