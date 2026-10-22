import { migrate } from "@/lib/migrate";
import { closeSql } from "@/lib/pg";

migrate()
  .then(async () => {
    console.log("Migrations applied.");
    await closeSql();
  })
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOTFOUND|ENETUNREACH|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|CONNECT_TIMEOUT|no pg_hba|SSL connection|certificate/i.test(message)) {
      console.error("Postgres refused the connection. On Supabase, set DATABASE_URL to the session pooler URI (port 5432). The direct host is often IPv6-only.");
    }
    console.error(error);
    await closeSql();
    process.exit(1);
  });
