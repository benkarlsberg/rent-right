import { writeFileSync } from "fs";
import { BlockList } from "node:net";
import { resolve6 } from "node:dns/promises";
import postgres from "postgres";
import { normalizeDatabaseUrl, poolerCandidates } from "@/lib/pg";

const regions = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "sa-east-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-central-1",
  "eu-central-2",
  "eu-north-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-east-1",
];

function redact(message: string, secrets: string[]): string {
  let out = message;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    out = out.split(secret).join("[redacted]");
    out = out.split(encodeURIComponent(secret)).join("[redacted]");
  }
  return out;
}

function authRejected(message: string): boolean {
  return /password authentication failed|28P01/i.test(message);
}

function tryAnotherHost(message: string): boolean {
  return /ENOTFOUND|ENETUNREACH|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|CONNECT_TIMEOUT|EHOSTUNREACH|Tenant or user not found|no pg_hba|timeout/i.test(message);
}

async function probe(url: string): Promise<string | null> {
  const sql = postgres(url, { max: 1, connect_timeout: 8, prepare: false, idle_timeout: 1, onnotice: () => {} });
  try {
    await sql`select 1 as ok`;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

async function regionFor(projectRef: string): Promise<string> {
  let ip = "";
  try {
    const ips = await resolve6(`db.${projectRef}.supabase.co`);
    ip = ips[0] ?? "";
  } catch {
    return "us-east-1";
  }
  if (!ip) return "us-east-1";
  const response = await fetch("https://ip-ranges.amazonaws.com/ip-ranges.json");
  if (!response.ok) return "us-east-1";
  const data = (await response.json()) as { ipv6_prefixes?: { ipv6_prefix: string; region: string; service: string }[] };
  let best: { region: string; bits: number } | null = null;
  for (const prefix of data.ipv6_prefixes ?? []) {
    if (prefix.service !== "EC2") continue;
    const [base, bitsText] = prefix.ipv6_prefix.split("/");
    const bits = Number(bitsText);
    if (!base || !Number.isFinite(bits)) continue;
    const list = new BlockList();
    try {
      list.addSubnet(base, bits, "ipv6");
    } catch {
      continue;
    }
    if (!list.check(ip, "ipv6")) continue;
    if (!best || bits > best.bits) best = { region: prefix.region, bits };
  }
  return best?.region ?? "us-east-1";
}

async function main(): Promise<void> {
  const raw = process.env.DATABASE_URL ?? "";
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  if (!raw) throw new Error("DATABASE_URL is required.");

  let urls: string[] = [];
  try {
    urls = [normalizeDatabaseUrl(raw)];
  } catch {
    if (!supabaseUrl.includes("supabase.co")) {
      throw new Error("DATABASE_URL is not a Postgres URI. Set the Supabase session pooler URI (port 5432).");
    }
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    const region = await regionFor(ref);
    console.log(`Database region ${region}.`);
    const primary = poolerCandidates(raw.trim(), supabaseUrl, region);
    const extras = regions
      .filter((item) => item !== region)
      .flatMap((item) => poolerCandidates(raw.trim(), supabaseUrl, item).slice(0, 2));
    urls = [...primary, ...extras];
  }

  let sawAuthFailure = false;
  const primaryCount = Math.min(urls.length, urls.length === 1 ? 1 : 3);
  for (let index = 0; index < urls.length; index += 1) {
    if (index >= primaryCount && sawAuthFailure) break;
    const url = urls[index];
    const host = new URL(url).host;
    console.log(`Checking database host ${host}.`);
    const failure = await probe(url);
    if (!failure) {
      writeFileSync(".database-url", url, { mode: 0o600 });
      console.log("Database connection is usable.");
      return;
    }
    const safe = redact(failure, [raw, url]);
    console.log(`Database host ${host} failed: ${safe}`);
    if (authRejected(failure)) sawAuthFailure = true;
    else if (!tryAnotherHost(failure) && index + 1 >= primaryCount) break;
  }

  if (sawAuthFailure) {
    throw new Error("The database rejected DATABASE_URL. Set it to the Supabase session pooler URI on port 5432.");
  }
  throw new Error("Could not open a Postgres connection. Set DATABASE_URL to the Supabase session pooler URI on port 5432.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(message, [process.env.DATABASE_URL ?? ""]));
    process.exit(1);
  });
