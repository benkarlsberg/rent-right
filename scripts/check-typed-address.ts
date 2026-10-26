import { randomUUID } from "crypto";
import { signSession } from "@/lib/crypto";
import { deleteUserAccount, getUser } from "@/lib/db";
import { closeSql, getSql } from "@/lib/pg";

function redact(message: string): string {
  const secrets = [process.env.DATABASE_URL ?? "", process.env.AUTH_SECRET ?? ""].filter((item) => item.length >= 4);
  let out = message;
  for (const secret of secrets) out = out.split(secret).join("[redacted]");
  return out.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

function filler(dataType: string): unknown {
  if (dataType === "uuid") return "00000000-0000-0000-0000-000000000000";
  if (dataType === "boolean") return false;
  if (dataType.includes("json")) return "{}";
  if (dataType.includes("timestamp") || dataType === "date") return new Date().toISOString();
  if (dataType.includes("int") || dataType.includes("numeric")) return 0;
  return "";
}

function houseNumber(street: string): string {
  return street.trim().split(/\s+/)[0] || "";
}

async function insertAuthUser(id: string, email: string): Promise<void> {
  const sql = getSql();
  const columns = await sql<{ column_name: string; is_nullable: string; column_default: string | null; data_type: string }[]>`
    select column_name, is_nullable, column_default, data_type
    from information_schema.columns
    where table_schema = 'auth' and table_name = 'users'
  `;
  const values = new Map<string, unknown>([
    ["id", id],
    ["email", email],
    ["role", "authenticated"],
    ["aud", "authenticated"],
    ["email_confirmed_at", new Date().toISOString()],
  ]);
  for (const column of columns) {
    if (values.has(column.column_name)) continue;
    if (column.is_nullable === "NO" && column.column_default == null) values.set(column.column_name, filler(column.data_type));
  }
  const names = [...values.keys()].filter((name) => columns.some((column) => column.column_name === name));
  await sql`insert into auth.users ${sql(Object.fromEntries(names.map((name) => [name, values.get(name)])), ...names)}`;
  const now = new Date().toISOString();
  await sql`
    insert into profiles (id, email, name, locale, phone, created_at)
    values (${id}, ${email}, ${"Address Check"}, 'en', '', ${now})
    on conflict (id) do update set email = excluded.email
  `;
}

async function countColumn(table: string, column: string): Promise<number> {
  if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(column)) return 0;
  const sql = getSql();
  const rows = await sql.unsafe(
    `select count(*)::int as n from public.${table} where nullif(trim(${column}::text), '') is not null`,
  ) as { n: number }[];
  return rows[0]?.n ?? 0;
}

async function accountCounts(): Promise<{ originals: number; autoAccept: number; rewrites: number }> {
  const sql = getSql();
  const columns = await sql<{ table_name: string; column_name: string }[]>`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and (
        column_name ~ '^(typed|original|entered|raw)_(street|address)$'
        or column_name ~ '^(auto_accept|accepted_suggestion|census_street|matched_street)$'
      )
  `;
  let originals = 0;
  let autoAccept = 0;
  for (const column of columns) {
    const n = await countColumn(column.table_name, column.column_name);
    if (/^(auto_accept|accepted_suggestion|census_street|matched_street)$/.test(column.column_name)) autoAccept += n;
    else originals += n;
  }
  const checks = await sql<{ n: number }[]>`
    select count(distinct user_id)::int as n
    from rent_checks
    where jsonb_typeof(input) = 'object'
      and (
        input ? 'typedStreet'
        or input ? 'originalStreet'
        or input ? 'enteredStreet'
        or input ? 'rawStreet'
        or input ? 'typedAddress'
        or input ? 'originalAddress'
      )
  `;
  originals += checks[0]?.n ?? 0;
  return { originals, autoAccept, rewrites: 0 };
}

