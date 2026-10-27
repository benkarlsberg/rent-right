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
  setLogFlags,
  setLogTier,
  updateDeadlineFacts,
  updateLogResolution,
  type Deadline,
  type LogEntry,
  type Message,
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
import { todayISO } from "@/lib/rules/dates";
import { repairReminder } from "@/lib/rules/engine";
import { landlordBubble, landlordWords } from "@/lib/inbound-reply";
import { asRepairSeverity, escalationNote, isHabitability, isIssueTier, reminderPace, shouldEscalate, tierForSeverity, tierShort, violationFlag, type IssueTier } from "@/lib/triage";
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
      body: `${formatTimestamp(message.createdAt, user.locale)}\n${message.subject}\n${reply ? landlordBubble(message.body, user.locale) : message.body}`,
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
  const inbound = linkedMessages.filter((message) => message.direction === "inbound");
  for (const response of responses.filter((item) => item.message_id && messageIds.has(item.message_id))) {
    const note = (response.note || "").trim();
    const covered = inbound.some((message) => {
      const provider = message.providerId || "";
      if (provider.startsWith("respond:") || provider.startsWith("refile:")) return true;
      return Boolean(note && message.body.includes(note));
    });
    if (covered) continue;
    rows.push({
      at: response.created_at,
      title: tx(user.locale, "Reply from the landlord", "Respuesta del propietario"),
      body: landlordWords(response.action, note, user.locale),
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

function openRepair(log: LogEntry): boolean {
  return log.type === "repair" && log.status !== "resolved" && log.flags?.removed !== true;
}

async function noteTier(user: User, unit: Unit, issueId: string, description: string) {
  await insertLog({
    unitId: unit.id,
    userId: user.id,
    type: "issue_event",
    description,
    eventDate: todayISO(),
    flags: { issueId, event: "tier" },
  });
}

export async function refreshIssueTiers(user: User, unit: Unit, logs: LogEntry[], messages: Message[], deadlines: Deadline[]): Promise<boolean> {
  if (unit.archivedAt) return false;
  const today = todayISO();
  const responses = await listLandlordResponses(user.id, unit.id);
  let changed = false;
  for (const log of logs) {
    if (log.flags?.removed === true) continue;
    const entry = log.flags?.entry as { atLeast24?: boolean; explanation?: string; explanationEs?: string } | undefined;
    const retaliation = log.flags?.retaliation as { flagged?: boolean; explanation?: string; explanationEs?: string } | undefined;
    const failed = entry?.atLeast24 === false || retaliation?.flagged === true;
    if (failed && log.tier !== "possible_violation" && !log.flags?.violationNoted) {
      const reason = entry?.atLeast24 === false
        ? (user.locale === "es" ? entry.explanationEs : entry.explanation) || "Civil Code §1954."
        : (user.locale === "es" ? retaliation?.explanationEs : retaliation?.explanation) || "Civil Code §1942.5.";
      const note = `${violationFlag(user.locale)}. ${reason} ${tx(user.locale, "Unsure.", "No se puede precisar.")}`;
      await setLogTier(user.id, log.id, "possible_violation", {
        ...log.flags,
        violationNoted: true,
        unsure: true,
        citation: entry?.atLeast24 === false ? "CA-CC-1954" : "CA-CC-1942.5",
      });
      await noteTier(user, unit, log.id, note);
      changed = true;
      continue;
    }
    if (log.flags?.tierManual === true) continue;
    if (!openRepair(log) || log.flags?.escalatedAt) continue;
    const tier = log.tier && isIssueTier(log.tier) ? log.tier : tierForSeverity(log.severity);
    const due = deadlines.find((item) => item.kind === "repair" && item.sourceId === log.id && item.dueDate)?.dueDate
      || repairReminder((log.eventDate || today).slice(0, 10), asRepairSeverity(log.severity)).dueDate;
    const ids = new Set(messages.filter((message) => message.logEntryId === log.id).map((message) => message.id));
    const replied = messages.some((message) => message.logEntryId === log.id && message.direction === "inbound")
      || responses.some((response) => Boolean(response.message_id && ids.has(response.message_id)));
    if (!shouldEscalate({ tier, manual: false, open: true, due, today, replied })) continue;
    const note = escalationNote(user.locale, due || today, isHabitability(log.severity));
    await setLogTier(user.id, log.id, "possible_violation", {
      ...log.flags,
      escalatedAt: new Date().toISOString(),
      citation: "CA-CC-1942",
      unsure: true,
    });
    await noteTier(user, unit, log.id, note);
    changed = true;
  }
  const deposit = deadlines.find((item) => item.kind === "deposit" && item.status === "open" && item.dueDate && item.dueDate < today);
  if (deposit?.dueDate && !logs.some((log) => log.flags?.depositLate === true && log.flags?.removed !== true)) {
    const description = `${violationFlag(user.locale)}. ${tx(
      user.locale,
      `The deposit date you entered (${deposit.dueDate}) has passed. Civil Code §1950.5.`,
      `La fecha de depósito que anotó (${deposit.dueDate}) ya pasó. Código Civil §1950.5.`,
    )}`;
    await insertLog({
      unitId: unit.id,
      userId: user.id,
      type: "notice_received",
      noticeKind: "deposit",
      tier: "possible_violation",
      description,
      eventDate: today,
      flags: { depositLate: true, citation: "CA-CC-1950.5", unsure: false },
    });
    changed = true;
  }
  return changed;
}

export async function setIssueTier(user: User, unit: Unit, id: string, tier: IssueTier): Promise<void> {
  const log = await getLog(user.id, id);
  if (log.unitId !== unit.id) throw new Error(tx(user.locale, "That request was not found.", "No se encontró esa solicitud."));
  if (log.flags?.removed === true) throw new Error(tx(user.locale, "That request was removed.", "Esa solicitud se eliminó."));
  const current = log.tier && isIssueTier(log.tier) ? log.tier : tierForSeverity(log.severity);
  if (current === tier) return;
  await setLogTier(user.id, id, tier, { ...log.flags, tierManual: true });
  await noteTier(user, unit, id, tx(
    user.locale,
    `Tier changed from ${tierShort(current, "en")} to ${tierShort(tier, "en")} by tenant`,
    `El nivel cambió de ${tierShort(current, "es")} a ${tierShort(tier, "es")} por el inquilino`,
  ));
  const anchor = (log.eventDate || todayISO()).slice(0, 10);
  const reminder = repairReminder(anchor, asRepairSeverity(log.severity), reminderPace(tier, log.severity));
  const open = (await listDeadlines(user.id, unit.id)).find((item) => item.kind === "repair" && item.sourceId === id && item.status === "open");
  if (!open) return;
  await updateDeadlineFacts(open.id, {
    ruleId: reminder.ruleId,
    dueDate: reminder.dueDate,
    explanation: reminder.explanation,
    explanationEs: reminder.explanationEs,
    computation: reminder.computation,
    unsure: reminder.unsure,
  });
}

function noteLog(user: User, entry: LogEntry) {
  if (entry.unitId && entry.type === "repair") fail(user.locale, "That is not a note.", "Eso no es una nota.");
  if (entry.type === "issue_event" || entry.type === "repair") fail(user.locale, "That is not a note.", "Eso no es una nota.");
  if (/^landlord used the response link:/i.test(entry.description)) {
    fail(user.locale, "A landlord reply stays in the landlord chat.", "La respuesta del propietario se queda en el chat del propietario.");
  }
}

/** A note stays in the hash chain. Hide removes it from the list. */
export async function hideNote(user: User, id: string): Promise<void> {
  const entry = await getLog(user.id, id);
  noteLog(user, entry);
  if (entry.flags?.hidden === true) return;
  await setLogFlags(user.id, id, { ...entry.flags, hidden: true });
  await insertLog({
    unitId: entry.unitId,
    userId: user.id,
    type: "issue_event",
    description: tx(user.locale, "Tenant hid this note. The timestamped record stays.", "El inquilino ocultó esta nota. El registro con fecha se queda."),
    eventDate: todayISO(),
    flags: { event: "note_hidden", logId: entry.id },
  });
}

export async function restoreNote(user: User, id: string): Promise<void> {
  const entry = await getLog(user.id, id);
  noteLog(user, entry);
  if (entry.flags?.hidden !== true) return;
  const next = { ...entry.flags };
  delete next.hidden;
  await setLogFlags(user.id, id, next);
  await insertLog({
    unitId: entry.unitId,
    userId: user.id,
    type: "issue_event",
    description: tx(user.locale, "Tenant showed this note again.", "El inquilino volvió a mostrar esta nota."),
    eventDate: todayISO(),
    flags: { event: "note_shown", logId: entry.id },
  });
}

export async function recordRulesIssue(user: User, unit: Unit, input: {
  kind: string;
  noticeKind: string;
  description: string;
  citation: string;
  unsure: boolean;
}): Promise<void> {
  const logs = await listLogs(user.id, unit.id);
  const existing = logs.find((log) => log.flags?.rulesKind === input.kind && log.flags?.removed !== true && log.description === input.description);
  if (existing) {
    if (existing.tier !== "possible_violation" && existing.flags?.tierManual !== true) {
      await setLogTier(user.id, existing.id, "possible_violation", { ...existing.flags, citation: input.citation, unsure: input.unsure });
    }
    return;
  }
  await insertLog({
    unitId: unit.id,
    userId: user.id,
    type: "notice_received",
    noticeKind: input.noticeKind,
    tier: "possible_violation",
    description: input.description,
    eventDate: todayISO(),
    flags: { rulesKind: input.kind, citation: input.citation, unsure: input.unsure },
  });
}
