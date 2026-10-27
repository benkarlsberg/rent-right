import dns from "node:dns/promises";
import postgres from "postgres";
import { lookupProviderDelivery } from "@/lib/email";

function redact(value: string): string {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]").replace(/postgres(?:ql)?:\/\/\S+/gi, "[url]");
}

function addressOk(value: string | null): boolean {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("outbound-report no-database");
    return;
  }
  const sql = postgres(url, { ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : "require", max: 1 });
  try {
    const rows = await sql<{
      delivery_status: string;
      delivery_detail: string | null;
      provider_id: string | null;
      to_email: string;
      cc_email: string | null;
    }[]>`
      select delivery_status, delivery_detail, provider_id, to_email, cc_email
      from messages
      where direction = 'outbound' and subject ilike ${"%Carmel Creek%"} and created_at > now() - interval '3 days'
      order by created_at desc
      limit 3
    `;
    console.log(`outbound-report matches=${rows.length}`);
    for (const row of rows) {
      const looked = row.provider_id ? await lookupProviderDelivery(row.provider_id) : null;
      const same = Boolean(row.cc_email && row.to_email.trim().toLowerCase() === row.cc_email.trim().toLowerCase());
      console.log(`outbound-report status=${row.delivery_status} detail=${redact(row.delivery_detail || "")} to_ok=${addressOk(row.to_email)} cc_ok=${addressOk(row.cc_email)} same=${same} provider=${row.provider_id ? "yes" : "no"} resend=${looked ? `${looked.status} ${redact(looked.detail)}` : "none"}`);
    }
    const units = await sql<{ landlord_email: string | null }[]>`
      select landlord_email from units where street ilike ${"%Carmel Creek%"} limit 3
    `;
    for (const unit of units) {
      const email = (unit.landlord_email || "").trim();
      const domain = email.split("@")[1]?.toLowerCase() || "";
      let mx = "skip";
      if (domain && !domain.includes(" ") && !domain.includes("/")) {
        try {
          mx = (await dns.resolveMx(domain)).length ? "yes" : "no";
        } catch {
          mx = "no";
        }
      }
      console.log(`outbound-report landlord_email_ok=${addressOk(email)} mx=${mx}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "error";
  console.log(`outbound-report failed ${redact(message)}`);
});
