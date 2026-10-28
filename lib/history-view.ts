import type { Locale } from "@/lib/disclaimer";
import { formatDate } from "@/lib/format";
import { outboundBubble } from "@/lib/phone";
import { daysBetween } from "@/lib/rules/dates";
import { tx } from "@/lib/text";

export type HistoryItem = {
  at: string;
  title: string;
  body: string;
  details?: string[];
  kind?: "tier";
};

const TIER_WINDOW_MS = 2 * 60_000;

export function statuteName(ruleId: string): string {
  const match = /^CA-CC-(\d+(?:\.\d+)?)$/.exec(ruleId);
  if (match) return `Civil Code §${match[1]}`;
  return "";
}

export function reminderHistoryText(input: {
  locale: Locale;
  ruleId: string;
  anchorDate: string | null;
  dueDate: string | null;
}): string {
  const due = input.dueDate?.slice(0, 10) || "";
  const anchor = input.anchorDate?.slice(0, 10) || "";
  const when = due ? formatDate(due, input.locale) : "";
  const days = anchor && due ? daysBetween(anchor, due) : null;
  const statute = statuteName(input.ruleId);
  const pace = days != null && days > 0 ? `${days} ${input.locale === "es" ? "días" : "days"}` : "";
  const aside = [pace, statute].filter(Boolean).join(", ");
  if (when && aside) {
    return tx(input.locale, `Reminder set for ${when} (${aside})`, `Recordatorio puesto para el ${when} (${aside})`);
  }
  if (when) return tx(input.locale, `Reminder set for ${when}`, `Recordatorio puesto para el ${when}`);
  return tx(input.locale, "Reminder saved", "Recordatorio guardado");
}

export function tenantMessagePreview(body: string): string {
  const typed = outboundBubble(body).text;
  const issue = typed.match(/(?:^|\n)(?:Issue|Problema):\s*(.+)/i);
  if (issue?.[1]) return issue[1].trim();
  const skip = /^(i'm writing about|escribo sobre|date:|fecha:|under california|según el código|this affects health|esto afecta la salud|this may not follow|esto puede no seguir|general information|información general)/i;
  const kept = typed.split(/\n+/).map((line) => line.trim()).filter((line) => line && !skip.test(line));
  const text = (kept[0] || typed).replace(/\s+/g, " ").trim();
  if (text.length <= 180) return text;
  return `${text.slice(0, 177).trim()}…`;
}

export function landlordReplyPreview(body: string, providerId: string | null): { title: string; text: string } {
  const raw = body.trim();
  const fromButton = (providerId || "").startsWith("respond:");
  const parts = raw.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const lead = parts[0] || "";
  const note = parts.length > 1 ? parts.slice(1).join("\n\n") : "";
  if (fromButton && /^landlord acknowledged|^el propietario acusó recibo/i.test(lead)) {
    return { title: "Acknowledged", text: note || "Acknowledged" };
  }
  if (fromButton && note) return { title: "Reply from the landlord", text: note };
  const stripped = raw.replace(/^(landlord replied:\s*|el propietario respondió:\s*)/i, "").trim();
  return { title: "Reply from the landlord", text: stripped || "Reply" };
}

export function cardReplyLine(input: { body: string; providerId?: string | null; at: string }, locale: Locale): string {
  const reply = landlordReplyPreview(input.body, input.providerId || null);
  const when = input.at;
  if (reply.title === "Acknowledged") {
    const words = reply.text === "Acknowledged" ? tx(locale, "Acknowledged", "Acusado recibo") : tx(locale, `Acknowledged: ${reply.text}`, `Acusado recibo: ${reply.text}`);
    return when ? `${words} · ${when}` : words;
  }
  const words = tx(locale, `Landlord replied: ${reply.text}`, `El propietario respondió: ${reply.text}`);
  return when ? `${words} · ${when}` : words;
}

function tierWord(value: string, locale: Locale): string {
  if (/^(rules|reglas)$/i.test(value.trim())) return tx(locale, "Possible violation", "Posible infracción");
  return value.trim();
}

export function parseTierChange(description: string, flags?: Record<string, unknown>): { from: string; to: string } | null {
  const fromFlag = typeof flags?.from === "string" ? flags.from : "";
  const toFlag = typeof flags?.to === "string" ? flags.to : "";
  if (fromFlag && toFlag) return { from: fromFlag, to: toFlag };
  const en = /^Tier changed from (.+) to (.+) by tenant\.?$/i.exec(description.trim());
  if (en) return { from: en[1], to: en[2] };
  const es = /^El nivel cambió de (.+) a (.+) por el inquilino\.?$/i.exec(description.trim());
  if (es) return { from: es[1], to: es[2] };
  return null;
}

type TierEvent = HistoryItem & { atIso: string; from: string; to: string };

export function presentHistory(rows: (HistoryItem & { atIso: string; tier?: { from: string; to: string } | null })[], locale: Locale): HistoryItem[] {
  const out: HistoryItem[] = [];
  let burst: TierEvent[] = [];
  const flush = () => {
    if (!burst.length) return;
    const first = burst[0];
    const last = burst[burst.length - 1];
    const from = tierWord(first.from, locale);
    const to = tierWord(last.to, locale);
    const steps = burst.map((item) => `${tierWord(item.from, locale)} → ${tierWord(item.to, locale)}`);
    const same = from.toLowerCase() === to.toLowerCase();
    const body = same
      ? tx(locale, `Left as ${from}.`, `Se quedó en ${from}.`)
      : tx(locale, `Changed from ${from} to ${to}.`, `Cambió de ${from} a ${to}.`);
    out.push({
      at: last.at,
      title: tx(locale, "Tier changed", "Nivel cambiado"),
      body,
      details: burst.length > 1 ? steps : undefined,
      kind: "tier",
    });
    burst = [];
  };
  for (const row of rows) {
    if (row.tier) {
      const previous = burst[burst.length - 1];
      const gap = previous ? new Date(row.atIso).getTime() - new Date(previous.atIso).getTime() : 0;
      if (previous && gap > TIER_WINDOW_MS) flush();
      burst.push({ at: row.at, atIso: row.atIso, title: row.title, body: row.body, from: row.tier.from, to: row.tier.to });
      continue;
    }
    flush();
    out.push({ at: row.at, title: row.title, body: row.body, details: row.details, kind: row.kind });
  }
  flush();
  return out;
}
