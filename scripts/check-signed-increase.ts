import postgres from "postgres";
import { signSession } from "@/lib/crypto";
import { normalizeDatabaseUrl } from "@/lib/pg";
import { DEMO_EMAIL } from "@/lib/sample";

const PROBE = "rr-live-increase";
const TITLES = new Set(["Above the cap", "Within the cap", "Not sure"]);

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
  return out.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

async function lookup(sql: postgres.Sql): Promise<{ id: string; hasUnit: boolean }> {
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
  if (!row) throw new Error("No real account was found.");
  return { id: row.id, hasUnit: Boolean(row.has_unit) };
}

type IncreaseBody = {
  lowest?: string;
  result?: { title?: string; subtitle?: string; ruleId?: string | null } | null;
  error?: string;
};

async function postIncrease(token: string, claimsExemption: boolean): Promise<IncreaseBody & { status: number }> {
  const response = await fetch("https://api.rentrightportal.com/api/v1/increase", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
    },
    body: JSON.stringify({
      lowest: "2150",
      proposed: "2500",
      effectiveDate: "2026-10-12",
      noticeDate: "2026-09-01",
      claimsExemption,
      probe: PROBE,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json().catch(() => null)) as IncreaseBody | null;
  return { status: response.status, ...(body ?? {}) };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required.");
  const sql = postgres(normalizeDatabaseUrl(process.env.DATABASE_URL), {
    max: 1,
    connect_timeout: 15,
    prepare: false,
    idle_timeout: 1,
    onnotice: () => {},
  });
  let userId = "";
  try {
    const account = await lookup(sql);
    userId = account.id;
    console.log(`found: true`);
    console.log(`has_unit: ${account.hasUnit}`);
    if (!account.hasUnit) throw new Error("The account has no unit.");
    const token = signSession(account.id);
    const plain = await postIncrease(token, false);
    const exempt = await postIncrease(token, true);
    const title = plain.result?.title ?? "";
    const exemptTitle = exempt.result?.title ?? "";
    console.log(`increase_status: ${plain.status}`);
    console.log(`increase_title: ${title}`);
    console.log(`increase_subtitle: ${plain.result?.subtitle ?? ""}`);
    console.log(`increase_rule: ${plain.result?.ruleId ?? ""}`);
    console.log(`increase_error: ${plain.error ?? ""}`);
    console.log(`exempt_status: ${exempt.status}`);
    console.log(`exempt_title: ${exemptTitle}`);
    console.log(`exempt_rule: ${exempt.result?.ruleId ?? ""}`);
    if (plain.status !== 200 || !TITLES.has(title)) {
      throw new Error(`Rent increase check was not ready (status ${plain.status}, title ${title || "missing"}).`);
    }
    if ((title === "Above the cap" || title === "Within the cap") && !plain.result?.ruleId) {
      throw new Error("A decided rent check did not quote a rule id.");
    }
    if (exempt.status !== 200 || exemptTitle !== title) {
      throw new Error("A claimed exemption changed the rent-check result.");
    }
  } finally {
    let cleaned = 0;
    if (userId) {
      const removed = await sql<{ id: string }[]>`
        delete from rent_checks
        where user_id = ${userId}::uuid
          and input::text like ${"%" + PROBE + "%"}
        returning id
      `.catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "cleanup failed";
        console.log(`cleanup_error: ${redact(message)}`);
        return [];
      });
      cleaned = removed.length;
    }
    console.log(`cleaned: ${cleaned}`);
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Increase check failed.";
  console.error(redact(message));
  process.exit(1);
});
