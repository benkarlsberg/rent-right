import { describe, expect, it } from "vitest";
import { emailLogoUrl, messageParagraphs, renderMail, signInMessage, signInUrl } from "@/lib/email-template";
import { shortCode } from "@/lib/crypto";

describe("sign-in mail", () => {
  it("uses a short link and a plain-text alternative", () => {
    const code = shortCode();
    expect(code).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{9}$/);
    const href = signInUrl(code);
    expect(href).toMatch(/\/s\/[abcdefghjkmnpqrstuvwxyz23456789]{9}$/);
    const mail = signInMessage(href);
    expect(mail.subject).toBe("Your Rent Right sign-in link");
    expect(mail.text).toContain("Sign in to Rent Right");
    expect(mail.text).toContain(href);
    expect(mail.text).toContain("This link expires in 30 minutes.");
    expect(mail.text).toContain("If you didn't ask for this, you can ignore it.");
    expect(mail.text).toContain("General information, not legal advice. Rent Right is not a law firm.");
    expect(mail.text).not.toMatch(/<[^>]+>/);
    expect(mail.html).toContain('alt="Rent Right"');
    expect(mail.html).toContain(emailLogoUrl());
    expect(emailLogoUrl()).toMatch(/\/email\/logo\.png$/);
    expect(mail.html).toContain("Sign in to Rent Right");
    expect(mail.html).toContain("background:#0B5C6E");
    expect(mail.html).toContain("#14A38B");
    expect(mail.html).toContain("#F8FAF9");
    expect(mail.html).not.toMatch(/<style[\s>]/i);
  });

  it("keeps a long verify link for older tokens", () => {
    expect(signInUrl("abc.def")).toContain("/auth/verify?token=");
  });

  it("escapes tenant text in the shared template", () => {
    const mail = renderMail({
      subject: "Rent Right: a reply was logged",
      heading: "A reply was logged",
      paragraphs: ["A landlord wrote <script>"],
      button: { label: "Open Rent Right", href: "https://app.rentrightportal.com/" },
    });
    expect(mail.html).toContain("A landlord wrote &lt;script&gt;");
    expect(mail.html).not.toContain("<script>");
    expect(mail.text).toContain("A landlord wrote <script>");
    expect(mail.text).toContain("Open Rent Right: https://app.rentrightportal.com/");
  });

  it("keeps a two-line address as a break in HTML and plain text", () => {
    const mail = renderMail({
      subject: "Repair request",
      heading: "Message from your tenant",
      paragraphs: messageParagraphs("Ada Tenant is writing about a repair.\n\n1604 Dover Ave, Apt 2\nThousand Oaks, CA 91360\n\nPlease repair this."),
    });
    expect(mail.text).toContain("1604 Dover Ave, Apt 2\nThousand Oaks, CA 91360");
    expect(mail.html).toContain("1604 Dover Ave, Apt 2<br>Thousand Oaks, CA 91360");
    expect(mail.html).not.toContain("<br><br>");
    expect(mail.text).not.toMatch(/<[^>]+>/);
  });
});
