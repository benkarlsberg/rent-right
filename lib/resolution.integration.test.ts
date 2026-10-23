import { randomUUID } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { parseCard } from "@/lib/chat-card";
import { signSession } from "@/lib/crypto";
import { createNamedUser, createUnit, listAssistant, listDeadlines, listLogHistory, openDeadlines, listDueNudges, setTenantReminder, type UnitInput } from "@/lib/db";
import { runChatTurn } from "@/lib/chat-turn";
import { landlordSaysFixed, resolveRepair, reopenRepair } from "@/lib/issues";
import { handlePhone } from "@/lib/phone-api";
import { packetLines } from "@/lib/packet";
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
    unitNumber: "3",
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

async function api(userId: string, method: string, path: string, body?: unknown) {
  auth.authorization = `Bearer ${signSession(userId)}`;
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

describe("resolving a request", () => {
  it("archives it, closes reminders, keeps history, and lets the tenant reopen", async () => {
    const suffix = randomUUID().slice(0, 8);
    const user = await createNamedUser(`resolve-${suffix}@example.com`, "Maya Chen");
    const unit = await createUnit(user.id, unitInput(`${suffix} N Echo Park Ave`));
    const entry = await recordLog({
      user,
      unit,
      type: "repair",
      noticeKind: null,
      severity: "leak",
      room: "Kitchen",
      description: "Kitchen sink leak.",
      eventDate: "2026-10-01",
      photoFileId: null,
      sendEmail: false,
      subject: "",
      entryAt: null,
      noticeAt: null,
      createdAt: "2026-10-01T18:00:00.000Z",
    });
    const open = await listDeadlines(user.id, unit.id);
    const reminder = open.find((item) => item.sourceId === entry.id);
    expect(reminder?.status).toBe("open");
    await setTenantReminder(user.id, reminder!.id, "2026-10-23");

    const resolved = await resolveRepair(user, entry.id, { date: "2026-10-06", note: "The plumber came." });
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedBy).toBe("tenant");
    expect((await listDeadlines(user.id, unit.id)).find((item) => item.id === reminder!.id)?.status).toBe("resolved");
    expect((await openDeadlines()).some((item) => item.id === reminder!.id)).toBe(false);
    expect((await listDueNudges()).some((item) => item.id === reminder!.id)).toBe(false);

    const records = await api(user.id, "GET", "records");
    expect(records.status).toBe(200);
    const archive = records.json?.archive as { title: string; duration: string; source: string; summary: string }[];
    expect(archive).toHaveLength(1);
    expect(archive[0].title).toBe("Kitchen sink leak");
    expect(archive[0].duration).toBe("Resolved in 5 days");
    expect(archive[0].source).toBe("Tenant marked");
    expect(archive[0].summary).toMatch(/Reported/);
    expect(records.json?.issues).toEqual([]);
    const deadlines = records.json?.deadlines as { title: string }[];
    expect(deadlines.some((card) => /sink/i.test(card.title))).toBe(false);

    const detail = await api(user.id, "GET", `log/${entry.id}`);
    const history = detail.json?.history as { body: string }[];
    expect(history.some((row) => row.body.includes("The plumber came."))).toBe(true);
    expect(history.some((row) => /CA-CC-1942|status resolved|Estado resolved|Reminder closed|Recordatorio cerrado/.test(row.body))).toBe(true);

    await reopenRepair(user, entry.id);
    expect((await listDeadlines(user.id, unit.id)).find((item) => item.id === reminder!.id)?.status).toBe("open");
    const historyAfter = await listLogHistory(user.id, unit.id);
    expect(historyAfter.some((row) => row.description.includes("The plumber came."))).toBe(true);
    expect(historyAfter.some((row) => row.description.includes("reopened"))).toBe(true);

    const lines = packetLines({
      user,
      unit,
      logs: historyAfter,
      messages: [],
      deadlines: await listDeadlines(user.id, unit.id),
      ledger: [],
      deposit: null,
      conditions: [],
    });
    expect(lines.join("\n")).toMatch(/The plumber came/);
    expect(lines.join("\n")).toMatch(/reopened/);
  });

  it("waits for the tenant when the landlord says fixed, then confirms from chat", async () => {
    const suffix = randomUUID().slice(0, 8);
    const user = await createNamedUser(`fixed-${suffix}@example.com`, "Maya Chen");
    const unit = await createUnit(user.id, unitInput(`${suffix} Echo Park Ave`));
    const entry = await recordLog({
      user,
      unit,
      type: "repair",
      noticeKind: null,
      severity: "leak",
      room: "Kitchen",
      description: "Kitchen sink leak.",
      eventDate: "2026-10-20",
      photoFileId: null,
      sendEmail: false,
      subject: "",
      entryAt: null,
      noticeAt: null,
    });
    const noted = await landlordSaysFixed(user.id, unit, entry.id, "We replaced the trap.");
    expect(noted).toBe(true);
    const pending = await api(user.id, "GET", "records");
    const issues = pending.json?.issues as { pending: boolean; pendingTitle: string; pendingNote: string }[];
    expect(issues[0].pending).toBe(true);
    expect(issues[0].pendingTitle).toMatch(/confirm/i);
    expect(issues[0].pendingNote).toBe("We replaced the trap.");
    expect(pending.json?.archive).toEqual([]);

    await runChatTurn(user, unit, { text: "the sink is fixed" });
    const offered = (await listAssistant(user.id)).filter((row) => row.role === "assistant").at(-1);
    const card = parseCard(offered?.content || "");
    expect(card?.headline).toBe("Landlord says fixed, confirm?");
    expect(card?.action?.id).toBe(`resolve:${entry.id}`);
    expect(card?.actions || []).toHaveLength(0);

    await runChatTurn(user, unit, { action: `resolve:${entry.id}` });
    const after = await api(user.id, "GET", "records");
    const archive = after.json?.archive as { source: string }[];
    expect(archive[0].source).toBe("Landlord confirmed");
    expect((await listDeadlines(user.id, unit.id)).every((item) => item.sourceId !== entry.id || item.status === "resolved")).toBe(true);
  });
});
