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
import { repairReminder, type RepairSeverity } from "@/lib/rules/engine";
import { relayAddress, tx } from "@/lib/text";

const SEVERITIES = new Set<RepairSeverity>(["no_heat", "no_water", "no_electricity", "gas_leak", "leak", "mold", "pests", "other"]);

export function confirmedOutbound(status: string): boolean {
  return status === "sent" || status === "delivered" || status === "local_only" || status === "blocked";
}

function severityOf(value: string | null): RepairSeverity {
  return value && SEVERITIES.has(value as RepairSeverity) ? value as RepairSeverity : "other";
}

export function repairDraftLetter(input: {
  locale: Locale;
  tenantName: string;
  description: string;
  eventDate: string;
  address: string;
  severity: string | null;
}): { subject: string; body: string; ruleId: string; dueDate: string | null } {
  const locale = input.locale;
  const day = input.eventDate.slice(0, 10);
  const reminder = repairReminder(day, severityOf(input.severity));
  const issue = input.description.replace(/\s+/g, " ").trim();
  const short = issue.length > 80 ? `${issue.slice(0, 77).trim()}…` : issue;
  const subject = tx(locale, `Repair request: ${short}`, `Solicitud de reparación: ${short}`);
  const name = input.tenantName.trim() || tx(locale, "The tenant", "El inquilino");
  const date = formatDate(day, locale);
  const rule = locale === "es" ? reminder.explanationEs : reminder.explanation;
  const body = tx(
    locale,
    [
      `${name} is writing about a repair.`,
      "",
      input.address.trim(),
      "",
      `Issue: ${issue}`,
      `Date: ${date}`,
      "",
      "Please repair this.",
      "",
      rule,
      "",
      reminder.computation,
      `Rule ${reminder.ruleId}`,
    ].join("\n"),
    [
      `${name} escribe sobre una reparación.`,
      "",
      input.address.trim(),
      "",
      `Problema: ${issue}`,
      `Fecha: ${date}`,
      "",
      "Por favor, repare esto.",
      "",
      rule,
      "",
      reminder.computation,
      `Regla ${reminder.ruleId}`,
    ].join("\n"),
  );
  return { subject, body, ruleId: reminder.ruleId, dueDate: reminder.dueDate };
}

function uniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

export async function ensureRepairDrafts(user: User, unit: Unit, logs: LogEntry[], messages: Message[]): Promise<Message[]> {
  const created: Message[] = [];
  const seen = [...messages];
  for (const log of logs) {
    if (log.type !== "repair" || log.status === "resolved") continue;
    const related = seen.filter((message) => message.logEntryId === log.id && message.direction === "outbound");
    if (related.some((message) => confirmedOutbound(message.deliveryStatus) || message.deliveryStatus === "draft")) continue;
    const letter = repairDraftLetter({
      locale: user.locale,
      tenantName: user.name,
      description: log.description,
      eventDate: log.eventDate,
      address: unitAddress(unit),
      severity: log.severity,
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
  const reminder = repairReminder(day, severityOf(log.severity));
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
