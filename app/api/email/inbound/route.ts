import { logEntryForReply, recordLandlordChatReply, emailProviderId, type InboundPhoto } from "@/lib/inbound-reply";
import { stripQuotedReply } from "@/email/plain";
import { unitByRelay } from "@/lib/db";
import { withActor } from "@/lib/pg";

export async function POST(request: Request) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    rawText?: string;
    messageId?: string;
    attachments?: { name?: string; mime?: string; base64?: string }[];
  } | null;
  if (!body?.to) return new Response("Missing recipient", { status: 400 });
  const to = Array.isArray(body.to) ? body.to.join(",") : body.to;
  const match = to.match(/u-[a-z0-9]+/i);
  if (!match) return new Response("No relay address", { status: 202 });
  return withActor(null, async () => {
    const unit = await unitByRelay(match[0].toLowerCase());
    if (!unit) return new Response("Unknown unit", { status: 202 });
    const raw = body.rawText || body.text || "";
    const display = stripQuotedReply(body.text || raw) || "The reply had no new text.";
    const photos: InboundPhoto[] = [];
    for (const item of body.attachments || []) {
      const base64 = typeof item.base64 === "string" ? item.base64 : "";
      if (!base64) continue;
      photos.push({
        name: item.name || "photo",
        mime: item.mime || "image/jpeg",
        bytes: Buffer.from(base64, "base64"),
      });
    }
    await recordLandlordChatReply({
      unit,
      fromEmail: body.from || unit.landlordEmail || "landlord",
      subject: body.subject || "(no subject)",
      body: display,
      providerId: emailProviderId(body.messageId || "", raw || display),
      logEntryId: await logEntryForReply(unit.id, raw),
      photos,
    });
    return new Response("ok");
  });
}
