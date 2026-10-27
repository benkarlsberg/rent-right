import { describe, expect, it } from "vitest";
import { messageText, stripQuotedReply } from "./plain";

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
});
