import { describe, expect, it } from "vitest";
import { followUpTitle, keepsCapital, lowerLead, repairSubject } from "@/lib/phrase";

describe("issue phrases", () => {
  it("starts a reminder with the issue after a colon", () => {
    expect(followUpTitle("The bathroom exhaust fan stopped working", "en")).toBe(
      "Follow up: The bathroom exhaust fan stopped working",
    );
    expect(followUpTitle("El extractor del baño se detuvo", "es")).toBe("Seguimiento: El extractor del baño se detuvo");
  });

  it("lowercases a mid-sentence lead and keeps acronyms and I", () => {
    expect(lowerLead("The bathroom exhaust fan stopped working")).toBe("the bathroom exhaust fan stopped working");
    expect(lowerLead("HVAC is out")).toBe("HVAC is out");
    expect(lowerLead("I have no heat")).toBe("I have no heat");
    expect(keepsCapital("CA")).toBe(true);
    expect(keepsCapital("The")).toBe(false);
  });

  it("builds a short repair subject on a word boundary", () => {
    const subject = repairSubject(
      "The bathroom exhaust fan stopped working and the ceiling has a damp spot. Please repair it soon.",
      "en",
    );
    expect(subject).toBe("Repair request: bathroom exhaust fan stopped working");
    expect(subject.length).toBeLessThanOrEqual(60);
    expect(subject).not.toMatch(/Ple|…|\.\.\./);
    expect(repairSubject("The kitchen sink is leaking under the cabinet", "en")).toBe(
      "Repair request: kitchen sink is leaking under the cabinet",
    );
  });
});
