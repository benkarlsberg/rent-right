import { describe, expect, it, vi } from "vitest";
import { handlePhone } from "@/lib/phone-api";
import { sampleLeaseText } from "@/lib/workflow";
import { dispatchReminders } from "@/lib/workflow";
import { getSql, run, withActor } from "@/lib/pg";
import { DEMO_EMAIL, startSampleTenancy } from "@/lib/seed";
import { getUser, getUserByEmail } from "@/lib/db";
import { GET as packetPdf } from "@/app/api/packet/route";
import { addDays, todayISO } from "@/lib/rules/dates";

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
    expect((records.json?.issues as { title: string }[]).length).toBeGreaterThan(0);

    const cleared = await api("POST", "thread", { action: "clear" }, token);
    expect(cleared.status).toBe(200);
    expect(cleared.json?.items).toEqual([]);
    expect((cleared.json?.chips as unknown[]).length).toBeGreaterThan(0);
    const stillThere = await api("GET", "records", undefined, token);
    expect((stillThere.json?.issues as { title: string }[]).length).toBeGreaterThan(0);
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
    const issues = records.json?.issues as { title: string; issue: string; status: string }[];
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].title).toMatch(/sink/i);
    expect(issues[0].issue).toMatch(/sink/i);

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

  it("deletes a tenant reminder, dismisses a legal date, and keeps the audit row", async () => {
    const email = `drop-${Date.now()}@example.com`;
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
    const today = todayISO();
    await api("POST", "thread", { text: "My sink is leaking" }, token);
    await api("POST", "records/reminder/new", { label: "Call about the sink", date: today }, token);
    await api("POST", "deposit", { amount: "1500", moveOutDate: addDays(today, -21) }, token);
    await api("POST", "log", {
      type: "notice_received",
      noticeKind: "pay_or_quit_3day",
      description: "A 3-day notice was posted on the door.",
      eventDate: today,
    }, token);

    const spanish = await api("POST", "settings", { locale: "es" }, token);
    expect(spanish.status).toBe(200);
    const esRecords = await api("GET", "records", undefined, token);
    const esLabels = esRecords.json?.labels as { deleteConfirm: string; dismissReminder: string; undo: string };
    expect(esLabels.deleteConfirm).toBe("¿Eliminar este recordatorio?");
    expect(esLabels.dismissReminder).toBe("Descartar");
    expect(esLabels.undo).toBe("Deshacer");
    const esCards = esRecords.json?.deadlines as { kind: string; deletable: boolean; legalNote: string | null }[];
    expect(esCards.find((item) => item.kind === "deposit")?.legalNote).toMatch(/dato legal/);
    expect(esCards.find((item) => item.kind === "custom_reminder")?.deletable).toBe(true);
    expect(esCards.find((item) => item.kind === "repair")?.deletable).toBe(true);
    await api("POST", "settings", { locale: "en" }, token);

    const records = await api("GET", "records", undefined, token);
    const cards = records.json?.deadlines as { id: string; kind: string; deletable: boolean; legalNote: string | null }[];
    const repair = cards.find((item) => item.kind === "repair");
    const custom = cards.find((item) => item.kind === "custom_reminder");
    const deposit = cards.find((item) => item.kind === "deposit");
    const notice = cards.find((item) => item.kind === "notice_3day");
    expect(repair?.deletable).toBe(true);
    expect(custom?.deletable).toBe(true);
    expect(deposit?.deletable).toBe(false);
    expect(deposit?.legalNote).toMatch(/legal fact/);
    expect(notice?.deletable).toBe(false);
    const depositBefore = await getSql()<{ due: string; status: string }[]>`
      select due_date::text as due, status from deadlines where id = ${deposit!.id}
    `;
    const repairBefore = await getSql()<{ due: string }[]>`select due_date::text as due from deadlines where id = ${repair!.id}`;

    await getSql()`
      update deadlines
      set due_date = ${today}, tenant_reminder_on = ${today}
      where id = ${repair!.id}
    `;
    const blockedDeposit = await api("POST", "records/reminder/delete", { id: deposit!.id }, token);
    expect(blockedDeposit.status).toBe(400);
    expect(blockedDeposit.json?.error).toMatch(/Dismiss it from Reminders/);
    const blockedNotice = await api("POST", "records/reminder/delete", { id: notice!.id }, token);
    expect(blockedNotice.status).toBe(400);
    const depositStill = await getSql()<{ due: string; status: string }[]>`
      select due_date::text as due, status from deadlines where id = ${deposit!.id}
    `;
    expect(depositStill[0]?.status).toBe("open");
    expect(depositStill[0]?.due).toBe(depositBefore[0]?.due);

    const dismissed = await api("POST", "records/reminder/dismiss", { id: deposit!.id }, token);
    expect(dismissed.status).toBe(200);
    expect((dismissed.json?.deadlines as { id: string }[]).some((item) => item.id === deposit!.id)).toBe(false);
    await api("POST", "records/reminder/dismiss", { id: notice!.id }, token);
    const deletedRepair = await api("POST", "records/reminder/delete", { id: repair!.id }, token);
    expect(deletedRepair.status).toBe(200);
    expect((deletedRepair.json?.deadlines as { id: string }[]).some((item) => item.id === repair!.id)).toBe(false);
    const deletedCustom = await api("POST", "records/reminder/delete", { id: custom!.id }, token);
    expect(deletedCustom.status).toBe(200);

    const stored = await getSql()<{ id: string; status: string; due: string | null; nudge: string | null }[]>`
      select id, status, due_date::text as due, tenant_reminder_on::text as nudge from deadlines
    `;
    const repairRow = stored.find((row) => row.id === repair!.id);
    const customRow = stored.find((row) => row.id === custom!.id);
    const depositRow = stored.find((row) => row.id === deposit!.id);
    expect(repairRow?.status).toBe("deleted");
    expect(repairRow?.due).toBe(today);
    expect(repairBefore[0]?.due).toBeTruthy();
    expect(customRow?.status).toBe("deleted");
    expect(customRow?.nudge).toBe(today);
    expect(depositRow?.status).toBe("dismissed");
    expect(depositRow?.due).toBe(depositBefore[0]?.due);

    const slotCount = async () => {
      const rows = await getSql()<{ n: number }[]>`
        select count(*)::int as n from reminder_sent
        where deadline_id = ${repair!.id}
           or deadline_id = ${custom!.id}
           or deadline_id = ${deposit!.id}
           or deadline_id = ${notice!.id}
      `;
      return rows[0]?.n ?? 0;
    };
    const noteCount = async () => {
      const rows = await getSql()<{ n: number }[]>`select count(*)::int as n from notifications`;
      return rows[0]?.n ?? 0;
    };
    const slotsBefore = await slotCount();
    const notesBefore = await noteCount();
    expect(await dispatchReminders(today)).toBe(0);
    expect(await slotCount()).toBe(slotsBefore);
    expect(await noteCount()).toBe(notesBefore);

    const audit = await getSql()<{ description: string; flags: string; created_at: Date | string }[]>`
      select description, flags::text as flags, created_at
      from log_entries
      where type = 'issue_event'
      order by created_at asc
    `;
    const events = audit.map((row) => {
      const parsed = JSON.parse(row.flags) as { event?: string } | string;
      const flags = typeof parsed === "string" ? JSON.parse(parsed) as { event?: string } : parsed;
      return flags.event;
    });
    expect(events).toEqual([
      "reminder_dismissed",
      "reminder_dismissed",
      "reminder_deleted",
      "reminder_deleted",
    ]);
    expect(audit[2]?.description).toMatch(/Follow-up reminder/);
    expect(audit[3]?.description).toMatch(/Call about the sink/);
    for (const row of audit) {
      const at = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
      expect(at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }

    const restored = await api("POST", "records/reminder/restore", { id: custom!.id }, token);
    expect(restored.status).toBe(200);
    const back = (restored.json?.deadlines as { id: string; reminder: string | null }[]).find((item) => item.id === custom!.id);
    expect(back?.reminder).toMatch(/^Your reminder: /);
    const afterUndo = await getSql()<{ flags: string }[]>`
      select flags::text as flags from log_entries where type = 'issue_event' order by created_at asc
    `;
    const afterEvents = afterUndo.map((row) => {
      const parsed = JSON.parse(row.flags) as { event?: string } | string;
      const flags = typeof parsed === "string" ? JSON.parse(parsed) as { event?: string } : parsed;
      return flags.event;
    });
    expect(afterEvents).toContain("reminder_deleted");
    expect(afterEvents[afterEvents.length - 1]).toBe("reminder_restored");

    const otherEmail = `other-${Date.now()}@example.com`;
    const otherMagic = await api("POST", "auth/magic", { email: otherEmail });
    const otherSession = await api("POST", "auth/verify", { token: otherMagic.json?.devToken });
    const otherToken = String(otherSession.json?.token);
    await api("POST", "unit", {
      name: "Other Tenant",
      street: "20 Other St",
      city: "Los Angeles",
      postalCode: "90026",
      landlordName: "Other Landlord",
      landlordEmail: "other@example.com",
      rent: "1800",
    }, otherToken);
    const denied = await api("POST", "records/reminder/delete", { id: custom!.id }, otherToken);
    expect(denied.status).toBe(400);
    expect(denied.json?.error).toBe("Reminder not found.");
    const stranger = await getUserByEmail(otherEmail);
    const rls = await withActor(stranger!.id, () => run("update deadlines set status = 'deleted' where id = ?", [custom!.id]));
    expect(rls.changes).toBe(0);
    const untouched = await getSql()<{ status: string }[]>`select status from deadlines where id = ${custom!.id}`;
    expect(untouched[0]?.status).toBe("open");
  });

  it("keeps the same unit email on a typo, archives a move, and never emails the landlord", async () => {
    const email = `home-${Date.now()}@example.com`;
    const magic = await api("POST", "auth/magic", { email });
    const session = await api("POST", "auth/verify", { token: magic.json?.devToken });
    const token = String(session.json?.token);
    const created = await api("POST", "unit", {
      name: "Ada Tenant",
      street: "10 Main St",
      city: "Los Angeles",
      postalCode: "90026",
      landlordName: "Pat Landlord",
      landlordEmail: "pat@example.com",
      rent: "2000",
      moveInDate: "2024-05-01",
    }, token);
    expect(created.status).toBe(200);

    await getSql()`update profiles set active_unit_id = null where email = ${email}`;
    const still = await api("GET", "me", undefined, token);
    expect(JSON.stringify(still.json?.unit)).toContain("10 Main St");

    const logged = await api("POST", "thread", { text: "My sink is leaking" }, token);
    expect(logged.status).toBe(200);
    const records = await api("GET", "records", undefined, token);
    const repair = (records.json?.deadlines as { id: string; kind: string }[]).find((item) => item.kind === "repair");
    expect(repair?.id).toBeTruthy();
    const beforeDue = await getSql()<{ due: string }[]>`select due_date::text as due from deadlines where id = ${repair!.id}`;

    const sent = await api("POST", "chat", { text: "The sink is still leaking." }, token);
    expect(sent.status).toBe(200);
    const beforeMail = await getSql()<{ n: number }[]>`
      select count(*)::int as n from messages m
      join unit_members um on um.unit_id = m.unit_id
      join profiles p on p.id = um.user_id
      where p.email = ${email}
    `;
    expect(beforeMail[0]?.n).toBe(2);
    const beforeStatus = await getSql()<{ delivery_status: string }[]>`
      select m.delivery_status from messages m
      join unit_members um on um.unit_id = m.unit_id
      join profiles p on p.id = um.user_id
      where p.email = ${email}
      order by m.delivery_status
    `;
    expect(beforeStatus.map((row) => row.delivery_status)).toEqual(["draft", "local_only"]);

    const opened = await api("GET", "residence", undefined, token);
    expect(opened.status).toBe(200);
    const home = opened.json?.home as { id: string; relay: string; street: string };
    const relay = home.relay;
    expect(relay).toMatch(/^u-[a-z0-9]+@/);
    const homes = opened.json?.homes as { id: string }[];
    expect(homes).toHaveLength(1);

    const sameLaws = await api("POST", "residence/preview", {
      street: "10 Main St",
      unitNumber: "4",
      city: "Los Angeles",
      postalCode: "90026",
      landlordName: "Pat Landlord",
      landlordEmail: "pat@example.com",
      rent: "2000",
      moveInDate: "2024-05-01",
    }, token);
    expect(sameLaws.status).toBe(200);
    expect(sameLaws.json?.lawsChange).toBe(false);
    expect(sameLaws.json?.warning).toBe("Local laws stay the same for this address.");
    expect(sameLaws.json?.summary).toMatch(/Los Angeles/);

    const typo = await api("POST", "residence/save", {
      mode: "typo",
      street: "10 Main St",
      unitNumber: "4",
      city: "Los Angeles",
      postalCode: "90026",
      landlordName: "Pat Landlord",
      landlordEmail: "pat@example.com",
      rent: "2000",
      moveInDate: "2024-05-01",
    }, token);
    expect(typo.status).toBe(200);
    expect(typo.json?.note).toBe("Nothing was emailed.");
    const afterTypo = await api("GET", "residence", undefined, token);
    expect((afterTypo.json?.home as { relay: string; unitNumber: string }).relay).toBe(relay);
    expect((afterTypo.json?.home as { unitNumber: string }).unitNumber).toBe("4");
    const afterDue = await getSql()<{ due: string; nudge: string | null }[]>`select due_date::text as due, tenant_reminder_on::text as nudge from deadlines where id = ${repair!.id}`;
    expect(afterDue[0]?.due).toBe(beforeDue[0]?.due);

    const details = await api("POST", "residence/save", {
      mode: "details",
      street: "10 Main St",
      unitNumber: "4",
      city: "Los Angeles",
      postalCode: "90026",
      landlordName: "Pat Landlord",
      landlordEmail: "new-owner@example.com",
      rent: "2100",
      moveInDate: "2024-05-01",
      leaseEndDate: "2025-05-01",
    }, token);
    expect(details.status).toBe(200);
    expect((await api("GET", "residence", undefined, token)).json?.home).toMatchObject({ landlordEmail: "new-owner@example.com", relay });

    const changed = await api("POST", "residence/preview", {
      street: "1 Broadway",
      unitNumber: "2",
      city: "San Diego",
      postalCode: "92101",
      landlordName: "Pat Landlord",
      landlordEmail: "new-owner@example.com",
      rent: "2100",
    }, token);
    expect(changed.status).toBe(200);
    expect(changed.json?.lawsChange).toBe(true);
    expect(changed.json?.warning).toBe("This changes which local laws apply");
    expect(changed.json?.summary).toMatch(/San Diego/);
    expect(changed.json?.jurisdiction).toBe("city_sd");

    const denied = await api("POST", "residence/save", {
      mode: "typo",
      acknowledged: false,
      street: "1 Broadway",
      unitNumber: "2",
      city: "San Diego",
      postalCode: "92101",
      landlordName: "Pat Landlord",
      landlordEmail: "new-owner@example.com",
      rent: "2100",
    }, token);
    expect(denied.status).toBe(400);
    expect(String(denied.json?.error)).toContain("This changes which local laws apply");
    expect((await api("GET", "residence", undefined, token)).json?.home).toMatchObject({ relay, city: "Los Angeles" });

    await api("POST", "settings", { locale: "es", name: "Ada Tenant", lowBandwidth: false }, token);
    const spanish = await api("POST", "residence/preview", {
      street: "1 Broadway",
      unitNumber: "2",
      city: "San Diego",
      postalCode: "92101",
      landlordName: "Pat Landlord",
      landlordEmail: "new-owner@example.com",
      rent: "2100",
    }, token);
    expect(spanish.json?.warning).toBe("Esto cambia qué leyes locales aplican");
    expect(String((spanish.json as { labels?: { typo?: string } } | null)?.labels?.typo || "")).not.toBe("missing");
    const labels = (await api("GET", "residence", undefined, token)).json?.labels as { typo: string; move: string; nothingSent: string };
    expect(labels.typo).toBe("Corregir un error en esta dirección");
    expect(labels.move).toBe("Me mudé a una vivienda nueva");
    await api("POST", "settings", { locale: "en", name: "Ada Tenant", lowBandwidth: false }, token);

    const accepted = await api("POST", "residence/save", {
      mode: "typo",
      acknowledged: true,
      street: "1 Broadway",
      unitNumber: "2",
      city: "San Diego",
      postalCode: "92101",
      landlordName: "Pat Landlord",
      landlordEmail: "new-owner@example.com",
      rent: "2100",
      moveInDate: "2024-05-01",
    }, token);
    expect(accepted.status).toBe(200);
    const movedCity = await api("GET", "residence", undefined, token);
    expect(movedCity.json?.home).toMatchObject({ relay, jurisdiction: "city_sd", city: "San Diego" });
    const stillDue = await getSql()<{ due: string }[]>`select due_date::text as due from deadlines where id = ${repair!.id}`;
    expect(stillDue[0]?.due).toBe(beforeDue[0]?.due);

    const moved = await api("POST", "residence/save", {
      mode: "move",
      acknowledged: true,
      street: "10 Main St",
      unitNumber: "9",
      city: "Los Angeles",
      postalCode: "90026",
      landlordName: "Pat Landlord",
      landlordEmail: "new-owner@example.com",
      rent: "2200",
      moveInDate: "2026-10-01",
    }, token);
    expect(moved.status).toBe(200);
    expect(moved.json?.note).toBe("Nothing was emailed.");
    const afterMove = await api("GET", "residence", undefined, token);
    const next = afterMove.json?.home as { id: string; relay: string; archived: boolean };
    expect(next.relay).not.toBe(relay);
    expect(next.id).not.toBe(home.id);
    expect(next.archived).toBe(false);
    const listed = afterMove.json?.homes as { id: string; archived: boolean; selected: boolean; status: string }[];
    expect(listed).toHaveLength(2);
    expect(listed.find((item) => item.id === home.id)).toMatchObject({ archived: true, status: "Archived" });
    expect(listed.find((item) => item.id === next.id)?.selected).toBe(true);

    const mailAfter = await getSql()<{ n: number }[]>`
      select count(*)::int as n from messages m
      join unit_members um on um.unit_id = m.unit_id
      join profiles p on p.id = um.user_id
      where p.email = ${email}
    `;
    expect(mailAfter[0]?.n).toBe(2);
    const oldMail = await getSql()<{ n: number }[]>`select count(*)::int as n from messages where unit_id = ${home.id}`;
    expect(oldMail[0]?.n).toBe(2);
    const newMail = await getSql()<{ n: number }[]>`select count(*)::int as n from messages where unit_id = ${next.id}`;
    expect(newMail[0]?.n).toBe(0);
    const newDeadlines = await getSql()<{ n: number }[]>`select count(*)::int as n from deadlines where unit_id = ${next.id}`;
    expect(newDeadlines[0]?.n).toBe(0);

    const picked = await api("POST", "residence/select", { id: home.id }, token);
    expect(picked.status).toBe(200);
    expect((picked.json?.unit as { archived?: boolean }).archived).toBe(true);
    const oldChat = await api("GET", "chat", undefined, token);
    expect(oldChat.status).toBe(200);
    expect((oldChat.json?.items as unknown[]).length).toBe(2);
    expect(oldChat.json?.archived).toBe(true);
    const oldRecords = await api("GET", "records", undefined, token);
    expect((oldRecords.json?.deadlines as { id: string }[]).some((item) => item.id === repair!.id)).toBe(true);
    expect(oldRecords.json?.archivedNote).toMatch(/archived/i);
    const blockedWrite = await api("POST", "chat", { text: "Please write back." }, token);
    expect(blockedWrite.status).toBe(400);
    expect(String(blockedWrite.json?.error)).toMatch(/archived/i);
    auth.authorization = `Bearer ${token}`;
    const pdf = await packetPdf();
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toContain("pdf");

    await getSql()`update profiles set active_unit_id = null where email = ${email}`;
    const fallback = await api("GET", "me", undefined, token);
    expect((fallback.json?.unit as { archived?: boolean; id?: string }).id).toBe(next.id);
    expect((fallback.json?.unit as { archived?: boolean }).archived).toBe(false);
  });

  it("saves a repair as a landlord draft and records the send only after confirmation", async () => {
    expect(process.env.RESEND_API_KEY).toBeUndefined();
    const email = `draft-${Date.now()}@example.com`;
    const magic = await api("POST", "auth/magic", { email });
    const session = await api("POST", "auth/verify", { token: magic.json?.devToken });
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

    const repair = await api("POST", "thread", { text: "The kitchen sink is leaking under the cabinet" }, token);
    expect(repair.status).toBe(200);
    const planned = (repair.json?.steps as { items: { action: string; href: string | null; button: string }[] }).items;
    expect(planned[0]?.action).toBe("send");
    expect(planned[0]?.button).toBe("Review before sending");
    expect(planned[0]?.href).toMatch(/^\/landlord\?draft=/);
    const draftId = String(planned[0]?.href).split("draft=")[1];

    const before = await getSql()<{ delivery_status: string; n: number }[]>`
      select delivery_status, count(*)::int as n from messages
      where log_entry_id = (select log_entry_id from messages where id = ${draftId})
      group by delivery_status
    `;
    expect(before).toEqual([{ delivery_status: "draft", n: 1 }]);

    const mail = await api("GET", "chat", undefined, token);
    expect(mail.status).toBe(200);
    const draft = (mail.json?.items as { id: string; draft?: boolean; status: string; subject?: string; text: string }[]).find((item) => item.id === draftId);
    expect(draft?.draft).toBe(true);
    expect(draft?.status).toBe("Draft, not sent yet");
    expect(draft?.subject).toMatch(/^Repair request:/);
    expect(draft?.text).toContain("Ada Tenant");
    expect(draft?.text).toContain("1842 N Echo Park Ave");
    expect(draft?.text).toContain("Unit 9");
    expect(draft?.text).toContain("leaking under the cabinet");
    expect(draft?.text).toContain("Please repair this.");
    expect(draft?.text).toContain("CA-CC-1942");
    expect(draft?.text).toMatch(/reminder date/i);

    const records = await api("GET", "records", undefined, token);
    const sendStep = (records.json?.steps as { items: { action: string; href: string | null }[] }).items[0];
    expect(sendStep?.action).toBe("send");
    expect(sendStep?.href).toBe(`/landlord?draft=${draftId}`);
    const issue = (records.json?.issues as { status: string }[])[0];
    expect(issue?.status).toBe("Saved");

    await getSql()`delete from messages where id = ${draftId} and delivery_status = 'draft'`;
    const backfill = await api("GET", "chat", undefined, token);
    const restored = (backfill.json?.items as { id: string; draft?: boolean; text: string; status: string }[]).find((item) => item.draft);
    expect(restored?.id).toBeTruthy();
    expect(restored?.id).not.toBe(draftId);
    expect(restored?.status).toBe("Draft, not sent yet");
    expect(restored?.text).toContain("Please repair this.");
    const restoredId = restored!.id;

    const edited = "Please repair the kitchen sink leak. The cabinet under the sink is wet.";
    const saved = await api("POST", "chat/draft", { id: restoredId, body: edited }, token);
    expect(saved.status).toBe(200);
    expect((saved.json?.items as { id: string; text: string }[]).find((item) => item.id === restoredId)?.text).toBe(edited);

    await getSql()`update units set landlord_email = '' where id = (select unit_id from messages where id = ${restoredId})`;
    const missing = await api("GET", "chat", undefined, token);
    expect(missing.json?.needsEmail).toBe(true);
    expect(missing.json?.needsLandlord).toBe(true);
    const blocked = await api("POST", "chat/draft/send", { id: restoredId, body: edited }, token);
    expect(blocked.status).toBe(200);
    expect(blocked.json?.needsLandlord).toBe(true);
    const stillDraft = await getSql()<{ delivery_status: string }[]>`select delivery_status from messages where id = ${restoredId}`;
    expect(stillDraft[0]?.delivery_status).toBe("draft");

    const addressed = await api("POST", "chat/landlord-email", { email: "elena@example.com" }, token);
    expect(addressed.status).toBe(200);
    expect(addressed.json?.needsEmail).toBe(false);
    expect(addressed.json?.needsLandlord).toBe(false);

    const sent = await api("POST", "chat/draft/send", { id: restoredId, body: edited }, token);
    expect(sent.status).toBe(200);
    const bubble = (sent.json?.items as { id: string; draft?: boolean; status: string; text: string; time: string }[]).find((item) => item.id === restoredId);
    expect(bubble?.draft).toBeFalsy();
    expect(bubble?.status).toBe("Saved");
    expect(bubble?.time).toBeTruthy();
    expect(bubble?.text).toContain("cabinet under the sink");
    const rows = await getSql()<{ delivery_status: string; n: number }[]>`
      select delivery_status, count(*)::int as n from messages
      where log_entry_id = (select log_entry_id from messages where id = ${restoredId})
      group by delivery_status
    `;
    expect(rows).toEqual([{ delivery_status: "local_only", n: 1 }]);

    const after = await api("GET", "records", undefined, token);
    const next = (after.json?.steps as { items: { action: string; title: string }[] }).items[0];
    expect(next?.action).toBe("wait");
    expect(next?.title).toMatch(/^Waiting for landlord until /);

    const spanish = await api("POST", "settings", { locale: "es", name: "Ada Tenant" }, token);
    expect(spanish.status).toBe(200);
    const otra = await api("POST", "thread", { text: "Se filtra el fregadero del baño" }, token);
    expect(otra.status).toBe(200);
    const paso = (otra.json?.steps as { items: { action: string; button: string; href: string | null }[] }).items[0];
    expect(paso?.action).toBe("send");
    expect(paso?.button).toBe("Revisar antes de enviar");
    const esId = String(paso?.href).split("draft=")[1];
    const esMail = await api("GET", "chat", undefined, token);
    const esDraft = (esMail.json?.items as { id: string; status: string; text: string }[]).find((item) => item.id === esId);
    expect(esDraft?.status).toBe("Borrador, aún no enviado");
    expect(esDraft?.text).toContain("Por favor, repare esto.");
    expect(esDraft?.text).toContain("Ada Tenant");
    expect(esDraft?.text).toContain("CA-CC-1942");
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
