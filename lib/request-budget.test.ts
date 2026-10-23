import { randomUUID } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/crypto";
import { createNamedUser, createUnit, type UnitInput } from "@/lib/db";
import { handlePhone } from "@/lib/phone-api";
import { drainRoundTrips } from "@/lib/pg";
import { recordLog } from "@/lib/workflow";

const auth = vi.hoisted(() => ({ authorization: "" }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === "authorization" ? auth.authorization || null : null),
  }),
}));

function unitInput(street: string): UnitInput {
  return {
    street,
    unitNumber: "Unit 25",
    city: "Los Angeles",
    postalCode: "90026",
    region: "Los Angeles County",
    jurisdiction: "city_la",
    jurisdictionConfirmed: true,
    rsoStatus: "unsure",
    rstpoTier: "unsure",
    landlordName: "Elena Vasquez",
    landlordEmail: "elena.vasquez@example.com",
    landlordPhone: "",
    rentCents: 215_000,
    depositCents: null,
    moveInDate: "2024-05-01",
    leaseEndDate: null,
  };
}

function queryCount(response: Response): number {
  const header = response.headers.get("server-timing") || "";
  const match = /desc="(\d+) queries"/.exec(header);
  return match ? Number(match[1]) : -1;
}

async function get(userId: string, path: string) {
  auth.authorization = `Bearer ${signSession(userId)}`;
  drainRoundTrips();
  const response = await handlePhone(
    new Request(`http://localhost/api/v1/${path}`, { headers: { authorization: auth.authorization } }),
    path.split("/").filter(Boolean),
  );
  const text = await response.text();
  return { status: response.status, trips: queryCount(response), json: text ? JSON.parse(text) as Record<string, unknown> : null };
}

describe("tab reads", () => {
  it("keeps signed-in tab reads on one database session", async () => {
    const suffix = randomUUID().slice(0, 8);
    const user = await createNamedUser(`budget-${suffix}@example.com`, "Maya Chen");
    const unit = await createUnit(user.id, unitInput(`${suffix} N Echo Park Ave`));
    await recordLog({
      user,
      unit,
      type: "repair",
      noticeKind: null,
      severity: "leak",
      room: "Kitchen",
      description: "My sink is leaking",
      eventDate: "2026-10-22",
      photoFileId: null,
      sendEmail: false,
      subject: "",
      entryAt: null,
      noticeAt: null,
    });
    const records = await get(user.id, "records");
    const thread = await get(user.id, "thread");
    const chat = await get(user.id, "chat");
    expect(records.status).toBe(200);
    expect(thread.status).toBe(200);
    expect(chat.status).toBe(200);
    expect(records.json?.address).toBe(`${suffix} N Echo Park Ave, Unit 25, Los Angeles CA 90026`);
    expect(records.trips, `records queries ${records.trips}`).toBeLessThanOrEqual(16);
    expect(thread.trips, `thread queries ${thread.trips}`).toBeLessThanOrEqual(16);
    expect(chat.trips, `chat queries ${chat.trips}`).toBeLessThanOrEqual(12);
    const deadlines = records.json?.deadlines as { id: string; closed?: boolean }[] | undefined;
    const open = deadlines?.find((item) => item.closed === false);
    if (open) {
      auth.authorization = `Bearer ${signSession(user.id)}`;
      const done = await handlePhone(
        new Request("http://localhost/api/v1/records/done", {
          method: "POST",
          headers: { authorization: auth.authorization, "content-type": "application/json" },
          body: JSON.stringify({ id: open.id }),
        }),
        ["records", "done"],
      );
      expect(done.status).toBe(200);
      const after = await done.json() as { deadlines: { id: string; closed?: boolean }[] };
      expect(after.deadlines.find((item) => item.id === open.id)?.closed).toBe(true);
    }
  });
});
