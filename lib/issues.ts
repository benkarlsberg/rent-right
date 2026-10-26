import type { Locale } from "@/lib/disclaimer";
import {
  discardDraftMessage,
  getLog,
  insertLog,
  listDeadlines,
  listLandlordResponses,
  listLogHistory,
  listLogs,
  listMessages,
  setLinkedDeadlines,
  updateLogResolution,
  type LogEntry,
  type Unit,
  type User,
} from "@/lib/db";
import { formatDate, formatTimestamp } from "@/lib/format";
import {
  isResolvedClaim,
  issueTitle,
  landlordFixedNote,
  matchOpenIssue,
  resolutionPhrase,
  resolutionTimestamp,
  sourceLabel,
  timelineSummary,
  type ResolutionSource,
} from "@/lib/resolution";
import { confirmedOutbound } from "@/lib/repair-draft";
import { tx } from "@/lib/text";

function fail(locale: Locale, en: string, es: string): never {
  throw new Error(tx(locale, en, es));
}

function sourceOf(entry: LogEntry, explicit: ResolutionSource | null): ResolutionSource {
  if (explicit) return explicit;
  return entry.status === "pending_confirm" ? "landlord" : "tenant";
}

async function writeEvent(user: User, unitId: string, issueId: string, event: string, description: string, eventDate: string) {
  await insertLog({
    unitId,
    userId: user.id,
    type: "issue_event",
    description,
    eventDate,
    flags: { issueId, event },
  });
}

