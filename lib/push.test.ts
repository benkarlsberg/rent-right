import { randomUUID } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/crypto";
import { createNamedUser, deleteUserAccount, expoTokensForUsers, saveExpoToken, setPushEnabled } from "@/lib/db";
import { handlePhone } from "@/lib/phone-api";
import { drainRoundTrips, getSql } from "@/lib/pg";
import { landlordPushBody, pushLandlordReply, pushReminders, reminderPushBody, unregisteredTokens } from "@/lib/push";

const auth = vi.hoisted(() => ({ authorization: "" }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === "authorization" ? auth.authorization || null : null),
  }),
}));

describe("push text", () => {
  it("names the issue and leaves the reply and the address off the lock screen", () => {
    const body = landlordPushBody("Re: Repair request: The sink is leaking under the cabinet", "en");
    expect(body).toBe("Your landlord replied about: Sink is leaking under the cabinet");
    expect(body).not.toMatch(/Will do|@|Re:/);
    expect(reminderPushBody("The kitchen sink is leaking under the cabinet", 1, "en")).toBe("Follow up: The kitchen sink is leaking");
    expect(reminderPushBody("HVAC is out in the hall", 1, "en")).toBe("Follow up: HVAC is out in the hall");
    expect(reminderPushBody("", 2, "es")).toBe("Tiene 2 recordatorios");
    expect(unregisteredTokens(["a", "b"], [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }])).toEqual(["b"]);
  });
});

describe("push delivery", () => {
  it("uses one read when every device is registered, and deletes a token Expo rejects", async () => {
    const suffix = randomUUID().slice(0, 8);
    const user = await createNamedUser(`push-${suffix}@example.com`, "Ada Tenant");
    const keep = `ExponentPushToken[rrqa${suffix}keep]`;
    const drop = `ExponentPushToken[rrqa${suffix}drop]`;
    await saveExpoToken(user.id, keep, "ios");
    await saveExpoToken(user.id, drop, "android");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: [
        { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
        { status: "ok", id: "ticket-1" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    drainRoundTrips();
    await pushReminders([{ userIds: [user.id], issue: "The sink is leaking", count: 1, logId: "6878a3ce-cffb-4cbf-8aee-9c5b32ce522f" }]);
    const trips = drainRoundTrips();
    fetchMock.mockRestore();
    expect(trips).toBe(2);
    const left = await expoTokensForUsers([user.id]);
    expect(left.map((row) => row.token)).toEqual([keep]);

    await setPushEnabled(user.id, false);
    const skipped = vi.spyOn(globalThis, "fetch");
    await pushLandlordReply([user.id], "Re: Repair request: The sink is leaking");
    expect(skipped).not.toHaveBeenCalled();
    skipped.mockRestore();

    auth.authorization = `Bearer ${signSession(user.id)}`;
    const removed = await handlePhone(new Request("http://localhost/api/v1/devices/remove", {
      method: "POST",
      headers: { authorization: auth.authorization, "content-type": "application/json" },
      body: JSON.stringify({ token: keep }),
    }), ["devices", "remove"]);
    const removedBody = await removed.json();
    expect(removed.status, JSON.stringify(removedBody)).toBe(200);
    expect(await expoTokensForUsers([user.id])).toEqual([]);

    const rejected = await handlePhone(new Request("http://localhost/api/v1/devices", {
      method: "POST",
      headers: { authorization: auth.authorization, "content-type": "application/json" },
      body: JSON.stringify({ token: "not-a-token", platform: "ios" }),
    }), ["devices"]);
    expect(rejected.status).toBe(400);

    await saveExpoToken(user.id, keep, "ios");
    await deleteUserAccount(user.id);
    const gone = await getSql()<{ n: number }[]>`select count(*)::int as n from expo_push_tokens where token = ${keep}`;
    expect(gone[0]?.n).toBe(0);
  });

  it("asks Expo about an unknown token", async () => {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify([{
        to: "ExponentPushToken[rrqa000000000000000000]",
        title: "Rent Right",
        body: "Reminder: sink",
        sound: "default",
      }]),
      signal: AbortSignal.timeout(8000),
    });
    const json = await response.json() as { data?: { details?: { error?: string } }[] };
    expect(response.ok).toBe(true);
    expect(json.data?.[0]?.details?.error).toBe("DeviceNotRegistered");
  });
});
