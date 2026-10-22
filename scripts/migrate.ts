import { migrate } from "@/lib/migrate";
import { closeSql } from "@/lib/pg";

function secretShape(name: string, value: string | undefined): string {
  if (!value) return `${name}: empty`;
  const trimmed = value.trim();
  if (/^postgres(?:ql)?:\/\//i.test(trimmed)) {
    const at = trimmed.lastIndexOf("@");
    const after = at === -1 ? "" : trimmed.slice(at + 1);
    const host = after.split(/[/?]/)[0];
    return `${name}: postgres-url len=${value.length} host=${host}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return `${name}: http-url len=${value.length} host=${new URL(trimmed).host}`;
    } catch {
      return `${name}: http-invalid len=${value.length}`;
    }
  }
  if (trimmed.startsWith("sb_publishable_")) return `${name}: sb-publishable len=${value.length}`;
  if (trimmed.startsWith("sb_secret_")) return `${name}: sb-secret len=${value.length}`;
  if (trimmed.startsWith("sb_")) return `${name}: sb-other len=${value.length}`;
  return `${name}: opaque len=${value.length}`;
}

console.log(
  [
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "DATA_ENCRYPTION_KEY",
    "AUTH_SECRET",
  ]
    .map((name) => secretShape(name, process.env[name]))
    .join("\n"),
);

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
