import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const name = "rent-right-db";
const permission = "The API token needs Account → Hyperdrive → Edit and Account → SSL and Certificates → Edit.";

type CfError = { code?: number; message?: string };
type CfBody = {
  success?: boolean;
  errors?: CfError[];
  result?: { id?: string; name?: string; ca?: boolean }[] | { id?: string };
};

export type DatabaseOrigin = {
  database: string;
  host: string;
  password: string;
  port: number;
  scheme: "postgres";
  user: string;
};

function redact(message: string): string {
  let out = message;
  for (const secret of [process.env.DATABASE_URL, process.env.CLOUDFLARE_API_TOKEN, process.env.CLOUDFLARE_ACCOUNT_ID, process.env.SUPABASE_URL]) {
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://[redacted]@");
}

function errorText(body: CfBody, status: number): string {
  const errors = body.errors ?? [];
  if (!errors.length) return `HTTP ${status}`;
  return errors.map((error) => `${error.code ?? status} ${error.message ?? ""}`.trim()).join("; ");
}

function failed(body: CfBody, status: number, action: string): Error {
  const detail = errorText(body, status);
  const auth = status === 401 || status === 403 || /auth|permission|not authorized/i.test(detail);
  return new Error(`${action}: ${detail}.${auth ? ` ${permission}` : ""}`);
}

export function databaseOrigins(databaseUrl: string, supabaseUrl?: string): DatabaseOrigin[] {
  const parsed = new URL(databaseUrl);
  const password = decodeURIComponent(parsed.password);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "") || "postgres");
  const pooler: DatabaseOrigin = {
    database,
    host: parsed.hostname,
    password,
    port: Number(parsed.port || 5432),
    scheme: "postgres",
    user: decodeURIComponent(parsed.username),
  };
  const origins: DatabaseOrigin[] = [];
  if (supabaseUrl) {
    let ref = "";
    try {
      ref = new URL(supabaseUrl).hostname.split(".")[0] ?? "";
    } catch {
      ref = "";
    }
    if (ref && ref !== "localhost" && ref !== "127") {
      origins.push({ database, host: `db.${ref}.supabase.co`, password, port: 5432, scheme: "postgres", user: "postgres" });
    }
  }
  const same = origins.some((item) => item.host === pooler.host && item.port === pooler.port && item.user === pooler.user);
  if (!same) origins.push(pooler);
  return origins;
}

async function cf(url: string, token: string, init?: RequestInit): Promise<{ status: number; body: CfBody }> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as CfBody;
  return { status: response.status, body };
}

async function certificateId(accountId: string, token: string, certName: string, pemPath: string): Promise<string> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/mtls_certificates`;
  const listed = await cf(endpoint, token);
  if (!listed.body.success) throw failed(listed.body, listed.status, "Certificate list failed");
  const configs = Array.isArray(listed.body.result) ? listed.body.result : [];
  const existing = configs.find((item) => item.name === certName);
  if (existing?.id) return existing.id;
  const certificates = readFileSync(pemPath, "utf8").trim();
  const created = await cf(endpoint, token, { method: "POST", body: JSON.stringify({ ca: true, name: certName, certificates }) });
  if (!created.body.success || Array.isArray(created.body.result) || !created.body.result?.id) {
    throw failed(created.body, created.status, "Supabase certificate upload failed");
  }
  console.log(`Uploaded ${certName}.`);
  return created.body.result.id;
}

async function saveBinding(id: string): Promise<void> {
  const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8")) as { hyperdrive?: { binding: string; id: string }[] };
  config.hyperdrive = [{ binding: "HYPERDRIVE", id }];
  writeFileSync("wrangler.jsonc", `${JSON.stringify(config, null, 2)}\n`);
}

async function connectOrigin(
  endpoint: string,
  token: string,
  existingId: string | undefined,
  origin: DatabaseOrigin,
  caCertificateId: string,
): Promise<string> {
  const payload = {
    name,
    origin,
    caching: { disabled: true },
    origin_connection_limit: 5,
    mtls: { ca_certificate_id: caCertificateId, sslmode: "verify-full" },
  };
  const target = existingId ? `${endpoint}/${existingId}` : endpoint;
  const method = existingId ? "PUT" : "POST";
  const saved = await cf(target, token, { method, body: JSON.stringify(payload) });
  if (!saved.body.success || Array.isArray(saved.body.result) || !saved.body.result?.id) {
    throw failed(saved.body, saved.status, `Hyperdrive was not saved for ${origin.host}`);
  }
  return saved.body.result.id;
}

async function main(): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!accountId || !token || !databaseUrl) throw new Error("Cloudflare credentials and DATABASE_URL are required.");
  const origins = databaseOrigins(databaseUrl, process.env.SUPABASE_URL);
  const certDir = path.join("scripts", "certs");
  const certificates = [
    ["supabase-intermediate-2021", "supabase-intermediate-2021.pem"],
    ["supabase-root-2021", "supabase-root-2021.pem"],
  ] as const;
  const caIds: string[] = [];
  let lastError = "Hyperdrive did not connect.";
  for (const [certName, file] of certificates) {
    try {
      const id = await certificateId(accountId, token, certName, path.join(certDir, file));
      if (!caIds.includes(id)) caIds.push(id);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (/SSL and Certificates|Hyperdrive → Edit/.test(lastError)) throw error;
      console.log(`${certName} was not accepted. Trying the other Supabase certificate.`);
    }
  }
  if (!caIds.length) throw new Error(lastError);
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/hyperdrive/configs`;
  const listed = await cf(endpoint, token);
  if (!listed.body.success) throw failed(listed.body, listed.status, "Hyperdrive list failed");
  const configs = Array.isArray(listed.body.result) ? listed.body.result : [];
  let existingId = configs.find((config) => config.name === name)?.id;
  for (const caCertificateId of caIds) {
    for (const origin of origins) {
      try {
        const id = await connectOrigin(endpoint, token, existingId, origin, caCertificateId);
        existingId = id;
        await saveBinding(id);
        console.log(`Bound HYPERDRIVE to ${origin.host}.`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (/SSL and Certificates|Hyperdrive → Edit/.test(lastError)) throw error;
        console.log(`Hyperdrive could not use ${origin.host}. Trying the next host.`);
      }
    }
  }
  throw new Error(lastError);
}

if (process.env.VITEST !== "true") {
  main().catch((error: unknown) => {
    console.error(redact(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  });
}
