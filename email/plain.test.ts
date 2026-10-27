import { describe, expect, it } from "vitest";
import { inboundDisplay, landlordReplyText, messageText, originalEmailText, stripQuotedReply } from "./plain";

describe("inbound mail text", () => {
  it("reads a plain message", () => {
    const parsed = messageText("Subject: Leak\nContent-Type: text/plain\nMessage-ID: <abc@mail>\n\nThe sink is leaking.\n");
    expect(parsed.subject).toBe("Leak");
    expect(parsed.text).toBe("The sink is leaking.");
    expect(parsed.messageId).toBe("<abc@mail>");
    expect(parsed.attachments).toEqual([]);
  });

  it("prefers the plain part and decodes the subject", () => {
    const raw = [
      "Subject: =?UTF-8?Q?Sink?=",
      'Content-Type: multipart/alternative; boundary="bnd"',
      "",
      "--bnd",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "The sink is leaking.",
      "--bnd",
      "Content-Type: text/html",
      "",
      "<p>html</p>",
      "--bnd--",
      "",
    ].join("\n");
    const parsed = messageText(raw);
    expect(parsed.subject).toBe("Sink");
    expect(parsed.text).toBe("The sink is leaking.");
  });

  it("decodes a base64 plain part", () => {
    const raw = [
      "Subject: Photo",
      "Content-Type: text/plain",
      "Content-Transfer-Encoding: base64",
      "",
      "VGhlIHNpbmsgaXMgbGVha2luZy4=",
      "",
    ].join("\n");
    expect(messageText(raw).text).toBe("The sink is leaking.");
  });

  it("keeps the new reply, the respond token in the quote, and an image", () => {
    const pixel = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const raw = [
      "Subject: Re: Kitchen sink",
      "Message-ID: <reply-1@mail>",
      "In-Reply-To: <sent-1@mail>",
      'Content-Type: multipart/mixed; boundary="mix"',
      "",
      "--mix",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "I can come Tuesday.",
      "",
      "On Mon, Oct 26, 2026 at 1:00 PM Maya Chen wrote:",
      "> The sink is leaking.",
      "> Respond without an account: https://app.example/r/tokenvalue1",
      "--mix",
      "Content-Type: image/gif",
      "Content-Transfer-Encoding: base64",
      'Content-Disposition: attachment; filename="leak.gif"',
      "",
      pixel,
      "--mix--",
      "",
    ].join("\n");
    const parsed = messageText(raw);
    expect(parsed.text).toBe("I can come Tuesday.");
    expect(parsed.rawText).toContain("/r/tokenvalue1");
    expect(parsed.messageId).toBe("<reply-1@mail>");
    expect(parsed.inReplyTo).toBe("<sent-1@mail>");
    expect(parsed.attachments).toEqual([{ name: "leak.gif", mime: "image/gif", base64: pixel }]);
    expect(stripQuotedReply("Thanks\n\nOn Monday Maya wrote:\n> old")).toBe("Thanks");
  });

  it("keeps a Gmail reply and drops the On wrote block", () => {
    const text = [
      "I'll send the lease tomorrow.",
      "",
      "On Mon, Oct 26, 2026 at 11:18 PM Maya Chen <maya@example.com> wrote:",
      "> Can I request a copy of the lease please?",
      "> The tenant wrote this message. Rent Right only provides the mailbox.",
      "> Respond without an account: https://app.rentrightportal.com/r/zRqsMCOkZ1KWJsjpMXhnoclkV4QXtiJL",
    ].join("\n");
    expect(stripQuotedReply(text)).toBe("I'll send the lease tomorrow.");
    expect(landlordReplyText(text)).not.toMatch(/\/r\//);
  });

  it("keeps an Outlook reply and drops the original message block", () => {
    const text = [
      "Sure, I can email a copy.",
      "",
      "-----Original Message-----",
      "From: Maya Chen <maya@example.com>",
      "Sent: Monday, October 26, 2026 11:18 PM",
      "To: John Landlord",
      "Subject: Lease copy",
      "",
      "Can I request a copy of the lease please?",
      "The tenant wrote this message. Rent Right only provides the mailbox.",
    ].join("\n");
    expect(stripQuotedReply(text)).toBe("Sure, I can email a copy.");
  });

  it("keeps an iPhone reply and drops the signature and quoted history", () => {
    const text = [
      "Yes, I'll drop it off Friday.",
      "",
      "Sent from my iPhone",
      "",
      "> On Oct 26, 2026, at 11:18 PM, Maya Chen <maya@example.com> wrote:",
      ">",
      "> Can I request a copy of the lease please?",
    ].join("\n");
    expect(stripQuotedReply(text)).toBe("Yes, I'll drop it off Friday.");
  });

  it("drops a Spanish attribution and a signature", () => {
    const text = [
      "Mañana se la envío.",
      "",
      "El lun, 26 oct 2026 a las 23:18, Maya Chen <maya@example.com> escribió:",
      "> ¿Me puede enviar una copia del contrato?",
    ].join("\n");
    expect(stripQuotedReply(text)).toBe("Mañana se la envío.");
    expect(stripQuotedReply("I will send it.\n\n-- \nJohn Landlord\nManager")).toBe("I will send it.");
    expect(stripQuotedReply("On Tuesday I can come by.\nThe plumber is free.")).toBe("On Tuesday I can come by.\nThe plumber is free.");
  });

  it("hides a fully quoted original, including the response link, and keeps it behind the original", () => {
    const wall = [
      "> Can I request a copy of the lease please?",
      "> The tenant wrote this message. Rent Right only provides the mailbox.",
      "> You can acknowledge, give a schedule, mark the issue fixed, dispute it, or",
      "> block later non-essential mail.",
      "> Respond",
      ">",
      "> <https://app.rentrightportal.com/r/zRqs",
      "MCOkZ1KWJsjpMXhnoclkV4QXtiJL>",
      "> https://app.rentrightportal.com/r/zRqsMCOkZ1KWJsjpMXhnoclkV4QXtiJL",
      "> General information, not legal advice. Rent Right is not a law firm.",
    ].join("\n");
    const raw = ["Subject: Re: Lease", "Content-Type: text/plain; charset=utf-8", "", wall, ""].join("\n");
    const parsed = messageText(raw);
    expect(parsed.text).toBe("");
    expect(parsed.rawText).toContain("/r/zRqs");
    const shown = inboundDisplay(wall, null);
    expect(shown.text).toBe("The reply had no new text.");
    expect(shown.text).not.toMatch(/\/r\/|zRqs/);
    expect(shown.original).toContain("Can I request a copy of the lease please?");
    expect(shown.original).toContain("The tenant wrote this message");
    expect(shown.original).not.toMatch(/\/r\/[A-Za-z0-9_-]+|zRqs|MCOkZ1KW/);
    expect(originalEmailText(wall)).not.toMatch(/zRqsMCOk/);
  });

  it("reads the new words from html when the plain part is only quoted history", () => {
    const raw = [
      "Subject: Re: Lease",
      'Content-Type: multipart/alternative; boundary="bnd"',
      "",
      "--bnd",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "> Can I request a copy of the lease please?",
      "--bnd",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<div>I'll email the lease tomorrow.</div><div>On Mon, Oct 26, 2026 at 11:18 PM Maya Chen wrote:</div><blockquote>old lease request</blockquote>",
      "--bnd--",
      "",
    ].join("\n");
    expect(messageText(raw).text).toBe("I'll email the lease tomorrow.");
  });

  it("cuts our own template when a reply client dropped the quote marks", () => {
    const text = [
      "Happy to send it.",
      "",
      "The tenant wrote this message. Rent Right only provides the mailbox.",
      "You can acknowledge, give a schedule, mark the issue fixed, dispute it, or block later non-essential mail.",
      "Respond without an account: https://app.rentrightportal.com/r/zRqsMCOkZ1KWJsjpMXhnoclkV4QXtiJL",
      "General information, not legal advice. Rent Right is not a law firm.",
    ].join("\n");
    expect(landlordReplyText(text)).toBe("Happy to send it.");
  });
});
