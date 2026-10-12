import { DISCLAIMER_EN, DISCLAIMER_SHORT_EN } from "@/lib/disclaimer";
import { chatPreview, deliveryLabel, dueLine, findingStatus, fullDisclaimerIsCanonical, messageSide, rentHeadline } from "@/lib/phone";
import { describe, expect, it } from "vitest";

describe("phone presentation", () => {
  it("keeps the full disclaimer exact and shows a shorter line first", () => {
    expect(DISCLAIMER_EN).toBe(
      "This is general legal information, not legal advice, and no attorney-client relationship is created. Laws change and depend on your facts. For advice, contact a licensed California attorney or legal aid.",
    );
    expect(DISCLAIMER_SHORT_EN).toBe("General information, not legal advice.");
    expect(fullDisclaimerIsCanonical()).toBe(true);
  });

  it("places the tenant on the right and the landlord on the left", () => {
    expect(messageSide("outbound")).toBe("tenant");
    expect(messageSide("inbound")).toBe("landlord");
  });

  it("hides the relay footer behind the bubble text", () => {
    const body = ["The sink is leaking.", "", "Respond without an account: https://example.com/r/abc", "---", "Sent with Rent Right, free for renters."].join("\n");
    const preview = chatPreview(body);
    expect(preview.text).toBe("The sink is leaking.");
    expect(preview.detail).toContain("Respond without an account");
    expect(preview.detail).toContain("Sent with Rent Right");
  });

  it("keeps a plain landlord reply as the bubble", () => {
    expect(chatPreview("I will send someone next week.").text).toBe("I will send someone next week.");
  });

  it("uses a short delivery label", () => {
    expect(deliveryLabel("delivered", false, "en")).toBe("Delivered");
    expect(deliveryLabel("delivered", true, "en")).toBe("Delivered · opened");
    expect(deliveryLabel("local_only", false, "es")).toBe("Guardado");
  });

  it("counts days until a deadline", () => {
    expect(dueLine("2026-10-29", "2026-10-12", "en").subtitle).toBe("17 days");
    expect(dueLine("2026-10-12", "2026-10-12", "en").subtitle).toBe("Today");
    expect(dueLine("2026-10-02", "2026-10-12", "en").subtitle).toBe("Date passed");
    expect(dueLine(null, "2026-10-12", "en").subtitle).toBe("Unsure");
  });

  it("uses short status headlines", () => {
    expect(findingStatus("likely_unenforceable", "en")).toBe("Likely unenforceable");
    expect(findingStatus("unsure", "es")).toBe("No se puede precisar");
    expect(rentHeadline("over_cap", "en")).toBe("Above the cap");
    expect(rentHeadline("unsure", "en")).toBe("Not sure");
  });
});
