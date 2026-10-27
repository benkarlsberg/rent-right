import { EMAIL_FOOTER, relayAddress } from "@/lib/text";

export type SendResult = {
  status: "sent" | "failed" | "local_only";
  detail: string;
  providerId: string | null;
};

export function landlordMessageBody(tenantText: string, responseUrl: string): string {
  return [
    tenantText.trim(),
    "",
    `Respond without an account: ${responseUrl}`,
    "You can acknowledge, give a schedule, mark the issue fixed, dispute it, or block later non-essential mail.",
    EMAIL_FOOTER,
  ].join("\n");
}

export async function sendRelayEmail(input: {
  relayLocal: string;
  to: string;
  cc: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: string }[];
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
  const from = process.env.RESEND_FROM || `Rent Right <${fromAddress}>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        cc: [input.cc],
        reply_to: fromAddress,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      return { status: "failed", detail: json.message || `Email provider returned ${response.status}.`, providerId: null };
    }
    return { status: "sent", detail: "Accepted by the email provider. Delivery status updates when a webhook arrives.", providerId: json.id || null };
  } catch (error) {
    return { status: "failed", detail: error instanceof Error ? error.message : "Email send failed.", providerId: null };
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
