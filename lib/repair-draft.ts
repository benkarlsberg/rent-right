import { coversLaw } from "@/lib/coverage";
import type { Locale } from "@/lib/disclaimer";
import {
  insertDeadline,
  insertMessage,
  listDeadlines,
  openDraftForLog,
  unitAddress,
  type LogEntry,
  type Message,
  type Unit,
  type User,
} from "@/lib/db";
import { formatDate } from "@/lib/format";
import { repairSubject } from "@/lib/phrase";
import { repairReminder } from "@/lib/rules/engine";
import { relayAddress, tx } from "@/lib/text";
import { asRepairSeverity, reminderPace, tierForSeverity, violationFlag } from "@/lib/triage";

export function confirmedOutbound(status: string): boolean {
  return status === "sent" || status === "delivered" || status === "local_only" || status === "blocked";
}

function severityOf(value: string | null) {
  return asRepairSeverity(value);
}

export function repairDraftLetter(input: {
  locale: Locale;
  tenantName: string;
  description: string;
  eventDate: string;
  address: string;
  severity: string | null;
  tier?: string | null;
  covered?: boolean;
}): { subject: string; body: string; ruleId: string; dueDate: string | null } {
  const locale = input.locale;
  const day = input.eventDate.slice(0, 10);
  const issue = input.description.replace(/\s+/g, " ").trim();
  const subject = repairSubject(issue, locale);
  const date = formatDate(day, locale);
  if (input.covered === false) {
    return {
      subject,
      body: [repairOpening(locale), "", tx(locale, `Issue: ${issue}`, `Problema: ${issue}`), tx(locale, `Date: ${date}`, `Fecha: ${date}`)].join("\n"),
      ruleId: "",
      dueDate: null,
    };
  }
  const severity = severityOf(input.severity);
  const pace = input.tier ? reminderPace(input.tier, input.severity) : undefined;
  const reminder = repairReminder(day, severity, pace);
  const urgent = input.tier ? input.tier === "urgent" : tierForSeverity(severity) === "urgent";
  const tier = input.tier ?? (urgent ? "urgent" : "routine");
  const body = [
    repairOpening(locale),
    "",
    tx(locale, `Issue: ${issue}`, `Problema: ${issue}`),
    tx(locale, `Date: ${date}`, `Fecha: ${date}`),
    "",
    repairLegalNote(locale, tier),
  ].join("\n");
  return { subject, body, ruleId: reminder.ruleId, dueDate: reminder.dueDate };
}

export function repairOpening(locale: Locale): string {
  return tx(locale, "I'm writing about a repair.", "Escribo sobre una reparación.");
}

export function repairLegalNote(locale: Locale, tier: string | null): string {
  if (tier === "possible_violation") {
    return `${violationFlag(locale)}.`;
  }
  if (tier === "urgent") {
    return tx(
      locale,
      "This affects health or safety, so please repair it as soon as possible, within a short reasonable time. California Civil Code §1942.",
      "Esto afecta la salud o la seguridad, así que repárelo lo antes posible, dentro de un plazo breve y razonable. Código Civil de California §1942.",
    );
  }
  return tx(
    locale,
    "Under California Civil Code §1942, repairs like this are generally expected within a reasonable time, presumed to be 30 days.",
    "Según el Código Civil de California §1942, reparaciones como esta generalmente se esperan en un plazo razonable, que se presume de 30 días.",
  );
}

const LETTER_INTERNAL = /\d{4}-\d{2}-\d{2} \+ \d+ days =|(?:^|\n)Rule [A-Za-z0-9.-]+|(?:^|\n)Regla |\breminder date\b|\bfecha del recordatorio\b|not a decision about anyone's legal responsibility|no es una decisión sobre la responsabilidad legal|3-day reminder preset|recordatorio de 3 días/i;

export function letterHasInternals(text: string): boolean {
  return LETTER_INTERNAL.test(text);
}

function addressBlock(block: string): boolean {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 3) return false;
  return /,\s*[A-Z]{2}\s+\d{5}\b/.test(lines[lines.length - 1] || "");
}

