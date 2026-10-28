import { describe, expect, it } from "vitest";
import { cardReplyLine, landlordReplyPreview, presentHistory, reminderHistoryText, tenantMessagePreview } from "@/lib/history-view";

describe("history text", () => {
  it("states a reminder in plain words", () => {
    const text = reminderHistoryText({
      locale: "en",
      ruleId: "CA-CC-1942",
      anchorDate: "2026-10-27",
      dueDate: "2026-11-26",
    });
    expect(text).toBe("Reminder set for Nov 26, 2026 (30 days, Civil Code §1942)");
    expect(text).not.toMatch(/CA-CC|Status|2026-11-26/);
  });

  it("keeps the typed repair and drops the letter frame", () => {
    const preview = tenantMessagePreview([
      "Maya Chen",
      "125 Main St, Apt 2",
      "San Diego, CA 92130",
      "",
      "I'm writing about a repair.",
      "",
      "Issue: The kitchen sink is leaking under the cabinet",
      "Date: Oct 27, 2026",
      "",
      "Under California Civil Code §1942, a landlord must repair a problem that makes the home unsafe.",
      "",
      "Reply in this thread.",
    ].join("\n"));
    expect(preview).toBe("The kitchen sink is leaking under the cabinet");
  });

  it("shows an acknowledgement without the email subject", () => {
    const reply = landlordReplyPreview("Landlord acknowledged your request\n\nWill do", "respond:token:digest");
    expect(reply).toEqual({ title: "Acknowledged", text: "Will do" });
    const line = cardReplyLine({
      body: "Landlord acknowledged your request\n\nWill do",
      providerId: "respond:token:digest",
      at: "Oct 27, 2026, 11:50 PM",
    }, "en");
    expect(line).toBe("Acknowledged: Will do · Oct 27, 2026, 11:50 PM");
    expect(line).not.toMatch(/Re:/);
  });

  it("collapses a two-minute tier flurry and keeps one row per settled change", () => {
    const rows = presentHistory([
      { atIso: "2026-10-28T06:50:00.000Z", at: "Oct 27, 2026, 11:50 PM", title: "Record", body: "Tier changed from Routine to Urgent by tenant", tier: { from: "Routine", to: "Urgent" } },
      { atIso: "2026-10-28T06:50:04.000Z", at: "Oct 27, 2026, 11:50 PM", title: "Record", body: "Tier changed from Urgent to Routine by tenant", tier: { from: "Urgent", to: "Routine" } },
      { atIso: "2026-10-28T06:50:08.000Z", at: "Oct 27, 2026, 11:50 PM", title: "Record", body: "Tier changed from Routine to Rules by tenant", tier: { from: "Routine", to: "Rules" } },
      { atIso: "2026-10-28T06:50:12.000Z", at: "Oct 27, 2026, 11:50 PM", title: "Record", body: "Tier changed from Rules to Routine by tenant", tier: { from: "Rules", to: "Routine" } },
    ], "en");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Tier changed");
    expect(rows[0]?.body).toBe("Left as Routine.");
    expect(rows[0]?.details).toEqual([
      "Routine → Urgent",
      "Urgent → Routine",
      "Routine → Possible violation",
      "Possible violation → Routine",
    ]);
    const net = presentHistory([
      { atIso: "2026-10-28T06:50:00.000Z", at: "Oct 27, 2026, 11:50 PM", title: "Record", body: "", tier: { from: "Routine", to: "Urgent" } },
      { atIso: "2026-10-28T06:50:20.000Z", at: "Oct 27, 2026, 11:50 PM", title: "Record", body: "", tier: { from: "Urgent", to: "Possible violation" } },
    ], "en");
    expect(net).toHaveLength(1);
    expect(net[0]?.body).toBe("Changed from Routine to Possible violation.");
    const later = presentHistory([
      { atIso: "2026-10-28T06:50:00.000Z", at: "a", title: "Record", body: "", tier: { from: "Routine", to: "Urgent" } },
      { atIso: "2026-10-28T06:53:00.000Z", at: "b", title: "Record", body: "", tier: { from: "Urgent", to: "Routine" } },
    ], "en");
    expect(later).toHaveLength(2);
  });
});
