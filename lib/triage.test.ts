import { describe, expect, it } from "vitest";
import { repairFacts } from "@/lib/chat-intent";
import { repairReminder } from "@/lib/rules/engine";
import {
  aidLinks,
  escalationNote,
  photoPrompt,
  safetySteps,
  shouldEscalate,
  tierForSeverity,
  violationDetail,
  violationFlag,
} from "@/lib/triage";

describe("issue tiers", () => {
  it("treats a leaky faucet as routine and a gas smell as urgent", () => {
    expect(tierForSeverity(repairFacts("the bathroom faucet is dripping").severity)).toBe("routine");
    expect(tierForSeverity(repairFacts("I smell gas").severity)).toBe("urgent");
    expect(tierForSeverity(repairFacts("no working toilet").severity)).toBe("urgent");
    expect(tierForSeverity("mold")).toBe("routine");
  });

  it("uses 30 days for a routine repair and 3 days for an urgent one", () => {
    const routine = repairReminder("2026-10-01", "leak");
    expect(routine.dueDate).toBe("2026-10-31");
    expect(routine.ruleId).toBe("CA-CC-1942");
    const urgent = repairReminder("2026-10-01", "co_alarm");
    expect(urgent.dueDate).toBe("2026-10-04");
    expect(urgent.explanation).toMatch(/not in the statute/i);
    expect(urgent.explanation).not.toMatch(/broke the law/i);
  });

  it("gives safety steps for gas, carbon monoxide, and fire", () => {
    expect(safetySteps("gas_leak", "en")).toMatch(/leave the home now/i);
    expect(safetySteps("gas_leak", "en")).toMatch(/911/);
    expect(safetySteps("co_alarm", "en")).toMatch(/call 911/i);
    expect(safetySteps("fire", "en")).toMatch(/call 911/i);
    expect(safetySteps("wiring", "en")).toMatch(/call 911/i);
    expect(safetySteps("no_heat", "en")).toBeNull();
    expect(photoPrompt("gas_leak", "en")).toMatch(/outside and safe/i);
    expect(photoPrompt("no_heat", "en")).toMatch(/add a photo/i);
  });

  it("flags a failed check without saying the landlord broke the law", () => {
    const text = violationDetail({
      locale: "en",
      citation: "CA-CC-1947.12",
      reason: "The proposed rent is above the chart figure.",
      unsure: false,
      links: aidLinks({ name: "Los Angeles Housing Department", url: "https://housing.lacity.gov/" }),
    });
    expect(text).toContain(violationFlag("en"));
    expect(text).toContain("CA-CC-1947.12");
    expect(text).toContain("https://housing.lacity.gov/");
    expect(text).toContain("https://www.lawhelpca.org/");
    expect(text).not.toMatch(/broke the law|illegal|violat/i);
    expect(violationDetail({
      locale: "en",
      citation: "CA-CC-1954",
      reason: "The notice was under 24 hours.",
      unsure: true,
      links: aidLinks(null),
    })).toContain("Unsure.");
    expect(aidLinks(null).some((link) => link.url.includes("lawhelpca.org"))).toBe(true);
    expect(aidLinks(null).some((link) => /lawyer\.com|avvo|referral/i.test(link.url))).toBe(false);
  });

  it("escalates an unanswered repair only after the reminder date", () => {
    expect(shouldEscalate({ tier: "routine", manual: false, open: true, due: "2026-10-01", today: "2026-10-02", replied: false })).toBe(true);
    expect(shouldEscalate({ tier: "urgent", manual: false, open: true, due: "2026-10-04", today: "2026-10-04", replied: false })).toBe(false);
    expect(shouldEscalate({ tier: "routine", manual: false, open: true, due: "2026-10-01", today: "2026-10-02", replied: true })).toBe(false);
    expect(shouldEscalate({ tier: "routine", manual: true, open: true, due: "2026-10-01", today: "2026-10-02", replied: false })).toBe(false);
    expect(shouldEscalate({ tier: "possible_violation", manual: false, open: true, due: "2026-10-01", today: "2026-10-02", replied: false })).toBe(false);
    const note = escalationNote("en", "2026-10-01", true);
    expect(note).toContain("This may not follow California rules");
    expect(note).toContain("§1942");
    expect(note).toMatch(/unsure/i);
    expect(note).not.toMatch(/broke the law/i);
  });
});
