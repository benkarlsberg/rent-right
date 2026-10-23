import { describe, expect, it } from "vitest";
import { DISCLAIMER_EN } from "@/lib/disclaimer";
import { formatDate } from "@/lib/format";
import type { Unit, User } from "@/lib/db";
import { deadlineCards, duePhrase, logCards, nextSteps, recordsLabels, reminderNote } from "@/lib/records-view";
import { packetLines } from "@/lib/packet";
import { renderPdf } from "@/lib/pdf";

const today = "2026-10-23";

describe("records view", () => {
  it("labels a repair follow-up without calling it the landlord's deadline", () => {
    const [card] = deadlineCards([{
      id: "d1",
      kind: "repair",
      ruleId: "CA-CC-1942",
      anchorDate: "2026-10-23",
      dueDate: "2026-10-30",
      explanation: "The reminder date is 2026-10-30. It is not a determination that the landlord broke the law on that date.",
      explanationEs: "La fecha del recordatorio es 2026-10-30.",
      computation: "2026-10-23 + 7 days = 2026-10-30 (leak)",
      sourceId: "log1",
      status: "open",
      tenantReminderOn: null,
    }], [{
      id: "log1",
      type: "repair",
      description: "Kitchen sink leak. Water under the cabinet.",
      eventDate: "2026-10-23",
      createdAt: "2026-10-23T18:00:00.000Z",
    }], "en", today);
    expect(card.title).toBe("Reminder: follow up on Kitchen sink leak");
    expect(card.sortOn).toBe("2026-10-30");
    expect(card.closed).toBe(false);
    expect(card.title).not.toMatch(/Landlord's deadline to respond/);
    expect(card.owes).toMatch(/does not decide that the landlord must answer/);
    expect(card.due).toBe("Due Oct 30, 2026 · in 7 days");
    expect(card.started).toBe("You logged this on Oct 23, 2026.");
    expect(card.learnMore).toMatch(/CA-CC-1942/);
    expect(card.reminder).toBeNull();
    expect(card.deletable).toBe(true);
    expect(card.legalNote).toBeNull();
  });

  it("keeps a tenant reminder separate from the computed date", () => {
    const [card] = deadlineCards([{
      id: "d1",
      kind: "repair",
      ruleId: "CA-CC-1942",
      anchorDate: "2026-10-23",
      dueDate: "2026-10-30",
      explanation: "Reminder.",
      explanationEs: "Recordatorio.",
      computation: "math",
      sourceId: null,
      status: "open",
      tenantReminderOn: "2026-10-28",
    }], [], "en", today);
    expect(card.due).toBe("Due Oct 30, 2026 · in 7 days");
    expect(card.reminder).toBe("Your reminder: Oct 28, 2026");
    expect(card.aside).toMatch(/does not change the date above/);
  });

  it("titles the deposit date as the landlord's accounting deadline", () => {
    const [card] = deadlineCards([{
      id: "d2",
      kind: "deposit",
      ruleId: "CA-CC-1950.5",
      anchorDate: "2026-10-19",
      dueDate: "2026-11-09",
      explanation: "21 days.",
      explanationEs: "21 días.",
      computation: "2026-10-19 + 21 calendar days = 2026-11-09",
      sourceId: null,
      status: "open",
      tenantReminderOn: null,
    }], [], "en", today);
    expect(card.title).toBe("Landlord's deadline to account for your deposit");
    expect(card.owes).toMatch(/does not decide what you are owed/);
    expect(card.due).toBe(`Due ${formatDate("2026-11-09", "en")} · in 17 days`);
    expect(card.deletable).toBe(false);
    expect(card.legalNote).toMatch(/legal fact/);
    expect(card.legalNote).toMatch(/Dismiss hides it on Reminders/);
    expect(card.legalNote).toMatch(/Mark done closes it/);
  });

  it("translates the due phrase and a custom reminder", () => {
    expect(duePhrase("2026-10-30", today, "es")).toMatch(/^Vence el .+ · en 7 días$/);
    const [card] = deadlineCards([{
      id: "c1",
      kind: "custom_reminder",
      ruleId: "tenant-reminder",
      anchorDate: null,
      dueDate: null,
      explanation: "Llamar por el fregadero",
      explanationEs: "Llamar por el fregadero",
      computation: "Tenant-added reminder.",
      sourceId: null,
      status: "open",
      tenantReminderOn: "2026-11-02",
    }], [], "es", today);
    expect(card.due).toBeNull();
    expect(card.title).toBe("Llamar por el fregadero");
    expect(card.owes).toMatch(/No es una fecha legal/);
    expect(card.reminder).toMatch(/^Su recordatorio: /);
    expect(card.sortOn).toBe("2026-11-02");
    expect(card.closed).toBe(false);
    expect(card.deletable).toBe(true);
    expect(card.legalNote).toBeNull();
    expect(recordsLabels("en").deleteConfirm).toBe("Delete this reminder?");
    expect(recordsLabels("es").deleteConfirm).toBe("¿Eliminar este recordatorio?");
    expect(recordsLabels("es").deleteReminder).toBe("Eliminar");
    expect(recordsLabels("es").dismissReminder).toBe("Descartar");
    expect(recordsLabels("es").undo).toBe("Deshacer");
    expect(recordsLabels("es").deletedToast).toBe("Recordatorio eliminado");
    expect(recordsLabels("es").dismissedToast).toBe("Recordatorio descartado");
    const [hidden] = deadlineCards([{
      id: "c2",
      kind: "deposit",
      ruleId: "CA-CC-1950.5",
      anchorDate: "2026-10-01",
      dueDate: "2026-10-22",
      explanation: "21 days.",
      explanationEs: "21 días.",
      computation: "math",
      sourceId: null,
      status: "dismissed",
      tenantReminderOn: null,
    }], [], "es", today);
    expect(hidden.closed).toBe(true);
    expect(hidden.deletable).toBe(false);
    expect(hidden.legalNote).toMatch(/dato legal/);
    expect(hidden.legalNote).toMatch(/Descartar/);
    expect(reminderNote(false, "es")).toMatch(/se queda en la app/);
    expect(reminderNote(true, "en")).toMatch(/emails you/);
    expect(reminderNote(true, "en")).toMatch(/Nothing is sent to the landlord/);
  });

  it("gives a log row a title, status, time, and message", () => {
    const [row] = logCards([{
      id: "log1",
      type: "repair",
      description: "Kitchen sink leak.",
      eventDate: "2026-10-23",
      createdAt: "2026-10-23T18:05:00.000Z",
    }], [
      { logEntryId: "log1", direction: "outbound", subject: "Kitchen sink leak", deliveryStatus: "delivered", createdAt: "2026-10-23T18:05:00.000Z" },
      { logEntryId: "log1", direction: "inbound", subject: "Re: Kitchen sink leak", deliveryStatus: "received", createdAt: "2026-10-24T16:00:00.000Z" },
    ], "en");
    expect(row.title).toBe("Repair request");
    expect(row.status).toBe("Reply from the landlord");
    expect(row.when).toMatch(/2026/);
    expect(row.issue).toBe("Kitchen sink leak.");
    expect(row.message).toBe("With the message “Kitchen sink leak” Reply: “Re: Kitchen sink leak”");
    expect(row.line).toBe("Repair request · Reply from the landlord");
  });

  it("picks at most three next steps and does not email from them", () => {
    const waiting = nextSteps({
      locale: "en",
      today,
      hasRecords: true,
      logs: [{ id: "log1", type: "repair", description: "Kitchen sink leak.", eventDate: today, createdAt: `${today}T18:00:00.000Z` }],
      messages: [{ logEntryId: "log1", direction: "outbound", subject: "Leak", deliveryStatus: "sent", createdAt: `${today}T18:00:00.000Z` }],
      deadlines: [{
        id: "d1", kind: "repair", ruleId: "CA-CC-1942", anchorDate: today, dueDate: "2026-10-30",
        explanation: "", explanationEs: "", computation: "", sourceId: "log1", status: "open", tenantReminderOn: null,
      }],
    });
    expect(waiting.items.map((item) => item.action)).toEqual(["wait", "export", "small_claims"]);
    expect(waiting.items[0].title).toBe("Wait for the landlord until Oct 30, 2026");
    expect(waiting.items[0].detail).toMatch(/does not mean the landlord must answer/);
    expect(waiting.items.every((item) => item.action !== "send" || item.detail.match(/confirm/))).toBe(true);

    const due = nextSteps({
      locale: "en",
      today: "2026-10-30",
      hasRecords: true,
      logs: [{ id: "log1", type: "repair", description: "Kitchen sink leak.", eventDate: today, createdAt: `${today}T18:00:00.000Z` }],
      messages: [{ logEntryId: "log1", direction: "outbound", subject: "Leak", deliveryStatus: "delivered", createdAt: `${today}T18:00:00.000Z` }],
      deadlines: [{
        id: "d1", kind: "repair", ruleId: "CA-CC-1942", anchorDate: today, dueDate: "2026-10-30",
        explanation: "", explanationEs: "", computation: "", sourceId: "log1", status: "open", tenantReminderOn: null,
      }],
    });
    expect(due.items[0].action).toBe("followup");
    expect(due.items[0].button).toBe("Send follow-up");

    const unsent = nextSteps({
      locale: "es",
      today,
      hasRecords: true,
      logs: [{ id: "log1", type: "repair", description: "Fuga.", eventDate: today, createdAt: `${today}T18:00:00.000Z` }],
      messages: [],
      deadlines: [],
    });
    expect(unsent.title).toBe("Sus próximos pasos");
    expect(unsent.items.map((item) => item.action)).toEqual(["send", "export", "small_claims"]);
    expect(unsent.items).toHaveLength(3);

    const resolved = nextSteps({
      locale: "en",
      today,
      hasRecords: true,
      logs: [{ id: "log1", type: "repair", description: "Kitchen sink leak.", eventDate: today, createdAt: `${today}T18:00:00.000Z`, status: "resolved" }],
      messages: [],
      deadlines: [{
        id: "d1", kind: "repair", ruleId: "CA-CC-1942", anchorDate: today, dueDate: "2026-10-30",
        explanation: "", explanationEs: "", computation: "", sourceId: "log1", status: "resolved", tenantReminderOn: null,
      }],
    });
    expect(resolved.items.map((item) => item.action)).toEqual(["export", "small_claims"]);
  });
});

describe("evidence packet", () => {
  it("says it is a record of communications and points at small claims self-help", async () => {
    const lines = packetLines({
      user: { name: "Maya Chen", email: "demo@rentright.local" } as User,
      unit: {
        street: "1842 N Echo Park Ave",
        unitNumber: "3",
        city: "Los Angeles",
        postalCode: "90026",
        jurisdiction: "city_la",
        jurisdictionConfirmed: true,
        landlordName: "Elena Vasquez",
        landlordEmail: "elena@example.com",
        relayLocal: "unit",
        rentCents: 215000,
      } as Unit,
      logs: [{
        eventDate: "2026-10-23",
        createdAt: "2026-10-23T18:00:00.000Z",
        type: "repair",
        description: "Kitchen sink leak.",
        contentHash: "abc",
        prevHash: "def",
        version: 1,
        photoFileId: "photo-1",
      }],
      messages: [{
        createdAt: "2026-10-24T16:00:00.000Z",
        direction: "inbound",
        fromEmail: "elena@example.com",
        toEmail: "unit@relay.example",
        ccEmail: null,
        subject: "Re: Kitchen sink leak",
        body: "I will send someone next week.",
        deliveryStatus: "received",
        deliveryDetail: null,
        openIndicative: false,
      }],
      deadlines: [{
        ruleId: "CA-CC-1942",
        kind: "repair",
        dueDate: "2026-10-30",
        computation: "2026-10-23 + 7 days = 2026-10-30",
        explanation: "It is not a determination that the landlord broke the law on that date.",
        status: "open",
        tenantReminderOn: "2026-10-28",
        createdAt: "2026-10-23T18:01:00.000Z",
      }],
      ledger: [],
      deposit: null,
      conditions: [],
      leaseNotes: [{ quote: "Tenant waives the right to a jury.", ruleId: "CA-CC-1953", filename: "lease.txt" }],
    });
    const text = lines.join("\n");
    expect(text).toMatch(/record of communications/);
    expect(text).toMatch(/not legal advice and it is not a court filing/);
    expect(text).toMatch(/A photo is stored with this note/);
    expect(text).toMatch(/Reply from the landlord/);
    expect(text).toMatch(/Tenant reminder: 2026-10-28/);
    expect(text).toMatch(/does not change the computed date/);
    expect(text).toMatch(/Tenant waives the right to a jury/);
    expect(text).toMatch(/Small claims is a self-help option/);
    expect(text).toContain("https://selfhelp.courts.ca.gov/small-claims");
    expect(text).toContain(DISCLAIMER_EN);
    const pdf = await renderPdf("Factual evidence packet", lines);
    expect(Buffer.from(pdf.subarray(0, 5)).toString("utf8")).toBe("%PDF-");
  });
});
