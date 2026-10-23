import { describe, expect, it } from "vitest";
import { DISCLAIMER_EN } from "@/lib/disclaimer";
import { homeLegalFooter, privacyDocument, termsDocument } from "@/lib/legal-html";
import { GET as privacy } from "@/app/privacy/route";
import { GET as terms } from "@/app/terms/route";

describe("public legal pages", () => {
  it("puts the contact address and the disclaimer in crawlable HTML", async () => {
    expect(privacyDocument).toContain("benelliot16@gmail.com");
    expect(privacyDocument).toContain("not a law firm");
    expect(privacyDocument).toContain("only after you confirm");
    expect(termsDocument).toContain(DISCLAIMER_EN);
    expect(termsDocument).toContain("not a decision about your home");
    expect(homeLegalFooter).toContain('href="/privacy"');
    expect(homeLegalFooter).toContain('href="/terms"');
    const privacyBody = await (await privacy()).text();
    const termsBody = await (await terms()).text();
    expect(privacyBody).toContain("<h1>Privacy policy</h1>");
    expect(termsBody).toContain("<h1>Terms of use</h1>");
    expect(privacyBody).not.toContain("id=\"root\"");
  });
});
