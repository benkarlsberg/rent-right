import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/email/inbound/route";
import { getUser, insertMessage, listLogs, listMessages, listNotifications, listPhotos, primaryUnit } from "@/lib/db";
import { landlordWords, logEntryForReply, recordLandlordChatReply, respondNote, respondProviderId, settleQuotedInbound } from "@/lib/inbound-reply";
import { startSampleTenancy } from "@/lib/seed";
import { relayAddress } from "@/lib/text";

const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

describe("landlord replies in the tenant chat", () => {
  it("keeps one Respond reply and one emailed reply, with the photo", async () => {
    const id = await startSampleTenancy();
    const user = await getUser(id);
    const unit = await primaryUnit(id);
    expect(user && unit).toBeTruthy();
    const logs = await listLogs(id, unit!.id);
    const leak = logs.find((log) => /kitchen sink/i.test(log.description));
    expect(leak).toBeTruthy();
    await insertMessage({
      unitId: unit!.id,
      userId: id,
      logEntryId: leak!.id,
      direction: "outbound",
      fromEmail: relayAddress(unit!.relayLocal),
      toEmail: unit!.landlordEmail,
      subject: "Kitchen sink",
      body: "The sink leaks.",
      deliveryStatus: "local_only",
      responseToken: "tokenvalue1",
    });
    expect(await logEntryForReply(unit!.id, "Quoted link https://app.example/r/tokenvalue1")).toBe(leak!.id);

    expect(respondNote("acknowledge", "Tuesday")).toBe("Landlord acknowledged your request\n\nTuesday");
    expect(landlordWords("email", "Sure, I'll get to it tomorrow.")).toBe("Landlord replied: Sure, I'll get to it tomorrow.");
    const providerId = respondProviderId("tokenvalue1", "acknowledge", "Tuesday");
    expect(await recordLandlordChatReply({
      unit: unit!,
      fromEmail: unit!.landlordEmail,
      subject: "Re: Kitchen sink",
      body: respondNote("acknowledge", "Tuesday"),
      providerId,
      logEntryId: leak!.id,
    })).toBe("stored");
    expect(await recordLandlordChatReply({
      unit: unit!,
      fromEmail: unit!.landlordEmail,
      subject: "Re: Kitchen sink",
      body: respondNote("acknowledge", "Tuesday"),
      providerId,
      logEntryId: leak!.id,
    })).toBe("duplicate");

    const previous = process.env.EMAIL_WEBHOOK_SECRET;
    process.env.EMAIL_WEBHOOK_SECRET = "inbound-test-secret";
    try {
      const denied = await POST(new Request("http://localhost/api/email/inbound", {
        method: "POST",
        headers: { authorization: "Bearer wrong", "content-type": "application/json" },
        body: "{}",
      }));
      expect(denied.status).toBe(401);
      const payload = {
        from: "elena.vasquez@example.com",
        to: relayAddress(unit!.relayLocal),
        subject: "Re: Kitchen sink",
        text: "I can come Tuesday.\n\nOn Mon someone wrote:\n> old note",
        rawText: "I can come Tuesday.\n\nOn Mon someone wrote:\n> https://app.example/r/tokenvalue1",
        messageId: "<reply-1@mail>",
        attachments: [{ name: "leak.gif", mime: "image/gif", base64: gif.toString("base64") }],
      };
      const request = () => POST(new Request("http://localhost/api/email/inbound", {
        method: "POST",
        headers: { authorization: "Bearer inbound-test-secret", "content-type": "application/json" },
        body: JSON.stringify(payload),
      }));
      expect((await request()).status).toBe(200);
      expect((await request()).status).toBe(200);
    } finally {
      if (previous == null) delete process.env.EMAIL_WEBHOOK_SECRET;
      else process.env.EMAIL_WEBHOOK_SECRET = previous;
    }

    const inbound = (await listMessages(id, unit!.id)).filter((message) => message.direction === "inbound");
    expect(inbound.filter((message) => message.body.startsWith("Landlord acknowledged your request"))).toHaveLength(1);
    const mailed = inbound.find((message) => message.body.startsWith("I can come Tuesday."));
    expect(mailed?.logEntryId).toBe(leak!.id);
    expect(mailed?.body).not.toMatch(/On Mon/);
    expect(mailed?.body).not.toMatch(/\/r\//);
    expect(mailed?.rawBody).toContain("/r/tokenvalue1");
    expect(mailed?.createdAt).toBeTruthy();
    const photos = await listPhotos(id, unit!.id);
    expect(photos.some((photo) => photo.messageId === mailed?.id && photo.caption === "From the landlord")).toBe(true);
    const notes = await listNotifications(id);
    expect(notes.some((note) => note.title === "Landlord reply" && note.href === "/landlord")).toBe(true);
  });

  it("reprocesses a stored quote wall and keeps the raw email", async () => {
    const id = await startSampleTenancy();
    const unit = await primaryUnit(id);
    expect(unit).toBeTruthy();
    const quoted = [
      "> Can I request a copy of the lease please?",
      "> The tenant wrote this message. Rent Right only provides the mailbox.",
      "> Respond",
      "> https://app.rentrightportal.com/r/zRqsMCOkZ1KWJsjpMXhnoclkV4QXtiJL",
      "> General information, not legal advice. Rent Right is not a law firm.",
    ].join("\n");
    await insertMessage({
      unitId: unit!.id,
      userId: null,
      direction: "inbound",
      fromEmail: unit!.landlordEmail,
      toEmail: relayAddress(unit!.relayLocal),
      subject: "Re: Lease",
      body: quoted,
      deliveryStatus: "received",
      providerId: `email:quote-${randomUUID()}`,
    });
    const settled = await settleQuotedInbound(await listMessages(id, unit!.id));
    const row = settled.find((message) => message.rawBody?.includes("lease please"));
    expect(row?.body).toBe("The reply had no new text.");
    expect(row?.body).not.toMatch(/\/r\/|zRqs/);
    expect(row?.rawBody).toContain("/r/zRqsMCOkZ1KWJsjpMXhnoclkV4QXtiJL");
    const stored = (await listMessages(id, unit!.id)).find((message) => message.id === row?.id);
    expect(stored?.body).toBe("The reply had no new text.");
    expect(stored?.rawBody).toContain("lease please");
    const again = await settleQuotedInbound(await listMessages(id, unit!.id));
    expect(again.find((message) => message.id === row?.id)?.rawBody).toBe(stored?.rawBody);
  });
});
