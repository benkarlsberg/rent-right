import { randomUUID } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/crypto";
import { addLedger, createNamedUser, createUnit, insertLog, insertMessage, saveFile, type UnitInput } from "@/lib/db";
import { handlePhone } from "@/lib/phone-api";
import { getSql } from "@/lib/pg";

const auth = vi.hoisted(() => ({ authorization: "" }));
const portalFlag = process.env.LANDLORD_PORTAL;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === "authorization" ? auth.authorization || null : null),
  }),
}));

afterEach(() => {
  if (portalFlag === undefined) delete process.env.LANDLORD_PORTAL;
  else process.env.LANDLORD_PORTAL = portalFlag;
});

function tokenFor(userId: string) {
  auth.authorization = `Bearer ${signSession(userId)}`;
  return auth.authorization;
}

async function api(userId: string, method: string, path: string, body?: unknown) {
  tokenFor(userId);
  const response = await handlePhone(
    new Request(`http://localhost/api/v1/${path}`, {
      method,
      headers: { authorization: auth.authorization, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    path.split("/").filter(Boolean),
  );
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) as Record<string, unknown> : null, text };
}

async function queryAs(userId: string, sql: string, params: unknown[] = []) {
  return getSql().begin(async (tx) => {
    await tx.unsafe("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await tx.unsafe("set local role authenticated");
    return tx.unsafe(sql, params as never[]);
  });
}

function unitInput(street: string, landlordEmail: string): UnitInput {
  return {
    street,
    unitNumber: "2",
    city: "Los Angeles",
    postalCode: "90026",
    region: "Los Angeles County",
    jurisdiction: "city_la",
    jurisdictionConfirmed: true,
    rsoStatus: "unsure",
    rstpoTier: "unsure",
    landlordName: "Landlord",
    landlordEmail,
    landlordPhone: "",
    rentCents: 180_000,
    depositCents: 180_000,
    moveInDate: "2024-05-01",
    leaseEndDate: null,
  };
}

describe("landlord access", () => {
  it("returns 404 for landlord/me unless LANDLORD_PORTAL is exactly on", async () => {
    const suffix = randomUUID().slice(0, 8);
    const user = await createNamedUser(`flag-${suffix}@example.com`, "Ada Tenant");
    for (const value of [undefined, "", "true", "1", "ON", "On"] as const) {
      if (value === undefined) delete process.env.LANDLORD_PORTAL;
      else process.env.LANDLORD_PORTAL = value;
      const hidden = await api(user.id, "GET", "landlord/me");
      expect(hidden.status).toBe(404);
    }
  });

  it("returns 403 when the signed-in user has no landlord account", async () => {
    process.env.LANDLORD_PORTAL = "on";
    const suffix = randomUUID().slice(0, 8);
    const user = await createNamedUser(`plain-${suffix}@example.com`, "Blair Tenant");
    const denied = await api(user.id, "GET", "landlord/me");
    expect(denied.status).toBe(403);
    expect(JSON.stringify(denied.json)).toMatch(/landlord account/i);
  });

  it("keeps a linked landlord out of the home and blocks links from non-members", async () => {
    process.env.LANDLORD_PORTAL = "on";
    const suffix = randomUUID().slice(0, 8);
    const tenant = await createNamedUser(`home-${suffix}@example.com`, "Ada Tenant");
    const landlord = await createNamedUser(`owner-${suffix}@example.com`, "Logan Owner");
    const outsider = await createNamedUser(`other-${suffix}@example.com`, "Blair Tenant");
    const unit = await createUnit(tenant.id, unitInput(`${suffix} Echo Park Ave`, `land-${suffix}@example.com`));
    await createUnit(outsider.id, unitInput(`${suffix} Sunset Blvd`, `other-land-${suffix}@example.com`));
    const fileId = await saveFile(tenant.id, unit.id, "lease.txt", "text/plain", Buffer.from("tenant-private-lease"));
    await addLedger(tenant.id, unit.id, {
      amountCents: 180_000,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      paidOn: "2026-10-01",
      method: "check",
      notes: `rent-${suffix}`,
      receiptFileId: null,
    });
    await insertLog({
      unitId: unit.id,
      userId: tenant.id,
      type: "repair",
      description: `Private repair ${suffix}`,
      eventDate: "2026-10-01",
    });
    await insertMessage({
      unitId: unit.id,
      userId: tenant.id,
      direction: "outbound",
      fromEmail: "relay@rentright.local",
      toEmail: unit.landlordEmail,
      subject: `Leak ${suffix}`,
      body: `Private note ${suffix}`,
      deliveryStatus: "local_only",
    });
    await getSql()`insert into landlord_accounts (user_id) values (${landlord.id})`;
    await getSql()`
      insert into landlord_links (unit_id, landlord_user_id, invited_email, status)
      values (${unit.id}, ${landlord.id}, ${landlord.email}, 'active')
    `;

    const membership = await getSql()`
      select user_id from unit_members where unit_id = ${unit.id} and user_id = ${landlord.id}
    `;
    expect(membership).toHaveLength(0);

    const memberFlag = await queryAs(landlord.id, "select public.is_unit_member($1) as member", [unit.id]);
    expect(memberFlag[0].member).toBe(false);
    const tenantMember = await queryAs(tenant.id, "select public.is_unit_member($1) as member", [unit.id]);
    expect(tenantMember[0].member).toBe(true);
    const landlordFlag = await queryAs(landlord.id, "select public.is_unit_landlord($1) as landlord", [unit.id]);
    expect(landlordFlag[0].landlord).toBe(true);

    const units = await queryAs(landlord.id, "select id from public.units where id = $1", [unit.id]);
    expect(units).toHaveLength(0);
    const logs = await queryAs(landlord.id, "select id from public.log_entries where unit_id = $1", [unit.id]);
    expect(logs).toHaveLength(0);
    const messages = await queryAs(landlord.id, "select id from public.messages where unit_id = $1", [unit.id]);
    expect(messages).toHaveLength(0);
    const ledger = await queryAs(landlord.id, "select id from public.ledger_entries where unit_id = $1", [unit.id]);
    expect(ledger).toHaveLength(0);
    const files = await queryAs(landlord.id, "select id from public.files where id = $1", [fileId]);
    expect(files).toHaveLength(0);

    const stored = await getSql()`
      select
        (select count(*)::int from log_entries where unit_id = ${unit.id}) as logs,
        (select count(*)::int from messages where unit_id = ${unit.id}) as messages,
        (select count(*)::int from ledger_entries where unit_id = ${unit.id}) as ledger,
        (select count(*)::int from files where id = ${fileId}) as files
    `;
    expect(stored[0].logs).toBeGreaterThan(0);
    expect(stored[0].messages).toBeGreaterThan(0);
    expect(stored[0].ledger).toBeGreaterThan(0);
    expect(stored[0].files).toBeGreaterThan(0);

    const me = await api(landlord.id, "GET", "landlord/me");
    expect(me.status).toBe(200);
    const meText = JSON.stringify(me.json);
    expect(meText.toLowerCase()).not.toContain(unit.street.toLowerCase());
    expect(meText).not.toContain(`Private repair ${suffix}`);
    expect(meText).not.toContain(`Private note ${suffix}`);
    expect(meText).not.toContain(tenant.email);
    const links = me.json?.links as { unitId: string; status: string }[];
    expect(links).toEqual([expect.objectContaining({ unitId: unit.id, status: "active" })]);

    await expect(queryAs(
      landlord.id,
      "insert into public.landlord_links (unit_id, landlord_user_id, invited_email, status) values ($1, $2, $3, 'active')",
      [unit.id, outsider.id, outsider.email],
    )).rejects.toThrow(/row-level security/i);
    await expect(queryAs(
      outsider.id,
      "insert into public.landlord_links (unit_id, landlord_user_id, invited_email, status) values ($1, $2, $3, 'active')",
      [unit.id, outsider.id, outsider.email],
    )).rejects.toThrow(/row-level security/i);

    const created = await queryAs(
      tenant.id,
      "insert into public.landlord_links (unit_id, landlord_user_id, invited_email, status) values ($1, $2, $3, 'active') returning id",
      [unit.id, outsider.id, outsider.email],
    );
    expect(created).toHaveLength(1);
  });
});
