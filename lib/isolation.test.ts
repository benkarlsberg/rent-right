import { randomUUID } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as fileGet } from "@/app/api/files/[id]/route";
import { signSession } from "@/lib/crypto";
import { addLedger, createNamedUser, createUnit, insertLog, insertMessage, saveFile, type UnitInput } from "@/lib/db";
import { handlePhone } from "@/lib/phone-api";
import { getSql } from "@/lib/pg";

const auth = vi.hoisted(() => ({ authorization: "" }));

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

describe("tenant isolation", () => {
  it("keeps user B from reading or writing user A's records through the API and through RLS", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userA = await createNamedUser(`a-${suffix}@example.com`, "Ada Tenant");
    const userB = await createNamedUser(`b-${suffix}@example.com`, "Blair Tenant");
    const unitA = await createUnit(userA.id, unitInput(`${suffix} Echo Park Ave`, `land-a-${suffix}@example.com`));
    const unitB = await createUnit(userB.id, unitInput(`${suffix} Sunset Blvd`, `land-b-${suffix}@example.com`));
    const fileId = await saveFile(userA.id, unitA.id, "lease.txt", "text/plain", Buffer.from("user-a-private-lease"));
    await addLedger(userA.id, unitA.id, {
      amountCents: 180_000,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      paidOn: "2026-10-01",
      method: "check",
      notes: `rent-${suffix}`,
      receiptFileId: null,
    });
    const entry = await insertLog({
      unitId: unitA.id,
      userId: userA.id,
      type: "repair",
      description: `Private repair ${suffix}`,
      eventDate: "2026-10-01",
    });
    await insertMessage({
      unitId: unitA.id,
      userId: userA.id,
      direction: "outbound",
      fromEmail: "relay@rentright.local",
      toEmail: unitA.landlordEmail,
      subject: `Leak ${suffix}`,
      body: `Private note ${suffix}`,
      deliveryStatus: "local_only",
    });
    await getSql()`
      insert into storage.objects (bucket_id, name, owner)
      values ('tenant-files', ${`${userA.id}/${fileId}`}, ${userA.id})
    `;
    const ledger = await getSql()`select id from ledger_entries where unit_id = ${unitA.id}`;
    const paymentId = String(ledger[0].id);
    const logId = entry.id;

    const homeB = await api(userB.id, "GET", "home");
    expect(homeB.status).toBe(200);
    expect(JSON.stringify(homeB.json)).not.toContain(unitA.street);
    expect(JSON.stringify(homeB.json)).toContain(unitB.street);

    const ledgerB = await api(userB.id, "GET", "ledger");
    expect(ledgerB.status).toBe(200);
    expect(ledgerB.json?.items).toEqual([]);

    const mailB = await api(userB.id, "GET", "chat");
    expect(JSON.stringify(mailB.json)).not.toContain(`Private note ${suffix}`);
    expect(JSON.stringify(mailB.json)).not.toContain(`Leak ${suffix}`);

    const logB = await api(userB.id, "GET", `log/${logId}`);
    expect(logB.status).toBe(400);
    expect(JSON.stringify(logB.json)).toContain("not found");

    const voidB = await api(userB.id, "POST", `ledger/${paymentId}/void`);
    expect(voidB.status).toBe(400);
    expect(JSON.stringify(voidB.json)).toMatch(/not found|do not have access/i);

    tokenFor(userB.id);
    const exported = await exportGet();
    expect(exported.status).toBe(200);
    const exportText = await exported.text();
    expect(exportText).not.toContain(unitA.street);
    expect(exportText).not.toContain(`Private note ${suffix}`);
    expect(exportText).toContain(unitB.street);

    tokenFor(userB.id);
    const hidden = await fileGet(new Request("http://localhost"), { params: Promise.resolve({ id: fileId }) });
    expect(hidden.status).toBe(404);
    tokenFor(userA.id);
    const visible = await fileGet(new Request("http://localhost"), { params: Promise.resolve({ id: fileId }) });
    expect(visible.status).toBe(200);
    expect(await visible.text()).toContain("user-a-private-lease");

    const unitsB = await queryAs(userB.id, "select id from public.units where id = $1", [unitA.id]);
    expect(unitsB).toHaveLength(0);
    const filesB = await queryAs(userB.id, "select id from public.files where id = $1", [fileId]);
    expect(filesB).toHaveLength(0);
    const messagesB = await queryAs(userB.id, "select id from public.messages where unit_id = $1", [unitA.id]);
    expect(messagesB).toHaveLength(0);
    const ledgerRowsB = await queryAs(userB.id, "select id from public.ledger_entries where unit_id = $1", [unitA.id]);
    expect(ledgerRowsB).toHaveLength(0);
    const objectsB = await queryAs(userB.id, "select id from storage.objects where name = $1", [`${userA.id}/${fileId}`]);
    expect(objectsB).toHaveLength(0);

    await queryAs(userB.id, "update public.units set city = 'Stolen' where id = $1", [unitA.id]);
    const city = await getSql()`select city from public.units where id = ${unitA.id}`;
    expect(city[0].city).toBe("Los Angeles");

    await expect(queryAs(
      userB.id,
      "insert into public.ledger_entries (id, unit_id, user_id, amount_cents, paid_on, method, created_at) values ($1, $2, $3, 1, '2026-01-01', 'cash', now())",
      [randomUUID(), unitA.id, userB.id],
    )).rejects.toThrow(/row-level security/i);

    await expect(queryAs(
      userB.id,
      "insert into public.messages (id, unit_id, user_id, direction, from_email, to_email, subject, body_enc, delivery_status) values ($1, $2, $3, 'outbound', 'a@b.c', 'd@e.f', 'x', 'y', 'local_only')",
      [randomUUID(), unitA.id, userB.id],
    )).rejects.toThrow(/row-level security/i);

    await expect(queryAs(
      userB.id,
      "insert into storage.objects (bucket_id, name, owner) values ('tenant-files', $1, $2)",
      [`${userA.id}/stolen`, userB.id],
    )).rejects.toThrow(/row-level security/i);

    const ownObject = await queryAs(
      userA.id,
      "insert into storage.objects (bucket_id, name, owner) values ('tenant-files', $1, $2) returning id",
      [`${userA.id}/own-copy`, userA.id],
    );
    expect(ownObject).toHaveLength(1);

    const stillThere = await getSql()`select count(*)::int as n from ledger_entries where id = ${paymentId} and voided_at is null`;
    expect(stillThere[0].n).toBe(1);
  });
});
