import { randomUUID } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/crypto";
import { createNamedUser, createUnit, deleteUserAccount, getUser, getUserByEmail, insertMessage, listMessages, primaryUnit, type UnitInput } from "@/lib/db";
import { handlePhone } from "@/lib/phone-api";
import { getSql } from "@/lib/pg";
import { DEMO_EMAIL, startSampleTenancy } from "@/lib/seed";
import { emailLandlord } from "@/lib/workflow";
import { outboundBubble } from "@/lib/phone";

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

function unitInput(street: string): UnitInput {
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
    landlordEmail: "landlord@example.com",
    landlordPhone: "",
    rentCents: 180_000,
    depositCents: 180_000,
    moveInDate: "2024-05-01",
    leaseEndDate: null,
  };
}

async function api(method: string, path: string, body?: unknown, token = "") {
  auth.authorization = token ? `Bearer ${token}` : "";
  const response = await handlePhone(
    new Request(`http://localhost/api/v1/${path}`, {
      method,
      headers: { authorization: auth.authorization, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    path.split("/").filter(Boolean),
  );
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) as Record<string, unknown> : null };
}

describe("account deletion and reviewer sign-in", () => {
  afterEach(() => {
    delete process.env.REVIEWER_LOGIN;
    delete process.env.REVIEWER_EMAIL;
    delete process.env.REVIEWER_CODE;
    delete process.env.RESEND_API_KEY;
  });

  it("erases a sole home and keeps a shared home for the other member", async () => {
    const suffix = randomUUID().slice(0, 8);
    const owner = await createNamedUser(`owner-${suffix}@example.com`, "Owner");
    const roommate = await createNamedUser(`room-${suffix}@example.com`, "Roommate");
    const shared = await createUnit(owner.id, unitInput(`${suffix} Shared St`));
    const solo = await createNamedUser(`solo-${suffix}@example.com`, "Solo");
    const soloHome = await createUnit(solo.id, unitInput(`${suffix} Solo St`));
    await getSql()`insert into unit_members (unit_id, user_id, role, created_at) values (${shared.id}, ${roommate.id}, 'roommate', now())`;
    await insertMessage({
      unitId: shared.id,
      userId: owner.id,
      direction: "outbound",
      fromEmail: "relay@example.com",
      toEmail: "landlord@example.com",
      subject: "Leak",
      body: "The sink leaks.",
      deliveryStatus: "local_only",
    });
    await getSql()`insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) values (${randomUUID()}, ${owner.id}, ${`https://push.example/${suffix}`}, 'key', 'auth', now())`;
    await getSql()`insert into assistant_messages (id, user_id, role, locale, content, created_at) values (${randomUUID()}, ${owner.id}, 'user', 'en', 'hello', now())`;

    const denied = await api("POST", "account/delete", { confirm: "no" }, signSession(owner.id));
    expect(denied.status).toBe(400);
    expect(await getUser(owner.id)).toBeTruthy();

    const removed = await api("POST", "account/delete", { confirm: "DELETE" }, signSession(owner.id));
    expect(removed.status).toBe(200);
    expect(await getUser(owner.id)).toBeNull();
    const kept = await getSql()<{ created_by: string }[]>`select created_by from units where id = ${shared.id}`;
    expect(kept[0]?.created_by).toBe(roommate.id);
    const members = await getSql()<{ user_id: string }[]>`select user_id from unit_members where unit_id = ${shared.id}`;
    expect(members.map((row) => row.user_id)).toEqual([roommate.id]);
    const mail = await getSql()<{ n: number }[]>`select count(*)::int as n from messages where unit_id = ${shared.id}`;
    expect(mail[0]?.n).toBe(1);
    const pushes = await getSql()<{ n: number }[]>`select count(*)::int as n from push_subscriptions where user_id = ${owner.id}`;
    expect(pushes[0]?.n).toBe(0);
    const chats = await getSql()<{ n: number }[]>`select count(*)::int as n from assistant_messages where user_id = ${owner.id}`;
    expect(chats[0]?.n).toBe(0);

    await deleteUserAccount(solo.id);
    const gone = await getSql()<{ id: string }[]>`select id from units where id = ${soloHome.id}`;
    expect(gone).toHaveLength(0);
    expect(await getUser(solo.id)).toBeNull();
  });

  it("accepts the reviewer code only for the configured address and opens the sample home", async () => {
    process.env.REVIEWER_LOGIN = "1";
    process.env.REVIEWER_EMAIL = "reviewer-store@example.com";
    process.env.REVIEWER_CODE = "review-code-9";
    const other = await api("POST", "auth/reviewer", { email: "other@example.com", code: "review-code-9" });
    expect(other.status).toBe(400);
    const wrong = await api("POST", "auth/reviewer", { email: "reviewer-store@example.com", code: "not-the-code" });
    expect(wrong.status).toBe(400);
    expect(String(wrong.json?.error)).toMatch(/did not work/i);
    const stray = await getSql()<{ n: number }[]>`select count(*)::int as n from magic_links where email = ${"other@example.com"}`;
    expect(stray[0]?.n).toBe(0);
    const opened = await api("POST", "auth/reviewer", { email: "Reviewer-store@example.com", code: "review-code-9" });
    expect(opened.status).toBe(200);
    expect(JSON.stringify(opened.json)).toContain("Maya Chen");
    expect(JSON.stringify(opened.json)).toContain("1842 N Echo Park Ave");
    expect(JSON.stringify(opened.json)).not.toContain("review-code-9");
    expect((opened.json?.user as { email?: string }).email).toBe("reviewer-store@example.com");
    expect(await getUserByEmail(DEMO_EMAIL)).toBeNull();
    const token = String(opened.json?.token);
    const records = await api("GET", "records", undefined, token);
    expect(((records.json?.issues as unknown[]) || []).length).toBeGreaterThan(0);
    expect(JSON.stringify(records.json)).toMatch(/sink|fan|leak/i);
    const reviewer = await getUserByEmail("reviewer-store@example.com");
    const home = reviewer ? await primaryUnit(reviewer.id) : null;
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM = "Rent Right <mail@example.com>";
    const spy = vi.spyOn(globalThis, "fetch");
    const status = await emailLandlord({
      user: reviewer!,
      unit: home!,
      logEntryId: null,
      subject: "Please fix the sink",
      tenantText: "The sink is leaking.",
    });
    expect(status).toBe("local_only");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();

    delete process.env.REVIEWER_LOGIN;
    const closed = await api("POST", "auth/reviewer", { email: "reviewer-store@example.com", code: "review-code-9" });
    expect(closed.status).toBe(400);
  });

  it("lets a roommate join the home and then leave it", async () => {
    const suffix = randomUUID().slice(0, 8);
    const owner = await createNamedUser(`ownerh-${suffix}@example.com`, "Owner");
    const room = await createNamedUser(`roomh-${suffix}@example.com`, "Roommate");
    await createUnit(owner.id, unitInput(`${suffix} Roommate St`));
    const invited = await api("POST", "invite", { email: room.email }, signSession(owner.id));
    expect(invited.status).toBe(200);
    expect(String(invited.json?.link)).toContain("/invite/");
    const code = String(invited.json?.link).split("/invite/")[1];
    const joined = await api("POST", "invite/accept", { token: code }, signSession(room.id));
    expect(joined.status).toBe(200);
    const shared = await api("GET", "records", undefined, signSession(room.id));
    expect(JSON.stringify(shared.json)).toContain("Roommate St");
    const household = await api("GET", "household", undefined, signSession(owner.id));
    expect(JSON.stringify(household.json)).toContain(room.email);
    const left = await api("POST", "invite/leave", {}, signSession(room.id));
    expect(left.status).toBe(200);
    const after = await api("GET", "household", undefined, signSession(owner.id));
    expect(JSON.stringify(after.json)).not.toContain(room.email);
  });

  it("stops accepting reviewer tries after eight attempts in an hour", async () => {
    process.env.REVIEWER_LOGIN = "1";
    process.env.REVIEWER_EMAIL = "reviewer-limit@example.com";
    process.env.REVIEWER_CODE = "review-code-9";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const failed = await api("POST", "auth/reviewer", { email: "reviewer-limit@example.com", code: "wrong-code-1" });
      expect(failed.status).toBe(400);
      expect(String(failed.json?.error)).toMatch(/did not work/i);
    }
    const limited = await api("POST", "auth/reviewer", { email: "reviewer-limit@example.com", code: "review-code-9" });
    expect(limited.status).toBe(400);
    expect(String(limited.json?.error)).toMatch(/too many tries/i);
  });

  it("does not email a landlord from the sample home", async () => {
    const id = await startSampleTenancy();
    const user = await getUser(id);
    const unit = await primaryUnit(id);
    expect(user?.email).toBe(DEMO_EMAIL);
    expect(unit?.landlordEmail).toBe("elena.vasquez@example.com");
    process.env.RESEND_API_KEY = "re_test_key";
    const spy = vi.spyOn(globalThis, "fetch");
    try {
      const status = await emailLandlord({
        user: user!,
        unit: unit!,
        logEntryId: null,
        subject: "Kitchen sink",
        tenantText: "The sink leaks.",
      });
      expect(status).toBe("local_only");
      expect(spy.mock.calls.some((call) => String(call[0]).includes("resend.com"))).toBe(false);
      await expect(emailLandlord({
        user: { ...user!, name: "" },
        unit: unit!,
        logEntryId: null,
        subject: "Message from your tenant",
        tenantText: "Hello",
      })).rejects.toThrow(/Settings/);
      const named = await emailLandlord({
        user: user!,
        unit: unit!,
        logEntryId: null,
        subject: "Message from your tenant",
        tenantText: "Please fix the sink.",
      });
      expect(named).toBe("local_only");
      const saved = (await listMessages(id, unit!.id)).find((message) => message.body.includes("Please fix the sink."));
      expect(saved?.subject).toBe("Message from Maya Chen, 1842 N Echo Park Ave, Unit 3");
      expect(saved?.body).toContain("Maya Chen\n1842 N Echo Park Ave, Unit 3\nLos Angeles, CA 90026");
      expect(saved?.body).toContain("Reply to this email or tap Respond.");
      expect(saved?.body).not.toMatch(/not legal advice/i);
      expect(saved?.body).not.toMatch(/The tenant wrote|Message from your tenant/);
      const preview = outboundBubble(saved?.body || "");
      expect(preview.text).toBe("Please fix the sink.");
      expect(preview.text).not.toContain("Maya Chen");
      expect(preview.text).not.toContain("Respond without an account");
      expect(preview.detail).toContain("/r/sample");
    } finally {
      spy.mockRestore();
    }
  });

  it("asks Resend to send the tenant header and the photo", async () => {
    const suffix = randomUUID().slice(0, 8);
    const user = await createNamedUser(`mail-${suffix}@example.com`, "jane doe");
    const unit = await createUnit(user.id, {
      ...unitInput("123 main st"),
      unitNumber: "4",
      city: "Oakland",
      postalCode: "94612",
      region: "CA",
    });
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "Rent Right <notices@rentrightportal.com>";
    const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
    try {
      const status = await emailLandlord({
        user,
        unit,
        logEntryId: null,
        subject: "Message from your tenant",
        tenantText: "The sink leaks.",
        photos: [{ name: "leak.gif", mime: "image/gif", bytes: gif, issueId: null, existingPhotoId: null }],
      });
      expect(status).toBe("sent");
      const call = spy.mock.calls.find((item) => String(item[0]).includes("api.resend.com"));
      expect(call).toBeTruthy();
      const body = JSON.parse(String((call?.[1] as RequestInit).body)) as {
        subject: string; text: string; reply_to: string; attachments: { filename: string; content: string }[];
      };
      expect(body.subject).toBe("Message from Jane Doe, 123 Main St, Unit 4");
      expect(body.text).toContain("Jane Doe");
      expect(body.text).toContain("123 Main St, Unit 4");
      expect(body.text).toContain("Oakland, CA 94612");
      expect(body.text).toContain("Reply to this email or tap Respond.");
      expect(body.text).toContain("A photo is attached.");
      expect(body.text.split("123 Main St, Unit 4").length - 1).toBe(1);
      expect(body.text).not.toMatch(/not legal advice/i);
      expect(body.text).not.toMatch(/The tenant wrote|Message from your tenant/);
      expect(body.reply_to).toMatch(/^u-[a-z0-9]+@/);
      expect(body.attachments[0].filename).toBe("leak.gif");
      expect(body.attachments[0].content).toBe(gif.toString("base64"));
    } finally {
      spy.mockRestore();
      await deleteUserAccount(user.id);
    }
  });
});
