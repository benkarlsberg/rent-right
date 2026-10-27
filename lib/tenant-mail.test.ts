import { describe, expect, it } from "vitest";
import { describeTenantMail, mailHeader, outboundSubject, REPLY_LINE, senderForCard } from "@/lib/tenant-mail";

const maya = { name: "maya chen", locale: "en" as const };
const home = {
  street: "1842 N Echo Park Ave",
  unitNumber: "3",
  city: "Los Angeles",
  region: "Los Angeles County",
  postalCode: "90026",
};

describe("tenant mail header", () => {
  it("uses the tenant name and a two-line address", () => {
    const mail = describeTenantMail(maya, home);
    expect(mail.ready).toBe(true);
    if (!mail.ready) return;
    expect(mail.name).toBe("Maya Chen");
    expect(mail.line1).toBe("1842 N Echo Park Ave, Unit 3");
    expect(mail.line2).toBe("Los Angeles, CA 90026");
    expect(mail.line1.match(/Unit/g)).toHaveLength(1);
    expect(mail.subject).toBe("Message from Maya Chen, 1842 N Echo Park Ave, Unit 3");
    expect(mailHeader(mail)).toBe("Maya Chen\n1842 N Echo Park Ave, Unit 3\nLos Angeles, CA 90026");
    expect(mailHeader(mail)).not.toMatch(/The tenant wrote|Message from your tenant/);
  });

  it("keeps a repair subject and replaces a generic one", () => {
    const mail = describeTenantMail(maya, home);
    if (!mail.ready) throw new Error("expected a complete sender");
    expect(outboundSubject("Repair request: Leaking sink", mail)).toBe("Repair request: Leaking sink");
    expect(outboundSubject("Message from your tenant", mail)).toBe(mail.subject);
    expect(outboundSubject("  ", mail)).toBe(mail.subject);
    expect(REPLY_LINE).toBe("Reply to this email or tap Respond.");
  });

  it("refuses to invent a name or an address", () => {
    expect(describeTenantMail({ name: " ", locale: "en" }, home).ready).toBe(false);
    const missingZip = describeTenantMail(maya, { ...home, postalCode: "" });
    expect(missingZip.ready).toBe(false);
    if (!missingZip.ready) expect(missingZip.missing).toMatch(/street, city, and ZIP/);
    const missingBoth = describeTenantMail({ name: "", locale: "en" }, { ...home, street: "" });
    expect(missingBoth.ready).toBe(false);
    if (!missingBoth.ready) expect(missingBoth.missing).toMatch(/Settings/);
    expect(senderForCard({ name: "", locale: "en" }, home, "Add your name in Settings before sending.")).toMatch(/Add your name in Settings/);
    expect(senderForCard(maya, home, "Add your name in Settings before sending.")).toMatch(/^Maya Chen\n/);
    expect(senderForCard(maya, home, "Already sent")).toBe("Already sent");
    expect(describeTenantMail({ name: "JANE DOE", locale: "en" }, { ...home, street: "123 main st", unitNumber: "4", city: "oakland", postalCode: "94612" })).toMatchObject({
      ready: true,
      name: "Jane Doe",
      line1: "123 Main St, Unit 4",
      subject: "Message from Jane Doe, 123 Main St, Unit 4",
    });
  });
});
