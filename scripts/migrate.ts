import { migrate } from "@/lib/migrate";
import { closeSql } from "@/lib/pg";

function redact(message: string): string {
  const url = process.env.DATABASE_URL ?? "";
  let out = message.split(url).join("[redacted]");
  try {
    const password = decodeURIComponent(new URL(url).password);
    if (password) out = out.split(password).join("[redacted]").split(encodeURIComponent(password)).join("[redacted]");
  } catch {
    // The value is not a URL. Leave the message unchanged.
  }
  return out;
}

migrate()
  .then(async () => {
    console.log("Migrations applied.");
    await closeSql();
  })
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    if (/ENOTFOUND|ENETUNREACH|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|CONNECT_TIMEOUT|no pg_hba|SSL connection|certificate/i.test(message)) {
      console.error("Postgres refused the connection. On Supabase, set DATABASE_URL to the session pooler URI (port 5432). The direct host is often IPv6-only.");
    }
    console.error(redact(message));
    await closeSql();
    process.exit(1);
  });