async function call(token: string, path: string, body?: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const response = await fetch(`https://api.rentrightportal.com/api/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "user-agent": "Mozilla/5.0",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) as Record<string, unknown> : null };
}

async function post(token: string, path: string, body: Record<string, unknown>) {
  return call(token, path, body);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required.");
  const counts = await accountCounts();
  console.log(`recoverable_typed_addresses=${counts.originals}`);
  console.log(`auto_accept_flags=${counts.autoAccept}`);
  console.log(`rewrites_with_stored_original=${counts.rewrites}`);
  const id = randomUUID();
  const email = `address-check-${Date.now()}@example.com`;
  await insertAuthUser(id, email);
  try {
    const user = await getUser(id);
    if (!user) throw new Error("The check account was not created.");
    const token = signSession(user.id);
    const place = await post(token, "place", {
      street: "1604 Dover Ave",
      city: "Thousand Oaks",
      postalCode: "91360",
      region: "CA",
    });
    if (place.status !== 200 || place.json?.inCalifornia !== true) throw new Error("The California address was rejected.");
    const kept = place.json?.kept as { street?: string; city?: string; postalCode?: string } | undefined;
    const suggestion = place.json?.suggestion as { street?: string } | null;
    const keptStreet = String(kept?.street || "");
    if (houseNumber(keptStreet) !== "1604") throw new Error("typed house number was replaced");
    if (suggestion?.street && houseNumber(suggestion.street) === "1600") throw new Error("suggestion used the block range start");
    const saved = await post(token, "unit", {
      street: keptStreet,
      unitNumber: "Apt 2",
      city: String(kept?.city || "Thousand Oaks"),
      postalCode: String(kept?.postalCode || "91360"),
      region: "CA",
      jurisdiction: String(place.json?.jurisdiction || "unsure"),
    });
    if (saved.status !== 200) throw new Error("The typed address could not be saved.");
    const sql = getSql();
    const rows = await sql<{ street: string; unit_number: string }[]>`
      select street, unit_number from units where created_by = ${id}
    `;
    const storedStreet = rows[0]?.street || "";
    const storedUnit = rows[0]?.unit_number || "";
    const houseKept = houseNumber(storedStreet) === "1604" && storedStreet === keptStreet;
    const unitKept = storedUnit === "Apt 2";
    const offered = Boolean(suggestion?.street);
    const differs = offered && houseNumber(String(suggestion?.street)) !== "1604";
    const city = String(kept?.city || "Thousand Oaks");
    const zip = String(kept?.postalCode || "91360");
    const expected = `${keptStreet}, Apt 2\n${city}, CA ${zip}`;
    const shown = String((saved.json?.unit as { address?: string } | undefined)?.address || "");
    const records = await call(token, "records");
    const recordsAddress = String(records.json?.address || "");
    const logged = await post(token, "log", {
      type: "repair",
      severity: "leak",
      description: "The kitchen sink is leaking under the cabinet.",
      sendEmail: false,
    });
    const chat = logged.status === 200 ? await call(token, "chat") : { status: logged.status, json: null };
    const draft = ((chat.json?.items as { draft?: boolean; text?: string }[] | undefined) || []).find((item) => item.draft);
    const draftText = draft?.text || "";
    const displayOk = shown === expected && recordsAddress === expected && !shown.includes("DOVER");
    const draftOk = draftText.includes(expected) && !draftText.includes("DOVER");
    console.log(`address_check in_california=true house_number_kept=${houseKept} suggestion_offered=${offered} suggestion_differs=${differs} unit_kept=${unitKept} address_display_ok=${displayOk} address_draft_ok=${draftOk}`);
    if (!houseKept || !unitKept) throw new Error("saved address did not keep the typed street and unit");
    if (!displayOk || !draftOk) throw new Error("address display is not two lines");
  } finally {
    await deleteUserAccount(id).catch(() => {});
    await closeSql();
  }
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redact(message));
  await closeSql().catch(() => {});
  process.exit(1);
});
