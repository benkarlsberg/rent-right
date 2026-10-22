import { describe, expect, it } from "vitest";
import { messageText } from "./plain";

describe("inbound mail text", () => {
  it("reads a plain message", () => {
    const parsed = messageText("Subject: Leak\nContent-Type: text/plain\n\nThe sink is leaking.\n");
    expect(parsed).toEqual({ subject: "Leak", text: "The sink is leaking." });
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
    expect(messageText(raw)).toEqual({ subject: "Sink", text: "The sink is leaking." });
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
});
