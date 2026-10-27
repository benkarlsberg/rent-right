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
import { repairReminder } from "@/lib/rules/engine";
import { relayAddress, tx } from "@/lib/text";
import { asRepairSeverity, reminderPace, tierForSeverity, urgentLetterLead } from "@/lib/triage";

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
}): { subject: string; body: string; ruleId: string; dueDate: string | null } {
  const locale = input.locale;
  const day = input.eventDate.slice(0, 10);
  const severity = severityOf(input.severity);
  const pace = input.tier ? reminderPace(input.tier, input.severity) : undefined;
  const reminder = repairReminder(day, severity, pace);
  const urgent = input.tier ? input.tier === "urgent" : tierForSeverity(severity) === "urgent";
  const issue = input.description.replace(/\s+/g, " ").trim();
  const short = issue.length > 80 ? `${issue.slice(0, 77).trim()}…` : issue;
  const subject = tx(locale, `Repair request: ${short}`, `Solicitud de reparación: ${short}`);
  const date = formatDate(day, locale);
  const rule = locale === "es" ? reminder.explanationEs : reminder.explanation;
  const lead = urgent ? urgentLetterLead(locale) : tx(locale, "I'm writing about a repair.", "Escribo sobre una reparación.");
  const ask = urgent
    ? tx(locale, "Please reply with a time when the repair will be done.", "Responda con una hora en que se hará la reparación.")
    : tx(locale, "Please repair this.", "Por favor, repare esto.");
  const body = [
    lead,
    "",
    input.address.trim(),
    "",
    tx(locale, `Issue: ${issue}`, `Problema: ${issue}`),
    tx(locale, `Date: ${date}`, `Fecha: ${date}`),
    "",
    ask,
    "",
    rule,
    "",
    reminder.computation,
    tx(locale, `Rule ${reminder.ruleId}`, `Regla ${reminder.ruleId}`),
  ].join("\n");
  return { subject, body, ruleId: reminder.ruleId, dueDate: reminder.dueDate };
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
    if (related.some((message) => confirmedOutbound(message.deliveryStatus) || message.deliveryStatus === "draft" || message.deliveryStatus === "discarded")) continue;
    const letter = repairDraftLetter({
      locale: user.locale,
      tenantName: user.name,
      description: log.description,
      eventDate: log.eventDate,
      address: unitAddress(unit),
      severity: log.severity,
      tier: log.tier,
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
  if (log.type !== "repair") return;
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
