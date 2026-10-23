import type { Locale } from "@/lib/disclaimer";
import { daysBetween, todayISO } from "@/lib/rules/dates";
import { tx } from "@/lib/text";

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9$,. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ResolutionSource = "tenant" | "landlord";

export type ResolutionSpan = {
  unit: "hours" | "days";
  count: number;
};

const HOUR_MS = 3_600_000;

function instant(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid timestamp ${value}`);
  return parsed;
}

/** Elapsed time from the request's original timestamp to the resolution timestamp. */
export function resolutionSpan(reportedAt: string, resolvedAt: string): ResolutionSpan {
  const ms = Math.max(0, instant(resolvedAt) - instant(reportedAt));
  const hours = Math.floor(ms / HOUR_MS);
  if (hours < 24) return { unit: "hours", count: hours };
  const startDay = new Date(instant(reportedAt)).toISOString().slice(0, 10);
  const endDay = new Date(instant(resolvedAt)).toISOString().slice(0, 10);
  return { unit: "days", count: Math.max(1, daysBetween(startDay, endDay)) };
}

export function resolutionPhrase(reportedAt: string, resolvedAt: string, locale: Locale): string {
  const span = resolutionSpan(reportedAt, resolvedAt);
  if (span.unit === "hours") {
    if (span.count < 1) return tx(locale, "Resolved in less than an hour", "Resuelto en menos de una hora");
    if (span.count === 1) return tx(locale, "Resolved in 1 hour", "Resuelto en 1 hora");
    return tx(locale, `Resolved in ${span.count} hours`, `Resuelto en ${span.count} horas`);
  }
  if (span.count === 1) return tx(locale, "Resolved in 1 day", "Resuelto en 1 día");
  return tx(locale, `Resolved in ${span.count} days`, `Resuelto en ${span.count} días`);
}

export function sourceLabel(source: ResolutionSource | null, locale: Locale): string | null {
  if (source === "tenant") return tx(locale, "Tenant marked", "Marcado por el inquilino");
  if (source === "landlord") return tx(locale, "Landlord confirmed", "Confirmado por el propietario");
  return null;
}

export function issueTitle(description: string, fallback = "request"): string {
  const clean = description.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  const sentence = (clean.split(/(?<=[.!?])\s/)[0] || clean).replace(/[.!?]+$/, "");
  const stripped = sentence.replace(/^(my |the |el |la |los |las )/i, "");
  const text = (stripped || sentence).trim();
  const capped = text.length <= 80 ? text : `${text.slice(0, 77).trim()}…`;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

const RESOLVED_CLAIM = /\b(is fixed|was fixed|got fixed|gets fixed|been fixed|its fixed|it s fixed|they fixed|he fixed|she fixed|already fixed|all fixed|has been repaired|was repaired|is repaired|got repaired|been repaired|esta arreglad[oa]|quedo arreglad[oa]|esta reparad[oa]|lo arreglaron|la arreglaron|los arreglaron|ya funciona)\b/;
const NOT_RESOLVED = /\b(not fixed|isn t fixed|isnt fixed|still broken|still leaking|no esta arreglad|no lo arreglaron|todavia|sigue)\b/;

export function isResolvedClaim(text: string): boolean {
  const value = fold(text);
  if (!value || NOT_RESOLVED.test(value)) return false;
  if (/\bmark\b.{0,48}\b(resolved|fixed|arreglad)/.test(value)) return true;
  return RESOLVED_CLAIM.test(value);
}

const MATCH_SKIP = new Set([
  "fixed", "repaired", "resolved", "already", "really", "still", "this", "that", "with", "from", "have", "been",
  "they", "them", "your", "just", "mark", "confirm", "landlord", "propietario", "arreglado", "arreglada",
  "arreglaron", "reparado", "reparada", "repararon", "funciona", "esta", "quedo",
]);

export function matchOpenIssue<T extends { id: string; description: string; room: string | null }>(text: string, issues: T[]): T | null {
  if (issues.length === 0) return null;
  if (issues.length === 1) return issues[0];
  const words = fold(text).split(" ").filter((word) => word.length > 3 && !MATCH_SKIP.has(word));
  const scoreOf = (item: T) => {
    const hay = fold(`${item.room || ""} ${item.description}`);
    return words.reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0);
  };
  let bestScore = 0;
  for (const item of issues) bestScore = Math.max(bestScore, scoreOf(item));
  if (bestScore === 0) return null;
  const tied = issues.filter((item) => scoreOf(item) === bestScore);
  return tied.length === 1 ? tied[0] : null;
}

export function resolutionTimestamp(input: { reportedAt: string; eventDate: string; chosen: string | null; now?: Date }): string {
  const now = input.now ?? new Date();
  const today = todayISO(now);
  const chosen = (input.chosen || "").trim() || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(chosen)) throw new Error("Use a real date.");
  parseChosen(chosen);
  if (chosen > today) throw new Error("The resolution date cannot be in the future.");
  const reportedDay = new Date(instant(input.reportedAt)).toISOString().slice(0, 10);
  const earliest = input.eventDate && input.eventDate < reportedDay ? input.eventDate : reportedDay;
  if (chosen < earliest) throw new Error("The resolution date cannot be before the request.");
  if (chosen === today) return now.toISOString();
  return `${chosen}T12:00:00.000Z`;
}

function parseChosen(iso: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error("Use a real date.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== iso) throw new Error("Use a real date.");
}

export function timelineSummary(input: {
  locale: Locale;
  reportedLabel: string;
  messages: number;
  replies: number;
  sourceLabel: string | null;
  resolvedLabel: string | null;
}): string {
  const parts = [tx(input.locale, `Reported ${input.reportedLabel}`, `Reportado el ${input.reportedLabel}`)];
  if (input.messages > 0) {
    parts.push(input.messages === 1
      ? tx(input.locale, "1 message", "1 mensaje")
      : tx(input.locale, `${input.messages} messages`, `${input.messages} mensajes`));
  }
  if (input.replies > 0) {
    parts.push(input.replies === 1
      ? tx(input.locale, "1 reply", "1 respuesta")
      : tx(input.locale, `${input.replies} replies`, `${input.replies} respuestas`));
  }
  if (input.sourceLabel && input.resolvedLabel) parts.push(`${input.sourceLabel} · ${input.resolvedLabel}`);
  return parts.join(" · ");
}

export function landlordFixedNote(flags: Record<string, unknown> | null | undefined): string | null {
  const note = flags?.landlordFixedNote;
  return typeof note === "string" && note.trim() ? note.trim() : null;
}
