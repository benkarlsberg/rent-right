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

function serverDur(header: string | null): number | null {
  const match = /app;dur=(\d+)/.exec(header ?? "");
  return match ? Number(match[1]) : null;
}

async function timeOrigin(origin: string, token: string): Promise<{ status: number | "timeout"; ms: number; hasUser: boolean; serverMs: number | null }> {
  const label = origin.includes("api.") ? "api" : "app";
  const started = Date.now();
  try {
    const response = await fetch(`${origin}/api/v1/me`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "user-agent": "Mozilla/5.0",
      },
      signal: AbortSignal.timeout(12_000),
    });
    const ms = Date.now() - started;
    const body = (await response.json().catch(() => null)) as { needsUnit?: boolean; user?: unknown; error?: string } | null;
    const hasUser = Boolean(body?.user);
    const timing = response.headers.get("server-timing");
    console.log(`${label}_status: ${response.status}`);
    console.log(`${label}_ms: ${ms}`);
    console.log(`${label}_needs_unit: ${body?.needsUnit === true}`);
    console.log(`${label}_has_user: ${hasUser}`);
    console.log(`${label}_error: ${body?.error ?? ""}`);
    console.log(`${label}_server_timing: ${timing ?? ""}`);
    console.log(`${label}_placement: ${response.headers.get("cf-placement") ?? ""}`);
    return { status: response.status, ms, hasUser, serverMs: serverDur(timing) };
  } catch (error) {
    const ms = Date.now() - started;
    const message = error instanceof Error ? error.message : "request failed";
    console.log(`${label}_status: timeout`);
    console.log(`${label}_ms: ${ms}`);
    console.log(`${label}_error: ${redact(message)}`);
    return { status: "timeout", ms, hasUser: false, serverMs: null };
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required.");
  const account = await lookup();
  console.log(`phase: ${process.env.ME_PHASE || "check"}`);
  console.log(`found: ${Boolean(account)}`);
  if (!account) throw new Error("No real account was found.");
  console.log(`has_unit: ${account.hasUnit}`);
  const token = signSession(account.id);
  const repeats = 5;
  const apiSamples: { status: number | "timeout"; ms: number; hasUser: boolean; serverMs: number | null }[] = [];
  const bootstrapSamples: { status: number | "timeout"; ms: number; ok: boolean; serverMs: number | null }[] = [];
  for (let sample = 1; sample <= repeats; sample += 1) {
    console.log(`sample: ${sample}`);
    for (const origin of origins) {
      const result = await timeOrigin(origin, token);
      if (origin.includes("api.")) apiSamples.push(result);
    }
    bootstrapSamples.push(await timeBootstrap(token));
  }
  const warmApi = apiSamples.slice(1);
  const warmBootstrap = bootstrapSamples.slice(1);
  const limit = Number(process.env.ME_MAX_MS || "0");
  const serverLimit = Number(process.env.ME_SERVER_MAX_MS || "0");
  const slowApi = warmApi.find((api) => api.status !== 200 || !api.hasUser || api.ms > limit || (serverLimit > 0 && (api.serverMs == null || api.serverMs > serverLimit)));
  if (limit > 0 && (!warmApi.length || slowApi)) {
    throw new Error(`Signed /me was not ready (status ${slowApi?.status ?? "missing"}, ${slowApi?.ms ?? "n/a"} ms, server ${slowApi?.serverMs ?? "n/a"} ms).`);
  }
  const bootstrapLimit = Number(process.env.ME_BOOTSTRAP_MAX_MS || "0");
  const bootstrapServerLimit = Number(process.env.ME_BOOTSTRAP_SERVER_MAX_MS || "0");
  const slowBootstrap = warmBootstrap.find((item) => item.status !== 200 || !item.ok || item.ms > bootstrapLimit || (bootstrapServerLimit > 0 && (item.serverMs == null || item.serverMs > bootstrapServerLimit)));
  if (bootstrapLimit > 0 && (!warmBootstrap.length || slowBootstrap)) {
    throw new Error(`Bootstrap was not ready (status ${slowBootstrap?.status ?? "missing"}, ${slowBootstrap?.ms ?? "n/a"} ms, server ${slowBootstrap?.serverMs ?? "n/a"} ms).`);
  }
}

async function timeBootstrap(token: string): Promise<{ status: number | "timeout"; ms: number; ok: boolean; serverMs: number | null }> {
  const started = Date.now();
  try {
    const response = await fetch("https://api.rentrightportal.com/api/v1/bootstrap", {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "user-agent": "Mozilla/5.0",
      },
      signal: AbortSignal.timeout(12_000),
    });
    const ms = Date.now() - started;
    const timing = response.headers.get("server-timing");
    const body = (await response.json().catch(() => null)) as { thread?: unknown; chat?: unknown; records?: unknown; error?: string } | null;
    const ok = Boolean(body?.thread && body?.chat && body?.records);
    console.log(`bootstrap_status: ${response.status}`);
    console.log(`bootstrap_ms: ${ms}`);
    console.log(`bootstrap_slices: ${ok}`);
    console.log(`bootstrap_error: ${body?.error ?? ""}`);
    console.log(`bootstrap_server_timing: ${timing ?? ""}`);
    console.log(`bootstrap_placement: ${response.headers.get("cf-placement") ?? ""}`);
    return { status: response.status, ms, ok, serverMs: serverDur(timing) };
  } catch (error) {
    const ms = Date.now() - started;
    const message = error instanceof Error ? error.message : "request failed";
    console.log("bootstrap_status: timeout");
    console.log(`bootstrap_ms: ${ms}`);
    console.log(`bootstrap_slices: false`);
    console.log(`bootstrap_error: ${redact(message)}`);
    return { status: "timeout", ms, ok: false, serverMs: null };
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Time check failed.";
  console.error(redact(message));
  process.exit(1);
});