export async function resolveRepair(user: User, issueId: string, input: { note?: string | null; date?: string | null; source?: ResolutionSource | null }) {
  const entry = await getLog(user.id, issueId);
  if (entry.type !== "repair") fail(user.locale, "Only a repair request can be resolved.", "Solo una solicitud de reparación se puede resolver.");
  if (entry.status === "resolved") fail(user.locale, "This request is already resolved.", "Esta solicitud ya está resuelta.");
  const note = (input.note || "").trim();
  if (note.length > 500) fail(user.locale, "Keep the note under 500 characters.", "La nota debe tener menos de 500 caracteres.");
  let resolvedAt: string;
  try {
    resolvedAt = resolutionTimestamp({ reportedAt: entry.createdAt, eventDate: entry.eventDate, chosen: input.date || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/future/i.test(message)) fail(user.locale, "The resolution date cannot be in the future.", "La fecha de resolución no puede ser futura.");
    if (/before/i.test(message)) fail(user.locale, "The resolution date cannot be before the request.", "La fecha de resolución no puede ser anterior a la solicitud.");
    fail(user.locale, "Use a real date.", "Use una fecha real.");
  }
  const source = sourceOf(entry, input.source || null);
  await updateLogResolution(user.id, entry.id, {
    status: "resolved",
    resolvedAt,
    resolvedBy: source,
    resolutionNote: note || null,
    flags: entry.flags,
  });
  await setLinkedDeadlines(user.id, entry.unitId, entry.id, "open", "resolved");
  const label = sourceLabel(source, user.locale) || source;
  const when = resolvedAt.slice(0, 10);
  await writeEvent(
    user,
    entry.unitId,
    entry.id,
    "resolved",
    tx(
      user.locale,
      `Tenant confirmed this request is resolved. Source: ${label}. Date: ${when}.${note ? ` Note: ${note}` : ""}`,
      `El inquilino confirmó que esta solicitud está resuelta. Origen: ${label}. Fecha: ${when}.${note ? ` Nota: ${note}` : ""}`,
    ),
    when,
  );
  return await getLog(user.id, entry.id);
}

function keptStatus(status: string): "open" | "pending_confirm" | "resolved" {
  if (status === "pending_confirm" || status === "resolved") return status;
  return "open";
}

/** Hide a request from the list without deleting the hash-chained log or any sent message. */
export async function hideIssue(user: User, issueId: string): Promise<{ sentKept: boolean }> {
  const entry = await getLog(user.id, issueId);
  if (entry.type !== "repair") fail(user.locale, "Only a repair request can be deleted.", "Solo una solicitud de reparación se puede eliminar.");
  if (entry.flags?.removed === true) return { sentKept: false };
  const messages = await listMessages(user.id, entry.unitId);
  const related = messages.filter((message) => message.logEntryId === entry.id && message.direction === "outbound");
  const sentKept = related.some((message) => confirmedOutbound(message.deliveryStatus));
  for (const draft of related) {
    if (draft.deliveryStatus === "draft") await discardDraftMessage(user.id, draft.id);
  }
  await updateLogResolution(user.id, entry.id, {
    status: keptStatus(entry.status),
    resolvedAt: entry.resolvedAt,
    resolvedBy: entry.resolvedBy,
    resolutionNote: entry.resolutionNote,
    flags: { ...entry.flags, removed: true },
  });
  await setLinkedDeadlines(user.id, entry.unitId, entry.id, "open", "deleted");
  const today = new Date().toISOString().slice(0, 10);
  await writeEvent(
    user,
    entry.unitId,
    entry.id,
    "removed",
    sentKept
      ? tx(user.locale, "Tenant removed this request from the list. Sent messages stay in the landlord history.", "El inquilino quitó esta solicitud de la lista. Los mensajes enviados se quedan en el historial del propietario.")
      : tx(user.locale, "Tenant removed this request from the list. Nothing had been sent.", "El inquilino quitó esta solicitud de la lista. No se había enviado nada."),
    today,
  );
  return { sentKept };
}

export async function reopenRepair(user: User, issueId: string) {
  const entry = await getLog(user.id, issueId);
  if (entry.type !== "repair") fail(user.locale, "Only a repair request can be reopened.", "Solo una solicitud de reparación se puede reabrir.");
  if (entry.status !== "resolved") fail(user.locale, "This request is still open.", "Esta solicitud sigue abierta.");
  await updateLogResolution(user.id, entry.id, {
    status: "open",
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
    flags: entry.flags,
  });
  await setLinkedDeadlines(user.id, entry.unitId, entry.id, "resolved", "open");
  const today = new Date().toISOString().slice(0, 10);
  await writeEvent(
    user,
    entry.unitId,
    entry.id,
    "reopened",
    tx(user.locale, "Tenant reopened this request. Earlier notes stay in the record.", "El inquilino reabrió esta solicitud. Las notas anteriores se quedan en el registro."),
    today,
  );
  return await getLog(user.id, entry.id);
}

export async function landlordSaysFixed(userId: string, unit: Unit, issueId: string | null, note: string): Promise<boolean> {
  if (!issueId) return false;
  const entry = await getLog(userId, issueId);
  if (entry.type !== "repair" || entry.status === "resolved") return false;
  const stamp = new Date().toISOString();
  await updateLogResolution(userId, entry.id, {
    status: "pending_confirm",
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
    flags: { ...entry.flags, landlordFixedAt: stamp, landlordFixedNote: note || null },
  });
  await insertLog({
    unitId: unit.id,
    userId,
    type: "issue_event",
    description: `Landlord says this request is fixed.${note ? ` Note: ${note}` : ""} The tenant has not confirmed it yet.`,
    eventDate: stamp.slice(0, 10),
    flags: { issueId: entry.id, event: "landlord_fixed" },
  });
  return true;
}

export async function findResolutionTarget(user: User, unitId: string, text: string) {
  const open = (await listLogs(user.id, unitId)).filter((entry) => entry.type === "repair" && entry.status !== "resolved");
  if (!isResolvedClaim(text) && open.length === 0) return { kind: "none" as const };
  const match = matchOpenIssue(text, open.map((entry) => ({ id: entry.id, description: entry.description, room: entry.room, status: entry.status })));
  if (open.length === 0) return { kind: "none" as const };
  if (!match) return { kind: "ambiguous" as const };
  const entry = open.find((item) => item.id === match.id) || match;
  return {
    kind: "one" as const,
    id: entry.id,
    title: issueTitle(entry.description, tx(user.locale, "request", "solicitud")),
    pending: entry.status === "pending_confirm",
  };
}

export type HistoryRow = { id: string; at: string; title: string; body: string };

export async function issueHistory(user: User, issueId: string): Promise<HistoryRow[] | null> {
  const entry = await getLog(user.id, issueId);
  if (entry.type !== "repair") return null;
  const [logs, messages, deadlines, responses] = await Promise.all([
    listLogHistory(user.id, entry.unitId),
    listMessages(user.id, entry.unitId),
    listDeadlines(user.id, entry.unitId),
    listLandlordResponses(user.id, entry.unitId),
  ]);
  const linkedMessages = messages.filter((message) => message.logEntryId === entry.id);
  const messageIds = new Set(linkedMessages.map((message) => message.id));
  const rows: { at: string; title: string; body: string }[] = [{
    at: entry.createdAt,
    title: tx(user.locale, "Request logged", "Solicitud anotada"),
    body: entry.description,
  }];
  for (const message of linkedMessages) {
    const reply = message.direction === "inbound";
    rows.push({
      at: message.createdAt,
      title: reply
        ? tx(user.locale, "Reply from the landlord", "Respuesta del propietario")
        : tx(user.locale, "Message to the landlord", "Mensaje al propietario"),
      body: `${formatTimestamp(message.createdAt, user.locale)}\n${message.subject}\n${message.body}`,
    });
  }
  for (const deadline of deadlines.filter((item) => item.sourceId === entry.id)) {
    rows.push({
      at: deadline.createdAt,
      title: deadline.status === "resolved"
        ? tx(user.locale, "Reminder closed", "Recordatorio cerrado")
        : tx(user.locale, "Reminder saved", "Recordatorio guardado"),
      body: [
        user.locale === "es" ? deadline.explanationEs : deadline.explanation,
        deadline.ruleId,
        deadline.dueDate ? tx(user.locale, `Date ${deadline.dueDate}`, `Fecha ${deadline.dueDate}`) : "",
        tx(user.locale, `Status ${deadline.status}`, `Estado ${deadline.status}`),
      ].filter(Boolean).join("\n"),
    });
  }
  for (const response of responses.filter((item) => item.message_id && messageIds.has(item.message_id))) {
    rows.push({
      at: response.created_at,
      title: tx(user.locale, "Landlord response link", "Enlace de respuesta del propietario"),
      body: `${response.action}${response.note ? `\n${response.note}` : ""}`,
    });
  }
  for (const log of logs) {
    const issue = log.flags.issueId;
    if (log.type !== "issue_event" || issue !== entry.id) continue;
    rows.push({
      at: log.createdAt,
      title: tx(user.locale, "Record", "Registro"),
      body: `${formatTimestamp(log.createdAt, user.locale)}\n${log.description}`,
    });
  }
  rows.sort((a, b) => a.at.localeCompare(b.at));
  return rows.map((row, index) => ({ id: `${entry.id}-${index}`, ...row, at: formatTimestamp(row.at, user.locale) }));
}

export function issueSummary(entry: LogEntry, messages: { logEntryId: string | null; direction: string }[], locale: Locale) {
  const related = messages.filter((message) => message.logEntryId === entry.id);
  const reportedLabel = formatDate(entry.eventDate || entry.createdAt.slice(0, 10), locale);
  const resolvedLabel = entry.resolvedAt ? formatDate(entry.resolvedAt.slice(0, 10), locale) : null;
  return {
    title: issueTitle(entry.description, tx(locale, "request", "solicitud")),
    reportedLabel,
    resolvedLabel,
    duration: entry.resolvedAt ? resolutionPhrase(entry.createdAt, entry.resolvedAt, locale) : null,
    source: sourceLabel(entry.resolvedBy, locale),
    summary: timelineSummary({
      locale,
      reportedLabel,
      messages: related.length,
      replies: related.filter((message) => message.direction === "inbound").length,
      sourceLabel: sourceLabel(entry.resolvedBy, locale),
      resolvedLabel,
    }),
    pendingNote: landlordFixedNote(entry.flags),
  };
}
