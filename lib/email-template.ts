import { SHORT_CODE_PATTERN } from "@/lib/crypto";
import { appUrl } from "@/lib/text";

const FOOTER = "General information, not legal advice. Rent Right is not a law firm.";

export type MailButton = { label: string; href: string };

export type MailInput = {
  subject: string;
  heading: string;
  paragraphs?: string[];
  button?: MailButton;
  lines?: string[];
};

export function emailLogoUrl(): string {
  return `${appUrl()}/email/logo.png`;
}

export function signInUrl(token: string): string {
  if (SHORT_CODE_PATTERN.test(token)) return `${appUrl()}/s/${token}`;
  return `${appUrl()}/auth/verify?token=${encodeURIComponent(token)}`;
}

export function signInMessage(href: string): { subject: string; text: string; html: string } {
  return renderMail({
    subject: "Your Rent Right sign-in link",
    heading: "Sign in to Rent Right",
    button: { label: "Sign in to Rent Right", href },
    lines: ["This link expires in 30 minutes.", "If you didn't ask for this, you can ignore it."],
  });
}

export function renderMail(input: MailInput): { subject: string; text: string; html: string } {
  const paragraphs = (input.paragraphs || []).map((line) => line.trim()).filter(Boolean);
  const lines = (input.lines || []).map((line) => line.trim()).filter(Boolean);
  const text = [
    "Rent Right",
    "",
    input.heading,
    "",
    ...paragraphs.flatMap((line) => [line, ""]),
    input.button ? `${input.button.label}: ${input.button.href}` : "",
    input.button ? "" : "",
    ...lines,
    "",
    FOOTER,
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAF9;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(lines[0] || input.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF9;margin:0;padding:0;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #D5E3E4;border-radius:16px;border-top:4px solid #14A38B;">
<tr><td style="padding:28px 28px 8px;">
<img src="${escapeHtml(emailLogoUrl())}" width="240" alt="Rent Right" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:240px;">
</td></tr>
<tr><td style="padding:12px 28px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:22px;line-height:28px;color:#14343C;font-weight:700;">
${escapeHtml(input.heading)}
</td></tr>
${paragraphs.map((line) => `<tr><td style="padding:12px 28px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#14343C;">${escapeHtml(line)}</td></tr>`).join("")}
${input.button ? `<tr><td style="padding:24px 28px 8px;">
<a href="${escapeHtml(input.button.href)}" style="display:inline-block;background:#0B5C6E;color:#ffffff;text-decoration:none;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:20px;font-weight:700;padding:14px 22px;border-radius:999px;">${escapeHtml(input.button.label)}</a>
</td></tr>
<tr><td style="padding:8px 28px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;line-height:18px;color:#3D5A62;">
${escapeHtml(input.button.href)}
</td></tr>` : ""}
${lines.map((line) => `<tr><td style="padding:12px 28px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;color:#3D5A62;">${escapeHtml(line)}</td></tr>`).join("")}
<tr><td style="padding:20px 28px 24px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#3D5A62;">
${escapeHtml(FOOTER)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: input.subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