/** Drop date math, rule ids, and the reminder essay from a letter the tenant has not rewritten. */
export function cleanLetterText(text: string, locale: Locale): string | null {
  if (!letterHasInternals(text)) return null;
  const urgent = /3-day reminder preset|recordatorio de 3 días|, urgent\)/.test(text);
  const violation = /may not follow California rules|puede no seguir las reglas de California/i.test(text);
  const kept = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean).flatMap((block) => {
    if (addressBlock(block) && !/^(Issue|Problema|Date|Fecha):/i.test(block)) return [];
    const lines = block.split("\n").map((line) => line.trim()).filter((line) => {
      if (/^\d{4}-\d{2}-\d{2} \+ \d+ days =/.test(line)) return false;
      if (/^(Rule|Regla) /.test(line)) return false;
      if (/^Please repair this\.?$/i.test(line) || /^Por favor, repare esto\.?$/i.test(line)) return false;
      if (/^Please reply with a time/i.test(line) || /^Responda con una hora/i.test(line)) return false;
      if (/^Please repair this within a short reasonable time/i.test(line) || /^Repare esto dentro de un plazo breve/i.test(line)) return false;
      return true;
    });
    if (!lines.length) return [];
    const next = lines.join("\n");
    if (LETTER_INTERNAL.test(next) && !/^(Issue|Problema|Date|Fecha):/i.test(next)) return [];
    return [next];
  });
  let cleaned = kept.join("\n\n").trim();
  const opening = repairOpening(locale);
  if (!/^I'm writing about a repair\.|^Escribo sobre una reparación\./.test(cleaned)) {
    cleaned = cleaned ? `${opening}\n\n${cleaned}` : opening;
  }
  const note = repairLegalNote(locale, violation ? "possible_violation" : urgent ? "urgent" : "routine");
  if (!/Civil Code §1942|Código Civil de California §1942|may not follow California rules|puede no seguir las reglas de California/i.test(cleaned)) {
    cleaned = `${cleaned}\n\n${note}`;
  }
  return cleaned.trim();
}

function uniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

export async function ensureRepairDrafts(user: User, unit: Unit, logs: LogEntry[], messages: Message[]): Promise<Message[]> {
  const created: Message[] = [];
  const seen = [...messages];
  for (const log of logs) {
    if (log.type !== "repair" || log.status === "resolved" || log.flags?.removed === true) continue;
    const related = seen.filter((message) => message.logEntryId === log.id && message.direction === "outbound");
    if (related.some((message) => confirmedOutbound(message.deliveryStatus) || message.deliveryStatus === "draft" || message.deliveryStatus === "sending" || message.deliveryStatus === "discarded")) continue;
    const letter = repairDraftLetter({
      locale: user.locale,
      tenantName: user.name,
      description: log.description,
      eventDate: log.eventDate,
      address: unitAddress(unit),
      severity: log.severity,
      tier: log.tier,
      covered: coversLaw(unit),
    });
    try {
      const row = await insertMessage({
        unitId: unit.id,
        userId: user.id,
        logEntryId: log.id,
        direction: "outbound",
        fromEmail: relayAddress(unit.relayLocal),
        toEmail: unit.landlordEmail || "",
        ccEmail: user.email,
        subject: letter.subject,
        body: letter.body,
        deliveryStatus: "draft",
        deliveryDetail: "Draft, not sent yet.",
      });
      created.push(row);
      seen.push(row);
    } catch (error) {
      if (!uniqueViolation(error)) throw error;
      const existing = await openDraftForLog(user.id, unit.id, log.id);
      if (existing) {
        created.push(existing);
        seen.push(existing);
      }
    }
  }
  return created;
}

export async function ensureRepairDeadline(user: User, unit: Unit, log: LogEntry) {
  if (!coversLaw(unit) || log.type !== "repair") return;
  const existing = (await listDeadlines(user.id, unit.id)).find((item) => item.kind === "repair" && item.sourceId === log.id);
  if (existing) return;
  const day = log.eventDate.slice(0, 10);
  const pace = log.flags?.tierManual === true ? reminderPace(log.tier, log.severity) : undefined;
  const reminder = repairReminder(day, severityOf(log.severity), pace);
  await insertDeadline({
    unitId: unit.id,
    ruleId: reminder.ruleId,
    kind: "repair",
    anchorDate: day,
    dueDate: reminder.dueDate,
    explanation: reminder.explanation,
    explanationEs: reminder.explanationEs,
    computation: reminder.computation,
    sourceId: log.id,
    status: "open",
    unsure: reminder.unsure,
  });
}
