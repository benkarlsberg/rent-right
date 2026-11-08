import { describe, expect, it } from "vitest";
import { answerQuestion, selectRules } from "@/lib/rules/assistant";
import { detectPlace } from "@/lib/rules/detect";
import { depositReturnDeadline, repairReminder, retaliationWindow } from "@/lib/rules/engine";
import { stateRentAnswer } from "@/lib/rules/states";

describe("added state coverage", () => {
  it("classifies the four states and leaves Texas unsupported", () => {
    expect(detectPlace({ city: "Phoenix", region: "AZ", postalCode: "85004" }).jurisdiction).toBe("az");
    expect(detectPlace({ city: "Las Vegas", region: "NV", postalCode: "89101" }).jurisdiction).toBe("nv");
    expect(detectPlace({ city: "Portland", region: "OR", postalCode: "97201" }).jurisdiction).toBe("or");
    expect(detectPlace({ city: "Seattle", region: "WA", postalCode: "98101" }).jurisdiction).toBe("wa");
    expect(detectPlace({ city: "Los Angeles", region: "CA", postalCode: "90026" }).jurisdiction).toBe("city_la");
    expect(detectPlace({ address: "1 Main, Austin, TX 78701" }).jurisdiction).toBe("unsupported");
  });

  it("counts Arizona deposit days without weekends or the observed July 4 holiday", () => {
    const due = depositReturnDeadline("2026-07-02", "AZ");
    expect(due.ruleId).toBe("AZ-ARS-33-1321");
    expect(due.citation).not.toContain("1950.5");
    expect(due.dueDate).toBe("2026-07-23");
    expect(due.explanation).toContain("14 days");
    expect(due.explanation).not.toContain("21 calendar");
  });

  it("uses each state's deposit count and does not borrow California", () => {
    expect(depositReturnDeadline("2026-09-01", "NV")).toMatchObject({ dueDate: "2026-10-01", ruleId: "NV-NRS-118A.242" });
    expect(depositReturnDeadline("2026-09-01", "OR")).toMatchObject({ dueDate: "2026-10-02", ruleId: "OR-ORS-90.300" });
    expect(depositReturnDeadline("2026-09-01", "WA")).toMatchObject({ dueDate: "2026-10-01", ruleId: "WA-RCW-59.18.280" });
    expect(depositReturnDeadline("2026-09-01").ruleId).toBe("CA-CC-1950.5");
    expect(depositReturnDeadline("2026-09-01", "WA").explanation).not.toContain("§1950.5");
  });

  it("uses Washington's 10-day repair period and does not store an hour-based date", () => {
    const ordinary = repairReminder("2026-10-01", "leak", undefined, "WA");
    expect(ordinary.dueDate).toBe("2026-10-11");
    expect(ordinary.ruleId).toBe("WA-RCW-59.18.070");
    expect(ordinary.explanation).not.toContain("§1942");
    const heat = repairReminder("2026-10-01", "no_heat", undefined, "WA");
    expect(heat.dueDate).toBeNull();
    expect(heat.unsure).toBe(true);
    expect(heat.explanation).toContain("24 hours");
  });

  it("uses Arizona's five-day health period and ten-day other period from receipt", () => {
    expect(repairReminder("2026-10-01", "no_heat", undefined, "AZ").dueDate).toBe("2026-10-06");
    expect(repairReminder("2026-10-01", "leak", undefined, "AZ").dueDate).toBe("2026-10-11");
    expect(repairReminder("2026-10-01", "leak", undefined, "NV").dueDate).toBe("2026-10-15");
    expect(repairReminder("2026-10-01", "no_heat", undefined, "OR").dueDate).toBe("2026-10-08");
    expect(repairReminder("2026-10-01", "leak", undefined, "OR").dueDate).toBe("2026-10-31");
  });

  it("does not apply California's 180-day retaliation window outside California", () => {
    const activity = "2026-01-01";
    const later = "2026-06-01";
    expect(retaliationWindow(activity, later, "NV").flagged).toBe(false);
    expect(retaliationWindow(activity, later, "NV").explanation).not.toContain("§1942.5");
    expect(retaliationWindow(activity, later, "OR").flagged).toBe(false);
    expect(retaliationWindow(activity, "2026-04-01", "WA").flagged).toBe(true);
    expect(retaliationWindow(activity, "2026-04-02", "WA").flagged).toBe(false);
    expect(retaliationWindow(activity, "2026-07-01", "AZ").flagged).toBe(true);
    expect(retaliationWindow(activity, "2026-07-02", "AZ").flagged).toBe(false);
    expect(retaliationWindow(activity, later).ruleId).toBe("CA-CC-1942.5");
  });

  it("answers a Washington rent question from Washington rules only", () => {
    const selected = selectRules("Is a rent increase over 10 percent allowed?", "WA");
    expect(selected.rules.every((item) => item.jurisdiction === "WA")).toBe(true);
    expect(selected.rules.some((item) => item.id.startsWith("CA-"))).toBe(false);
    const answer = answerQuestion("Is a rent increase over 10 percent allowed?", "en", "WA");
    expect(answer.text).not.toContain("Civil Code");
    expect(answer.ruleIds).toContain("WA-RCW-59.18.700");
  });

  it("does not call a 2026 Oregon increase above 9.5 percent lawful when exemptions are unknown", () => {
    const note = stateRentAnswer({
      state: "OR",
      lowestCents: 200_000,
      proposedCents: 230_000,
      noticeDate: "2026-09-01",
      effectiveDate: "2026-12-15",
      weekToWeek: false,
      firstYear: null,
      claimsExemption: false,
    });
    expect(note.abovePublishedMax).toBe(true);
    expect(note.detailEn).toContain("9.5%");
    expect(note.detailEn).toContain("not a finding");
    expect(note.detailEn).not.toContain("1947.12");
    const exempt = stateRentAnswer({ ...{
      state: "OR" as const,
      lowestCents: 200_000,
      proposedCents: 230_000,
      noticeDate: "2026-09-01",
      effectiveDate: "2026-12-15",
      weekToWeek: false,
      firstYear: null,
      claimsExemption: true,
    } });
    expect(exempt.abovePublishedMax).toBe(false);
  });

  it("keeps a boundary deposit date on the statute's own count", () => {
    expect(depositReturnDeadline("2026-01-10", "WA").dueDate).toBe("2026-02-09");
    expect(depositReturnDeadline("2026-01-31", "OR").dueDate).toBe("2026-03-03");
    expect(depositReturnDeadline("2024-02-10", "NV").dueDate).toBe("2024-03-11");
  });
});
