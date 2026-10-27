import { afterEach, describe, expect, it, vi } from "vitest";
import { sendRelayEmail } from "@/lib/email";

describe("sendRelayEmail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
  });

  it("refuses an invalid landlord address before calling the provider", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await sendRelayEmail({
      relayLocal: "u-abc12345",
      to: "not-an-email",
      cc: "tenant@example.com",
      subject: "Hello",
      text: "Hello",
    });
    expect(result.status).toBe("failed");
    expect(result.detail).toMatch(/not valid/);
    expect(result.providerId).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the provider's error instead of marking the message sent", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM = "Rent Right <notices@rentrightportal.com>";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Domain is not verified." }), { status: 403 }));
    const result = await sendRelayEmail({
      relayLocal: "u-abc12345",
      to: "landlord@example.com",
      cc: "tenant@example.com",
      subject: "Hello",
      text: "Hello",
      attachments: [{ filename: "tap.png", content: "aGk=", contentType: "image/png" }],
    });
    expect(result.status).toBe("failed");
    expect(result.detail).toBe("Domain is not verified.");
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as { attachments: { content_type: string }[]; cc: string[] };
    expect(body.attachments[0]?.content_type).toBe("image/png");
    expect(body.cc).toEqual(["tenant@example.com"]);
  });

  it("does not mark a message sent when the provider returns no id", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "" }), { status: 200 }));
    const result = await sendRelayEmail({
      relayLocal: "u-abc12345",
      to: "landlord@example.com",
      cc: "landlord@example.com",
      subject: "Hello",
      text: "Hello",
    });
    expect(result.status).toBe("failed");
    expect(result.detail).toMatch(/did not accept/);
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as { cc?: string[] };
    expect(body.cc).toBeUndefined();
  });
});
