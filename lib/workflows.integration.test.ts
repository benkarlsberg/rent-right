import { describe, expect, it, vi } from "vitest";
import { handlePhone } from "@/lib/phone-api";
import { sampleLeaseText } from "@/lib/workflow";
import { dispatchReminders } from "@/lib/workflow";
import { getSql } from "@/lib/pg";
import { DEMO_EMAIL, startSampleTenancy } from "@/lib/seed";
import { getUser } from "@/lib/db";
import { todayISO } from "@/lib/rules/dates";

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

describe("renter workflows", () => {
  it("signs up, reviews a lease, and emails the landlord only after confirmation", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
    expect(process.env.RESEND_API_KEY).toBeUndefined();

    const email = `ada-${Date.now()}@example.com`;
    const magic = await api("POST", "auth/magic", { email });
    expect(magic.status).toBe(200);
    expect(typeof magic.json?.devToken).toBe("string");

    const session = await api("POST", "auth/verify", { token: magic.json?.devToken });
    expect(session.status).toBe(200);
    expect(session.json?.needsUnit).toBe(true);
    const token = String(session.json?.token);

    const unit = await api("POST", "unit", {
      name: "Ada Tenant",
      street: "1842 N Echo Park Ave",
      unitNumber: "9",
      city: "Los Angeles",
      postalCode: "90026",
      region: "Los Angeles County",
      landlordName: "Elena Vasquez",
      landlordEmail: "elena@example.com",
      rent: "2150",
    }, token);
    expect(unit.status).toBe(200);
    expect(unit.json?.needsUnit).toBe(false);

    const reviewed = await api("POST", "lease", {
      text: sampleLeaseText(),
      filename: "lease.txt",
    }, token);
    expect(reviewed.status).toBe(200);
    const reviews = reviewed.json?.reviews as { findings: { ruleId: string | null; status: string }[] }[];
    expect(reviews.length).toBeGreaterThan(0);
    const findings = reviews[0].findings;
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      if (finding.ruleId) expect(finding.ruleId).toMatch(/^[A-Z0-9.-]+$/);
      else expect(finding.status).toBe("Unsure");
    }
    const saved = await api("GET", "lease", undefined, token);
    expect(JSON.stringify(saved.json)).toContain(findings[0].ruleId || "Unsure");

    const repair = await api("POST", "thread", { text: "The kitchen sink is leaking under the cabinet" }, token);
    expect(repair.status).toBe(200);
    const items = repair.json?.items as { status?: string; action?: { id: string } | null; headline?: string }[];
    const waiting = items.find((item) => item.action?.id.startsWith("send:"));
    expect(waiting?.status).toBe("Not sent");
    const draftId = waiting!.action!.id.slice("send:".length);

    const confirmed = await api("POST", "thread", { action: "send", draftId }, token);
    expect(confirmed.status).toBe(200);
    const sentCard = (confirmed.json?.items as { headline?: string; status?: string }[]).find((item) => item.headline === "Landlord email");
    expect(sentCard?.status).toBe("Saved");

    const mail = await api("GET", "chat", undefined, token);
    const bubble = (mail.json?.items as { text: string; status: string }[]).find((item) => item.text.includes("leaking"));
    expect(bubble?.status).toBe("Saved");
    const rows = await getSql()`
      select delivery_status from messages
      where subject ilike '%repair%' or body_enc is not null
      order by created_at desc
      limit 5
    `;
    expect(rows.some((row) => row.delivery_status === "local_only")).toBe(true);
  });

  it("rejects missing, bad, reused, and expired sign-in, and short lease text", async () => {
    const missing = await api("GET", "me");
    expect(missing.status).toBe(401);

    const bad = await api("GET", "me", undefined, "not-a-session");
    expect(bad.status).toBe(401);

    const unknown = await api("POST", "auth/verify", { token: "missing-token" });
    expect(unknown.status).toBe(400);

    const email = `reuse-${Date.now()}@example.com`;
    const magic = await api("POST", "auth/magic", { email });
    const first = await api("POST", "auth/verify", { token: magic.json?.devToken });
    expect(first.status).toBe(200);
    const second = await api("POST", "auth/verify", { token: magic.json?.devToken });
    expect(second.status).toBe(400);
    expect(JSON.stringify(second.json)).toMatch(/invalid or expired/i);

    const expiring = await api("POST", "auth/magic", { email: `old-${Date.now()}@example.com` });
    await getSql()`update magic_links set expires_at = now() - interval '1 minute' where token_hash is not null and used_at is null`;
    const expired = await api("POST", "auth/verify", { token: expiring.json?.devToken });
    expect(expired.status).toBe(400);

    const token = String(first.json?.token);
    await api("POST", "unit", {
      name: "Ada Tenant",
      street: "10 Main St",
      city: "Los Angeles",
      postalCode: "90026",
      landlordName: "Pat Landlord",
      landlordEmail: "pat@example.com",
    }, token);
    const empty = await api("POST", "thread", { text: "" }, token);
    expect(empty.status).toBe(400);
    const short = await api("POST", "lease", { text: "too short" }, token);
    expect(short.status).toBe(400);
    expect(JSON.stringify(short.json)).toMatch(/No lease text/i);
  });

  it("switches topic, then archives the chat without deleting records", async () => {
    const email = `switch-${Date.now()}@example.com`;
    const magic = await api("POST", "auth/magic", { email });
    const session = await api("POST", "auth/verify", { token: magic.json?.devToken });
    const token = String(session.json?.token);
    await api("POST", "unit", {
      name: "Ada Tenant",
      street: "10 Main St",
      city: "Los Angeles",
      postalCode: "90026",
      landlordName: "Pat Landlord",
      landlordEmail: "pat@example.com",
      rent: "2000",
    }, token);

    const waiting = await api("POST", "thread", { text: "My landlord raised rent to $2,100" }, token);
    expect(waiting.status).toBe(200);
    expect(JSON.stringify(waiting.json)).toMatch(/start date/i);

    const switched = await api("POST", "thread", { text: "Nevermind, I'd like to request a fix" }, token);
    expect(switched.status).toBe(200);
    const cards = switched.json?.items as { headline?: string; actions?: { id: string; label: string }[]; action?: { id: string } | null }[];
    expect(cards.some((item) => item.headline === "Unsure")).toBe(false);
    expect(cards.some((item) => item.action?.id.startsWith("send:") || item.headline === "Repair logged")).toBe(true);

    const vague = await api("POST", "thread", { text: "purple balloons on the ceiling" }, token);
    const vagueCards = vague.json?.items as { actions?: { label: string }[] }[];
    const suggestions = vagueCards.at(-1)?.actions?.map((action) => action.label) || [];
    expect(suggestions).toEqual(expect.arrayContaining(["My sink is leaking", "Check my lease", "Check a rent increase", "Where's my deposit?", "Start over"]));

    const records = await api("GET", "records", undefined, token);
    expect((records.json?.notes as { line: string }[]).length).toBeGreaterThan(0);

    const cleared = await api("POST", "thread", { action: "clear" }, token);
    expect(cleared.status).toBe(200);
    expect(cleared.json?.items).toEqual([]);
    expect((cleared.json?.chips as unknown[]).length).toBeGreaterThan(0);
    const stillThere = await api("GET", "records", undefined, token);
    expect((stillThere.json?.notes as { line: string }[]).length).toBeGreaterThan(0);
    const kept = await getSql()<{ n: number }[]>`
      select count(*)::int as n from assistant_messages where archived_at is not null
    `;
    expect(kept[0]?.n).toBeGreaterThan(0);
  });

  it("lets a new account open chat before a unit is saved", async () => {
    const email = `new-${Date.now()}@example.com`;
    const magic = await api("POST", "auth/magic", { email });
    const session = await api("POST", "auth/verify", { token: magic.json?.devToken });
    const token = String(session.json?.token);
    const thread = await api("GET", "thread", undefined, token);
    expect(thread.status).toBe(200);
    expect(thread.json?.needsUnit).toBe(true);
    expect(thread.json?.items).toEqual([]);
    expect((thread.json?.chips as unknown[]).length).toBeGreaterThan(0);
    const blocked = await api("POST", "thread", { text: "The sink is leaking" }, token);
    expect(blocked.status).toBe(400);
    expect(blocked.json?.error).toBe("Add your place before sending a message.");
    const place = await api("POST", "place", {
      street: "1842 N Echo Park Ave",
      city: "Los Angeles",
      postalCode: "90026",
      region: "CA",
    }, token);
    expect(place.status).toBe(200);
    expect(place.json?.inCalifornia).toBe(true);
    expect(place.json?.summary).toBe("California rules apply; Los Angeles rent control may also apply.");
    const elsewhere = await api("POST", "place", {
      street: "1 Main",
      city: "Austin",
      postalCode: "78701",
      region: "TX",
    }, token);
    expect(elsewhere.json?.inCalifornia).toBe(false);
    expect(elsewhere.json?.summary).toBe("That address does not look like California.");
  });

  it("saves a tenant reminder without changing the computed date", async () => {
    const email = `remind-${Date.now()}@example.com`;
    const magic = await api("POST", "auth/magic", { email });
    const session = await api("POST", "auth/verify", { token: magic.json?.devToken });
    const token = String(session.json?.token);
    await api("POST", "unit", {
      name: "Ada Tenant",
      street: "10 Main St",
      city: "Los Angeles",
      postalCode: "90026",
      landlordName: "Pat Landlord",
      landlordEmail: "pat@example.com",
      rent: "2000",
    }, token);
    const logged = await api("POST", "thread", { text: "My sink is leaking" }, token);
    expect(logged.status).toBe(200);
    const threadSteps = (logged.json?.steps as { items: { action: string }[] }).items.map((item) => item.action);
    expect(threadSteps).toContain("send");
    expect(threadSteps).not.toContain("followup");

    const records = await api("GET", "records", undefined, token);
    const cards = records.json?.deadlines as { id: string; kind: string; title: string; due: string | null; reminder: string | null }[];
    const repair = cards.find((item) => item.kind === "repair");
    expect(repair?.title).toMatch(/^Reminder: follow up on /);
    expect(repair?.title).not.toMatch(/Landlord's deadline to respond/);
    expect(repair?.due).toMatch(/^Due /);
    const notes = records.json?.notes as { line: string; title: string; status: string }[];
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].title).toBe("Repair request");
    expect(notes[0].line.length).toBeGreaterThan(0);

    const before = await getSql()<{ due: string }[]>`select due_date::text as due from deadlines where id = ${repair!.id}`;
    const edited = await api("POST", "records/reminder", { id: repair!.id, date: "2026-12-01" }, token);
    expect(edited.status).toBe(200);
    const after = await getSql()<{ due: string; nudge: string }[]>`select due_date::text as due, tenant_reminder_on::text as nudge from deadlines where id = ${repair!.id}`;
    expect(after[0]?.due).toBe(before[0]?.due);
    expect(after[0]?.nudge).toBe("2026-12-01");
    const shown = (edited.json?.deadlines as { id: string; due: string | null; reminder: string | null }[]).find((item) => item.id === repair!.id);
    expect(shown?.due).toBe(repair?.due);
    expect(shown?.reminder).toMatch(/^Your reminder: /);

    const added = await api("POST", "records/reminder/new", { label: "Call about the sink", date: "2026-12-15" }, token);
    expect(added.status).toBe(200);
    const custom = (added.json?.deadlines as { kind: string; title: string; due: string | null; reminder: string | null }[]).find((item) => item.kind === "custom_reminder");
    expect(custom?.title).toBe("Call about the sink");
    expect(custom?.due).toBeNull();
    expect(custom?.reminder).toMatch(/^Your reminder: /);

    const today = todayISO();
    await api("POST", "records/reminder", { id: repair!.id, date: today }, token);
    await dispatchReminders(today);
    const nudges = await getSql()<{ title: string; body: string }[]>`
      select title, body from notifications where title = 'Your reminder' order by created_at desc limit 1
    `;
    expect(nudges[0]?.body).toMatch(/not a legal deadline/);
    expect(nudges[0]?.body).toMatch(/Nothing was sent to the landlord/);
    const slots = await getSql()<{ slot: string }[]>`select slot from reminder_sent where deadline_id = ${repair!.id}`;
    expect(slots.map((row) => row.slot)).toContain(`nudge:${today}`);
    const still = await getSql()<{ due: string }[]>`select due_date::text as due from deadlines where id = ${repair!.id}`;
    expect(still[0]?.due).toBe(before[0]?.due);
  });

  it("loads the synthetic Los Angeles sample tenancy", async () => {
    const id = await startSampleTenancy();
    const user = await getUser(id);
    expect(user?.email).toBe(DEMO_EMAIL);
    expect(user?.name).toBe("Maya Chen");
    const opened = await api("POST", "auth/demo");
    expect(opened.status).toBe(200);
    expect(JSON.stringify(opened.json)).toContain("1842 N Echo Park Ave");
    expect(JSON.stringify(opened.json)).toContain("Maya Chen");
  });
});
