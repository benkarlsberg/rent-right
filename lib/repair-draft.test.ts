import { describe, expect, it } from "vitest";
import { cleanLetterText, repairDraftLetter, repairLegalNote, repairOpening } from "@/lib/repair-draft";

const address = "1842 N Echo Park Ave, Unit 9\nLos Angeles, CA 90026";

describe("repair draft letter", () => {
  it("keeps a routine repair to the opening, the issue, the date, and the statute", () => {
    const letter = repairDraftLetter({
      locale: "en",
      tenantName: "Ada Tenant",
      description: "The kitchen sink is leaking under the cabinet",
      eventDate: "2026-10-23",
      address,
      severity: "leak",
    });
    expect(letter.ruleId).toBe("CA-CC-1942");
    expect(letter.dueDate).toBe("2026-11-22");
    expect(letter.subject).toBe("Repair request: kitchen sink is leaking under the cabinet");
    expect(letter.subject.length).toBeLessThanOrEqual(60);
    expect(letter.body).toBe(
      [
        "I'm writing about a repair.",
        "",
        "Issue: The kitchen sink is leaking under the cabinet",
        "Date: Oct 23, 2026",
        "",
        repairLegalNote("en", "routine"),
      ].join("\n"),
    );
    expect(letter.body).not.toContain("1842");
    expect(letter.body).not.toContain("Please repair this.");
    expect(letter.body).not.toContain("CA-CC-1942");
    expect(letter.body).not.toMatch(/reminder date/i);
    expect(letter.body).not.toMatch(/\d{4}-\d{2}-\d{2} \+ /);
  });

  it("uses the health-and-safety note for an urgent repair", () => {
    const letter = repairDraftLetter({
      locale: "en",
      tenantName: "Ada Tenant",
      description: "No heat in the apartment",
      eventDate: "2026-10-27",
      address,
      severity: "no_heat",
      tier: "urgent",
    });
    expect(letter.ruleId).toBe("CA-CC-1942");
    expect(letter.dueDate).toBe("2026-10-30");
    expect(letter.body).toBe(
      [
        repairOpening("en"),
        "",
        "Issue: No heat in the apartment",
        "Date: Oct 27, 2026",
        "",
        "This affects health or safety, so please repair it as soon as possible, within a short reasonable time. California Civil Code §1942.",
      ].join("\n"),
    );
  });

  it("keeps a possible violation neutral", () => {
    const letter = repairDraftLetter({
      locale: "en",
      tenantName: "Ada Tenant",
      description: "The landlord entered without notice",
      eventDate: "2026-10-27",
      address,
      severity: "other",
      tier: "possible_violation",
    });
    expect(letter.body).toContain("Issue: The landlord entered without notice");
    expect(letter.body).toContain("This may not follow California rules.");
    expect(letter.body).not.toContain("presumed to be 30 days");
    expect(letter.body).not.toContain(letter.ruleId);
  });

  it("rewrites an older letter once and leaves a tenant edit alone", () => {
    const old = [
      "I'm writing about a repair.",
      "",
      address,
      "",
      "Issue: The kitchen sink is leaking under the cabinet",
      "Date: Oct 23, 2026",
      "",
      "Please repair this.",
      "",
      "The 30-day figure is the presumption in Civil Code §1942. The reminder date is 2026-11-22. It is not a decision about anyone's legal responsibility.",
      "",
      "2026-10-23 + 30 days = 2026-11-22 (leak, routine)",
      "Rule CA-CC-1942",
    ].join("\n");
    const cleaned = cleanLetterText(old, "en");
    expect(cleaned).toContain("Issue: The kitchen sink is leaking under the cabinet");
    expect(cleaned).toContain("Date: Oct 23, 2026");
    expect(cleaned).toContain("presumed to be 30 days");
    expect(cleaned).not.toContain("1842");
    expect(cleaned).not.toContain("Rule CA-CC-1942");
    expect(cleaned).not.toMatch(/reminder date/i);
    expect(cleaned).not.toMatch(/\+ 30 days/);
    expect(cleanLetterText(cleaned || "", "en")).toBeNull();
    expect(cleanLetterText("Please repair the kitchen sink leak. The cabinet under the sink is wet.", "en")).toBeNull();
  });
});
