import { pauseDatabaseClock, releaseReads, resumeDatabaseClock } from "@/lib/pg";
import { REPLY_LINE } from "@/lib/tenant-mail";
import { relayAddress } from "@/lib/text";

export type SendResult = {
  status: "sent" | "failed" | "local_only";
  detail: string;
  providerId: string | null;
  /** The provider may have accepted the message. Retry with the same idempotency key. */
  uncertain?: boolean;
};

export function landlordMessageBody(tenantText: string, responseUrl: string, header = "", footer = "", options = "You can reply, or tap Respond to acknowledge, schedule, or dispute."): string {
  const closing = footer.trim();
  return [
    header.trim(),
    header.trim() ? "" : null,
    tenantText.trim(),
    "",
    REPLY_LINE,
    "",
    `Respond without an account: ${responseUrl}`,
    options,
    closing ? `\n---\n${closing}` : null,
  ].filter((line) => line !== null).join("\n");
}

const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanEmailAddress(value: string): string {
  return value.trim().replace(/^mailto:/i, "");
}

export function emailAddressOk(value: string): boolean {
  return EMAIL_ADDRESS.test(cleanEmailAddress(value));
}

export type MailAttachment = { filename: string; content: string; contentType?: string };

function providerError(json: { message?: unknown }, status: number): string {
  const message = typeof json.message === "string" ? json.message.replace(/\s+/g, " ").trim() : "";
  if (message) return message.slice(0, 300);
  return `Email provider returned ${status}.`;
}

export async function sendRelayEmail(input: {
  relayLocal: string;
  to: string;
  cc: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
  idempotencyKey?: string | null;
}): Promise<SendResult> {
  const fromAddress = relayAddress(input.relayLocal);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      status: "local_only",
      detail: "RESEND_API_KEY is not set. The message is saved in the log and was not sent.",
      providerId: null,
    };
  }
  const to = cleanEmailAddress(input.to);
  if (!emailAddressOk(to)) {
    return { status: "failed", detail: "The landlord email address is not valid.", providerId: null };
  }
  const cc = cleanEmailAddress(input.cc);
  const from = process.env.RESEND_FROM || `Rent Right <${fromAddress}>`;
  const   attachments = (input.attachments || []).filter((item) => item.content).map((item) => ({
    filename: item.filename,
    content: item.content,
    ...(item.contentType ? { content_type: item.contentType } : {}),
  }));
  try {
    await releaseReads();
    pauseDatabaseClock();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: [to],
        ...(emailAddressOk(cc) && cc.toLowerCase() !== to.toLowerCase() ? { cc: [cc] } : {}),
        reply_to: fromAddress,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(attachments.length ? { attachments } : {}),
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      return { status: "failed", detail: providerError(json, response.status), providerId: null };
    }
    if (!json.id) {
      return { status: "failed", detail: "The email provider did not accept the message.", providerId: null };
    }
    return { status: "sent", detail: "Accepted by the email provider. Delivery status updates when a webhook arrives.", providerId: json.id };
  } catch (error) {
    return { status: "failed", detail: error instanceof Error ? error.message : "Email send failed.", providerId: null, uncertain: true };
  } finally {
    resumeDatabaseClock();
  }
}

const PROVIDER_EVENT: Record<string, { status: string; open?: boolean; detail: string }> = {
  sent: { status: "sent", detail: "Accepted by the email provider." },
  delivered: { status: "delivered", detail: "Delivered." },
  delivery_delayed: { status: "delayed", detail: "Delivery is delayed." },
  bounced: { status: "bounced", detail: "The recipient's mail server rejected the message." },
  complained: { status: "complained", detail: "The recipient marked the message as spam." },
  opened: { status: "delivered", open: true, detail: "Delivered." },
  clicked: { status: "delivered", open: true, detail: "Delivered." },
};

/** Ask Resend what happened after it accepted the message. A missing id or a non-Resend id stays put. */
export async function lookupProviderDelivery(providerId: string): Promise<{ status: string; detail: string; open: boolean } | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !/^[0-9a-f-]{36}$/i.test(providerId)) return null;
  try {
    await releaseReads();
    pauseDatabaseClock();
    const response = await fetch(`https://api.resend.com/emails/${providerId}`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const json = (await response.json().catch(() => null)) as {
      last_event?: string;
      bounce?: { message?: string; type?: string; subType?: string };
    } | null;
    const mapped = PROVIDER_EVENT[json?.last_event || ""];
    if (!mapped) return null;
    const bounce = [json?.bounce?.message, json?.bounce?.subType].filter(Boolean).join(" — ");
    const detail = mapped.status === "bounced" && bounce ? bounce.slice(0, 300) : mapped.detail;
    return { status: mapped.status, detail, open: Boolean(mapped.open) };
  } catch {
    return null;
  } finally {
    resumeDatabaseClock();
  }
}

export async function sendTenantEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: [to],
        subject,
        text,
        ...(html ? { html } : {}),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
