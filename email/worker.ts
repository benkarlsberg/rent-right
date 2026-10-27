import { messageText } from "./plain";

type InboundMessage = {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream<Uint8Array>;
  setReject(reason: string): void;
};

type MailEnv = {
  EMAIL_WEBHOOK_SECRET?: string;
  INBOUND_URL?: string;
};

const inboundUrl = "https://api.rentrightportal.com/api/email/inbound";

const mailWorker = {
  async email(message: InboundMessage, env: MailEnv): Promise<void> {
    const secret = env.EMAIL_WEBHOOK_SECRET;
    if (!secret) {
      message.setReject("Inbound mail is not configured.");
      return;
    }
    const raw = await new Response(message.raw).text();
    const parsed = messageText(raw, message.headers.get("subject") || "");
    let response: Response;
    try {
      response = await fetch(env.INBOUND_URL || inboundUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          subject: parsed.subject,
          text: parsed.text,
          rawText: parsed.rawText,
          messageId: parsed.messageId,
          inReplyTo: parsed.inReplyTo,
          attachments: parsed.attachments,
        }),
      });
    } catch {
      message.setReject("Rent Right could not store this message.");
      return;
    }
    if (response.status === 401 || response.status >= 500) {
      message.setReject("Rent Right could not store this message.");
    }
  },
};

export default mailWorker;
