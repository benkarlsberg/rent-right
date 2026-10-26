import { describe, expect, it } from "vitest";
import { repairDraftLetter } from "@/lib/repair-draft";

describe("repair draft letter", () => {
  it("includes the issue, the home, the tenant, and the rules-engine reminder", () => {
    const letter = repairDraftLetter({
      locale: "en",
      tenantName: "Ada Tenant",
      description: "The kitchen sink is leaking under the cabinet",
      eventDate: "2026-10-23",
      address: "1842 N Echo Park Ave, Unit 9\nLos Angeles, CA 90026",
      severity: "leak",
    });
    expect(letter.ruleId).toBe("CA-CC-1942");
    expect(letter.dueDate).toBe("2026-10-30");
    expect(letter.subject).toBe("Repair request: The kitchen sink is leaking under the cabinet");
    expect(letter.body).toContain("I'm writing about a repair.");
    expect(letter.body).not.toContain("is writing about a repair.");
    expect(letter.body).toContain("1842 N Echo Park Ave, Unit 9\nLos Angeles, CA 90026");
    expect(letter.body).toContain("Issue: The kitchen sink is leaking under the cabinet");
    expect(letter.body).toContain("Date: Oct 23, 2026");
    expect(letter.body).toContain("Please repair this.");
    expect(letter.body).toContain("2026-10-23 + 7 days = 2026-10-30 (leak)");
    expect(letter.body).toContain("Rule CA-CC-1942");
    expect(letter.body).toContain("not a determination that the landlord broke the law");
  });
});
