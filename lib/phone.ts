import { DISCLAIMER_EN, legalNotice, type LegalNotice, type Locale } from "@/lib/disclaimer";
import { formatDate } from "@/lib/format";
import { daysBetween } from "@/lib/rules/dates";
import { REPLY_LINE } from "@/lib/tenant-mail";

export type BubbleSide = "tenant" | "landlord";

/** Outbound relay mail is the tenant. Inbound replies are the landlord. */
export function messageSide(direction: string): BubbleSide {
  return direction === "inbound" ? "landlord" : "tenant";
}

/** The bubble shows the tenant's words. Relay footer and the response link stay behind "Email details". */
export function chatPreview(body: string): { text: string; detail: string | null } {
  const marker = body.indexOf("\n---\n");
  const respond = body.indexOf("\n\nRespond without an account:");
  let cut = body.length;
  if (marker >= 0) cut = Math.min(cut, marker);
  if (respond >= 0) cut = Math.min(cut, respond);
  const text = body.slice(0, cut).trim();
  const detail = body.slice(cut).trim();
  return { text: text || body.trim(), detail: detail || null };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Name, address, and the reply line belong on the email. The bubble keeps the words the tenant typed. */
export function outboundBubble(body: string): { text: string; detail: string | null } {
  const preview = chatPreview(body);
  const reply = preview.text.replace(new RegExp(`(?:\\n|\\s)*${escapeRegExp(REPLY_LINE)}\\s*$`, "i"), "").trim();
  const blocks = reply.split(/\n{2,}/);
  const head = (blocks[0] || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const wrapped = body.includes(REPLY_LINE);
  if (wrapped && head.length === 3 && blocks.length >= 2 && head.every((line) => line.length <= 120)) {
    const text = blocks.slice(1).join("\n\n").trim();
    if (text) return { text, detail: preview.detail };
  }
  return { text: reply || preview.text, detail: preview.detail };
}

export function failureCause(status: string, detail: string | null): string | null {
  if (!detail) return null;
  if (status !== "failed" && status !== "bounced" && status !== "complained") return null;
  const cleaned = detail
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "the address")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /^email\./i.test(cleaned) || /^accepted by the email provider/i.test(cleaned)) return null;
  return cleaned.slice(0, 180);
}

export function deliveryLabel(status: string, openIndicative: boolean, locale: Locale): string {
  const labels: Record<string, [string, string]> = {
    local_only: ["Saved", "Guardado"],
    sent: ["Sent", "Enviado"],
    delivered: ["Delivered", "Entregado"],
    received: ["Received", "Recibido"],
    failed: ["Not sent", "No enviado"],
    bounced: ["Not sent", "No enviado"],
    complained: ["Not sent", "No enviado"],
    delayed: ["Delayed", "Demorado"],
    opened: ["Delivered", "Entregado"],
    blocked: ["Blocked", "Bloqueado"],
    sending: ["Sending", "Enviando"],
  };
  const pair = labels[status] || [status, status];
  const base = locale === "es" ? pair[1] : pair[0];
  if (!openIndicative && status !== "opened") return base;
  return locale === "es" ? `${base} · abierto` : `${base} · opened`;
}

/** Sent stays Sent. A rejected send names the provider's reason. */
export function deliveryLine(status: string, detail: string | null, openIndicative: boolean, locale: Locale): string {
  const label = deliveryLabel(status, openIndicative, locale);
  const cause = failureCause(status, detail);
  return cause ? `${label}: ${cause}` : label;
}

export function dueLine(due: string | null, today: string, locale: Locale): { title: string; subtitle: string } {
  if (!due) {
    return {
      title: locale === "es" ? "Sin fecha" : "No date",
      subtitle: locale === "es" ? "No se puede precisar" : "Unsure",
    };
  }
  const days = daysBetween(today, due);
  const title = formatDate(due, locale);
  if (days < 0) return { title, subtitle: locale === "es" ? "Fecha pasada" : "Date passed" };
  if (days === 0) return { title, subtitle: locale === "es" ? "Hoy" : "Today" };
  if (days === 1) return { title, subtitle: locale === "es" ? "Mañana" : "Tomorrow" };
  return { title, subtitle: locale === "es" ? `${days} días` : `${days} days` };
}

export function findingStatus(label: string, locale: Locale): string {
  const map: Record<string, [string, string]> = {
    likely_unenforceable: ["Likely unenforceable", "Probablemente no exigible"],
    check_this: ["Check this", "Revisar"],
    looks_standard: ["Looks ordinary", "Parece común"],
    informational: ["Note", "Nota"],
    unsure: ["Unsure", "No se puede precisar"],
  };
  const pair = map[label] || map.unsure;
  return locale === "es" ? pair[1] : pair[0];
}

export function rentHeadline(status: string, locale: Locale): string {
  if (status === "over_cap") return locale === "es" ? "Por encima del tope" : "Above the cap";
  if (status === "within_cap") return locale === "es" ? "Dentro del tope" : "Within the cap";
  return locale === "es" ? "No se puede precisar" : "Not sure";
}

export function logKind(type: string, locale: Locale): string {
  const map: Record<string, [string, string]> = {
    repair: ["Repair", "Reparación"],
    notice_received: ["Notice", "Aviso"],
    conversation: ["Note", "Nota"],
    payment: ["Payment", "Pago"],
    issue_event: ["Record", "Registro"],
  };
  const pair = map[type] || [type.replaceAll("_", " "), type.replaceAll("_", " ")];
  return locale === "es" ? pair[1] : pair[0];
}

export function phoneNotice(locale: Locale): LegalNotice {
  return legalNotice(locale);
}

/** Guard so a short label cannot replace the required full disclaimer. */
export function fullDisclaimerIsCanonical(): boolean {
  return legalNotice("en").full === DISCLAIMER_EN && legalNotice("en").short !== DISCLAIMER_EN;
}
