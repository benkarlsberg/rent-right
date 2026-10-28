import type { Locale } from "@/lib/disclaimer";
import { formatDate, formatTimestamp } from "@/lib/format";
import { cardReplyLine, tenantMessagePreview } from "@/lib/history-view";
import { issueTitle, landlordFixedNote, resolutionPhrase, sourceLabel, timelineSummary, type ResolutionSource } from "@/lib/resolution";
import { daysBetween } from "@/lib/rules/dates";
import { tx } from "@/lib/text";
import { isIssueTier, tierForSeverity, tierLabel, violationFlag, type IssueTier } from "@/lib/triage";

export type DeadlineInput = {
  id: string;
  kind: string;
  ruleId: string;
  anchorDate: string | null;
  dueDate: string | null;
  explanation: string;
  explanationEs: string;
  computation: string;
  sourceId: string | null;
  status: string;
  tenantReminderOn: string | null;
};

export type LogInput = {
  id: string;
  type: string;
  description: string;
  eventDate: string;
  createdAt: string;
  status?: string;
  removed?: boolean;
  hidden?: boolean;
  noticeKind?: string | null;
};

export type MessageInput = {
  logEntryId: string | null;
  direction: string;
  subject: string;
  body?: string;
  providerId?: string | null;
  deliveryStatus: string;
  createdAt: string;
};

export type DeadlineCard = {
  id: string;
  kind: string;
  title: string;
  started: string;
  owes: string;
  due: string | null;
  reminder: string | null;
  aside: string | null;
  reminderOn: string | null;
  learnMore: string;
  status: string;
  sortOn: string;
  closed: boolean;
  deletable: boolean;
  legalNote: string | null;
};

export type LogCard = {
  id: string;
  line: string;
  title: string;
  status: string;
  when: string;
  issue: string;
  message: string | null;
  preview: string;
  hidden: boolean;
};

export type StepAction = "wait" | "followup" | "send" | "export" | "small_claims";

export type StepItem = {
  id: StepAction;
  title: string;
  detail: string;
  button: string;
  action: StepAction;
  href: string | null;
};

export type StepsBlock = {
  title: string;
  held: string;
  items: StepItem[];
};

export const SMALL_CLAIMS_URL = "https://selfhelp.courts.ca.gov/small-claims";

export function duePhrase(due: string, today: string, locale: Locale): string {
  const date = formatDate(due, locale);
  const days = daysBetween(today, due);
  if (locale === "es") {
    if (days < 0) {
      const ago = Math.abs(days);
      return ago === 1 ? `Vence el ${date} · hace 1 día` : `Vence el ${date} · hace ${ago} días`;
    }
    if (days === 0) return `Vence el ${date} · hoy`;
    if (days === 1) return `Vence el ${date} · en 1 día`;
    return `Vence el ${date} · en ${days} días`;
  }
  if (days < 0) {
    const ago = Math.abs(days);
    return ago === 1 ? `Due ${date} · 1 day ago` : `Due ${date} · ${ago} days ago`;
  }
  if (days === 0) return `Due ${date} · today`;
  if (days === 1) return `Due ${date} · in 1 day`;
  return `Due ${date} · in ${days} days`;
}

function issueName(text: string, fallback: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  const sentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  const trimmed = sentence.replace(/[.!?]+$/, "");
  if (trimmed.length <= 90) return trimmed;
  return `${clean.slice(0, 80).trim()}…`;
}

function reminderLine(date: string, locale: Locale): string {
  return tx(locale, `Your reminder: ${formatDate(date, locale)}`, `Su recordatorio: ${formatDate(date, locale)}`);
}

export function deadlineCards(
  deadlines: DeadlineInput[],
  logs: LogInput[],
  locale: Locale,
  today: string,
): DeadlineCard[] {
  const logsById = new Map(logs.map((log) => [log.id, log]));
  const ranked = [...deadlines].sort((a, b) => {
    const rank = (item: DeadlineInput) => (item.status === "open" ? 0 : 1);
    const left = rank(a) - rank(b);
    if (left !== 0) return left;
    const aDate = a.dueDate || a.tenantReminderOn || "9999-12-31";
    const bDate = b.dueDate || b.tenantReminderOn || "9999-12-31";
    return aDate.localeCompare(bDate);
  });
  return ranked.map((item) => cardFor(item, logsById.get(item.sourceId || "") || null, locale, today));
}

function cardFor(item: DeadlineInput, log: LogInput | null, locale: Locale, today: string): DeadlineCard {
  const issue = issueName(log?.description || "", tx(locale, "this repair", "esta reparación"));
  const anchor = item.anchorDate ? formatDate(item.anchorDate, locale) : "";
  const custom = item.kind === "custom_reminder";
  const label = item.explanation.trim();
  let title = tx(locale, "Date saved with your records", "Fecha guardada en sus registros");
  let started = anchor
    ? tx(locale, `Saved from the date you entered (${anchor}).`, `Guardada desde la fecha que anotó (${anchor}).`)
    : tx(locale, "No start date was saved with this.", "No se guardó una fecha de inicio.");
  let owes = tx(
    locale,
    "This date was saved with your records. It is not a decision about what anyone owes.",
    "Esta fecha se guardó con sus registros. No decide lo que alguien debe.",
  );
  if (item.kind === "repair") {
    title = tx(locale, `Reminder: follow up on ${issue}`, `Recordatorio: dar seguimiento a ${issue}`);
    started = anchor
      ? tx(locale, `You logged this on ${anchor}.`, `Lo anotó el ${anchor}.`)
      : tx(locale, "You logged this repair.", "Anotó esta reparación.");
    owes = tx(
      locale,
      "This is your follow-up date. It does not decide that the landlord must answer by then.",
      "Esta es su fecha de seguimiento. No decide que el propietario deba responder para entonces.",
    );
  } else if (item.kind === "deposit") {
    title = tx(locale, "Landlord's deadline to account for your deposit", "Fecha del propietario para rendir cuentas del depósito");
    started = anchor
      ? tx(locale, `Counted from the move-out date you entered (${anchor}).`, `Contada desde la fecha de mudanza que anotó (${anchor}).`)
      : tx(locale, "Counted from a move-out date you entered.", "Contada desde una fecha de mudanza que anotó.");
    owes = tx(
      locale,
      "Civil Code §1950.5 is about an itemized statement and any remaining deposit. This card does not decide what you are owed.",
      "El Código Civil §1950.5 trata del desglose y de cualquier depósito restante. Esta tarjeta no decide cuánto se le debe.",
    );
  } else if (item.kind === "notice_3day") {
    title = tx(locale, "Date from a notice you saved", "Fecha de un aviso que guardó");
    started = anchor
      ? tx(locale, `Counted from the notice date you entered (${anchor}).`, `Contada desde la fecha del aviso que anotó (${anchor}).`)
      : tx(locale, "Counted from a notice date you entered.", "Contada desde una fecha de aviso que anotó.");
    owes = tx(
      locale,
      "This is the date counted from the notice you entered. It is not a decision about the notice.",
      "Es la fecha contada desde el aviso que anotó. No es una decisión sobre el aviso.",
    );
  } else if (custom) {
    title = label || tx(locale, "Your reminder", "Su recordatorio");
    started = tx(locale, "You added this reminder.", "Usted agregó este recordatorio.");
    owes = tx(locale, "You added this. It is not a legal deadline.", "Usted agregó esto. No es una fecha legal.");
  }
  const due = !custom && item.dueDate ? duePhrase(item.dueDate, today, locale) : null;
  const reminder = item.tenantReminderOn ? reminderLine(item.tenantReminderOn, locale) : null;
  const aside = reminder && due
    ? tx(
        locale,
        "This reminder is your own nudge. It does not change the date above.",
        "Este recordatorio es su propio aviso. No cambia la fecha de arriba.",
      )
    : null;
  const explanation = locale === "es" ? item.explanationEs : item.explanation;
  const learnMore = custom
    ? owes
    : [explanation, item.computation, item.ruleId].filter(Boolean).join("\n\n");
  const status = item.status === "done"
    ? tx(locale, "Done", "Hecho")
    : item.status === "resolved"
      ? tx(locale, "Resolved", "Resuelto")
      : item.status === "replaced"
        ? tx(locale, "Replaced", "Reemplazado")
        : item.status === "deleted"
          ? tx(locale, "Deleted", "Eliminado")
          : item.status === "dismissed"
            ? tx(locale, "Dismissed", "Descartado")
            : tx(locale, "Open", "Abierto");
  const deletable = item.kind === "custom_reminder" || item.kind === "repair";
  return {
    id: item.id,
    kind: item.kind,
    title,
    started,
    owes,
    due,
    reminder,
    aside,
    reminderOn: item.tenantReminderOn,
    learnMore,
    status,
    sortOn: item.dueDate || item.tenantReminderOn || "",
    closed: item.status === "done" || item.status === "resolved" || item.status === "replaced" || item.status === "deleted" || item.status === "dismissed",
    deletable,
    legalNote: deletable
      ? null
      : tx(
          locale,
          "This date is a legal fact from the rules. It stays in your records. Dismiss hides it on Reminders. Mark done closes it.",
          "Esta fecha es un dato legal de las reglas. Se queda en sus registros. Descartar la oculta en Recordatorios. Marcar como hecho la cierra.",
        ),
  };
}

function logTitle(type: string, locale: Locale): string {
  if (type === "repair") return tx(locale, "Repair request", "Solicitud de reparación");
  if (type === "notice_received") return tx(locale, "Notice you saved", "Aviso que guardó");
  if (type === "payment") return tx(locale, "Payment", "Pago");
  if (type === "conversation") return tx(locale, "Note", "Nota");
  return tx(locale, "Record", "Registro");
}

function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentence = (clean.split(/(?<=[.!?])\s/)[0] || clean).replace(/[.!?]+$/, "").trim();
  if (sentence.length <= 80) return sentence;
  return `${sentence.slice(0, 77).trim()}…`;
}

export function cardPreview(text: string): string {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 2);
  const joined = lines.join("\n");
  if (joined.length <= 180) return joined;
  return `${joined.slice(0, 177).trim()}…`;
}

function noteTitle(log: LogInput, locale: Locale): string {
  const kind = log.noticeKind || "";
  if (log.type === "notice_received") {
    if (kind === "rent_increase") return tx(locale, "Rent increase notice", "Aviso de aumento de renta");
    if (kind === "eviction") return tx(locale, "Eviction notice", "Aviso de desalojo");
    if (kind === "pay_or_quit_3day") return tx(locale, "3-day notice", "Aviso de 3 días");
    if (kind === "deposit") return tx(locale, "Deposit notice", "Aviso de depósito");
  }
  const sentence = firstSentence(log.description);
  if (sentence && sentence.toLowerCase() !== "note" && sentence.toLowerCase() !== "nota") return sentence;
  return logTitle(log.type, locale);
}

export function logCards(logs: LogInput[], messages: MessageInput[], locale: Locale): LogCard[] {
  return logs.map((log) => {
    const related = messages
      .filter((message) => message.logEntryId === log.id && message.deliveryStatus !== "draft" && message.deliveryStatus !== "discarded")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latest = related[related.length - 1];
    let status = tx(locale, "Saved", "Guardado");
    if (latest?.direction === "inbound") status = tx(locale, "Reply from the landlord", "Respuesta del propietario");
    else if (latest && (latest.deliveryStatus === "sent" || latest.deliveryStatus === "delivered")) {
      status = tx(locale, "Sent to the landlord", "Enviado al propietario");
    } else if (latest) status = tx(locale, "Saved, not emailed", "Guardado, sin correo");
    const outbound = related.find((message) => message.direction === "outbound");
    const inbound = [...related].reverse().find((message) => message.direction === "inbound");
    const parts: string[] = [];
    if (inbound?.body) {
      parts.push(cardReplyLine({ body: inbound.body, providerId: inbound.providerId, at: formatTimestamp(inbound.createdAt, locale) }, locale));
    } else if (outbound?.body) {
      const preview = tenantMessagePreview(outbound.body);
      if (preview) parts.push(tx(locale, `Message: ${preview}`, `Mensaje: ${preview}`));
    }
    const title = log.type === "conversation" || log.type === "notice_received" ? noteTitle(log, locale) : logTitle(log.type, locale);
    return {
      id: log.id,
      line: `${title} · ${status}`,
      title,
      status,
      when: formatTimestamp(log.createdAt, locale),
      issue: log.description,
      message: parts.join(" ") || null,
      preview: cardPreview(log.description),
      hidden: log.hidden === true,
    };
  });
}

function sentMail(logId: string, messages: MessageInput[]): boolean {
  return messages.some((message) => message.logEntryId === logId && message.direction === "outbound" && confirmedOutbound(message.deliveryStatus));
}

function issueText(log: { description: string; flags?: Record<string, unknown> }): string {
  const notes = typeof log.flags?.notes === "string" ? log.flags.notes.trim() : "";
  if (!notes || notes === log.description.trim()) return log.description;
  return `${log.description}\n\n${notes}`;
}

function confirmedOutbound(status: string): boolean {
  return status === "sent" || status === "delivered" || status === "local_only" || status === "blocked";
}

function sentRepairIds(logs: LogInput[], messages: MessageInput[]): Set<string> {
  const ids = new Set<string>();
  for (const log of logs) {
    if (log.type !== "repair" || log.status === "resolved" || log.removed) continue;
    const sent = messages.some((message) =>
      message.logEntryId === log.id
      && message.direction === "outbound"
      && confirmedOutbound(message.deliveryStatus));
    if (sent) ids.add(log.id);
  }
  return ids;
}

export function nextSteps(input: {
  locale: Locale;
  today: string;
  deadlines: DeadlineInput[];
  logs: LogInput[];
  messages: MessageInput[];
  hasRecords: boolean;
}): StepsBlock {
  const locale = input.locale;
  const open = input.deadlines.filter((item) => item.status === "open");
  const sent = sentRepairIds(input.logs, input.messages);
  const issueFor = (sourceId: string | null) => {
    const log = input.logs.find((item) => item.id === sourceId);
    return issueName(log?.description || "", tx(locale, "this repair", "esta reparación"));
  };
  const followUpDue = open
    .filter((item) => item.kind === "repair" && item.dueDate && item.sourceId && sent.has(item.sourceId) && daysBetween(input.today, item.dueDate) <= 0)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const futureRepair = open
    .filter((item) => item.kind === "repair" && item.dueDate && item.sourceId && sent.has(item.sourceId) && daysBetween(input.today, item.dueDate) > 0)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const futureDeposit = open
    .filter((item) => item.kind === "deposit" && item.dueDate && daysBetween(input.today, item.dueDate) > 0)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const unsent = input.logs.find((log) => log.type === "repair" && log.status !== "resolved" && !log.removed && !sent.has(log.id));
  const items: StepItem[] = [];
  if (unsent) {
    items.push({
      id: "send",
      action: "send",
      href: null,
      title: tx(locale, "Send the repair note", "Envíe la nota de reparación"),
      button: tx(locale, "Review before sending", "Revisar antes de enviar"),
      detail: tx(
        locale,
        "The note is saved. It is not emailed until you confirm on the Landlord tab.",
        "La nota está guardada. No se envía por correo hasta que lo confirme en la pestaña Propietario.",
      ),
    });
  } else if (followUpDue[0]?.dueDate) {
    const date = formatDate(followUpDue[0].dueDate, locale);
    const issue = issueFor(followUpDue[0].sourceId);
    items.push({
      id: "followup",
      action: "followup",
      href: null,
      title: tx(locale, "Send a follow-up", "Envíe un seguimiento"),
      button: tx(locale, "Send follow-up", "Enviar seguimiento"),
      detail: tx(
        locale,
        `Your follow-up date for ${issue} was ${date}. Nothing is sent until you confirm on the Landlord tab.`,
        `Su fecha de seguimiento para ${issue} fue el ${date}. No se envía nada hasta que lo confirme en la pestaña Propietario.`,
      ),
    });
  } else if (futureRepair[0]?.dueDate || futureDeposit[0]?.dueDate) {
    const repairDue = futureRepair[0]?.dueDate || "";
    const depositDue = futureDeposit[0]?.dueDate || "";
    const useDeposit = Boolean(depositDue) && (!repairDue || depositDue < repairDue);
    if (useDeposit) {
      const date = formatDate(depositDue, locale);
      items.push({
        id: "wait",
        action: "wait",
        href: null,
        title: tx(locale, `Waiting for landlord until ${date}`, `Esperando al propietario hasta el ${date}`),
        button: tx(locale, `Wait until ${date}`, `Espere hasta el ${date}`),
        detail: tx(
          locale,
          "That date is for the deposit accounting, counted from the move-out date you entered. This does not decide what you are owed. Nothing is emailed from this step.",
          "Esa fecha es para la rendición de cuentas del depósito, contada desde la fecha de mudanza que anotó. No decide cuánto se le debe. Este paso no envía ningún correo.",
        ),
      });
    } else {
      const date = formatDate(repairDue, locale);
      const issue = issueFor(futureRepair[0]?.sourceId || null);
      items.push({
        id: "wait",
        action: "wait",
        href: null,
        title: tx(locale, `Waiting for landlord until ${date}`, `Esperando al propietario hasta el ${date}`),
        button: tx(locale, `Wait until ${date}`, `Espere hasta el ${date}`),
        detail: tx(
          locale,
          `This is your follow-up date for ${issue}. It does not mean the landlord must answer by then. Nothing is emailed from this step.`,
          `Esta es su fecha de seguimiento para ${issue}. No significa que el propietario deba responder para entonces. Este paso no envía ningún correo.`,
        ),
      });
    }
  }
  return {
    title: tx(locale, "Your next steps", "Sus próximos pasos"),
    held: tx(locale, "Nothing was sent.", "No se envió nada."),
    items: items.slice(0, 3),
  };
}

export function reminderNote(mail: boolean, locale: Locale): string {
  if (mail) {
    return tx(
      locale,
      "On that date, Rent Right emails you this reminder. It is your own nudge, not a legal deadline. Nothing is sent to the landlord.",
      "Ese día, Rent Right le envía este recordatorio por correo. Es su propio aviso, no una fecha legal. No se envía nada al propietario.",
    );
  }
  return tx(
    locale,
    "This reminder stays in the app. Email is not set up, so nothing is emailed. It is your own nudge, not a legal deadline, and nothing is sent to the landlord.",
    "Este recordatorio se queda en la app. El correo no está configurado, así que no se envía ningún email. Es su propio aviso, no una fecha legal, y no se envía nada al propietario.",
  );
}

export type OpenIssueCard = {
  id: string;
  title: string;
  status: string;
  when: string;
  reported: string;
  issue: string;
  message: string | null;
  pending: boolean;
  pendingTitle: string | null;
  pendingNote: string | null;
  earliest: string;
  sent: boolean;
  tier: IssueTier | null;
  tierLabel: string | null;
  flag: string | null;
  citation: string | null;
  unsure: boolean;
};

export type ArchiveIssueCard = {
  id: string;
  title: string;
  reported: string;
  resolved: string;
  duration: string;
  summary: string;
  source: string | null;
  note: string | null;
};

function tierFields(log: { type?: string; tier?: string | null; severity?: string | null; flags?: Record<string, unknown> }, locale: Locale): Pick<OpenIssueCard, "tier" | "tierLabel" | "flag" | "citation" | "unsure"> {
  const stored = log.tier && isIssueTier(log.tier) ? log.tier : log.type === "repair" ? tierForSeverity(log.severity) : null;
  const citation = typeof log.flags?.citation === "string" ? log.flags.citation : stored === "possible_violation" ? "CA-CC-1942" : null;
  return {
    tier: stored,
    tierLabel: stored ? tierLabel(stored, locale) : null,
    flag: stored === "possible_violation" ? violationFlag(locale) : null,
    citation,
    unsure: log.flags?.unsure === true,
  };
}

export function issueBoard(input: {
  locale: Locale;
  logs: (LogInput & {
    room?: string | null;
    resolvedAt?: string | null;
    resolvedBy?: ResolutionSource | null;
    resolutionNote?: string | null;
    flags?: Record<string, unknown>;
    tier?: string | null;
    severity?: string | null;
  })[];
  messages: MessageInput[];
}): { open: OpenIssueCard[]; archive: ArchiveIssueCard[] } {
  const locale = input.locale;
  const repairs = input.logs.filter((log) => log.type === "repair" || (log.tier === "possible_violation" && log.type !== "issue_event"));
  const cards = new Map(logCards(repairs, input.messages, locale).map((card) => [card.id, card]));
  const open: OpenIssueCard[] = [];
  const archive: ArchiveIssueCard[] = [];
  for (const log of repairs) {
    if (log.flags?.removed === true) continue;
    const card = cards.get(log.id);
    const title = issueTitle(log.description, tx(locale, "request", "solicitud"));
    if (log.status === "resolved" && log.resolvedAt) {
      const reported = formatDate(log.eventDate || log.resolvedAt.slice(0, 10), locale);
      const resolved = formatDate(log.resolvedAt.slice(0, 10), locale);
      const related = input.messages.filter((message) => message.logEntryId === log.id && message.deliveryStatus !== "draft" && message.deliveryStatus !== "discarded");
      archive.push({
        id: log.id,
        title,
        reported: tx(locale, `Reported ${reported}`, `Reportado el ${reported}`),
        resolved: tx(locale, `Resolved ${resolved}`, `Resuelto el ${resolved}`),
        duration: resolutionPhrase(log.createdAt, log.resolvedAt, locale),
        summary: timelineSummary({
          locale,
          reportedLabel: reported,
          messages: related.length,
          replies: related.filter((message) => message.direction === "inbound").length,
          sourceLabel: sourceLabel(log.resolvedBy || null, locale),
          resolvedLabel: resolved,
        }),
        source: sourceLabel(log.resolvedBy || null, locale),
        note: log.resolutionNote || null,
      });
      continue;
    }
    const pending = log.status === "pending_confirm";
    open.push({
      id: log.id,
      title,
      status: pending
        ? tx(locale, "Landlord says fixed", "El propietario dice que está arreglado")
        : card?.status || tx(locale, "Open", "Abierto"),
      when: card?.when || formatTimestamp(log.createdAt, locale),
      reported: tx(
        locale,
        `Reported ${formatDate(log.eventDate || log.createdAt.slice(0, 10), locale)}`,
        `Reportado el ${formatDate(log.eventDate || log.createdAt.slice(0, 10), locale)}`,
      ),
      issue: issueText(log),
      message: card?.message || null,
      pending,
      pendingTitle: pending ? tx(locale, "Landlord says fixed, confirm?", "El propietario dice que está arreglado. ¿Confirmar?") : null,
      pendingNote: landlordFixedNote(log.flags),
      earliest: log.eventDate || log.createdAt.slice(0, 10),
      sent: sentMail(log.id, input.messages),
      ...tierFields(log, locale),
    });
  }
  return { open, archive };
}

export function recordsLabels(locale: Locale) {
  return {
    editReminder: tx(locale, "Edit reminder date", "Editar la fecha del recordatorio"),
    saveReminder: tx(locale, "Save reminder", "Guardar recordatorio"),
    addTitle: tx(locale, "Add a reminder", "Agregar un recordatorio"),
    addHelp: tx(locale, "A reminder is your own nudge. It does not change a legal date.", "Un recordatorio es su propio aviso. No cambia una fecha legal."),
    reminderFor: tx(locale, "What is this reminder for?", "¿Para qué es este recordatorio?"),
    dateLabel: tx(locale, "Reminder date", "Fecha del recordatorio"),
    exportLabel: tx(locale, "Export my evidence packet", "Exportar mi paquete de evidencia"),
    packetTitle: tx(locale, "Evidence packet", "Paquete de evidencia"),
    packetBody: tx(
      locale,
      "A timestamped PDF of the requests, notices, replies, and dates in this account. It is a record of communications, not legal advice.",
      "Un PDF con fecha de las solicitudes, avisos, respuestas y fechas de esta cuenta. Es un registro de comunicaciones, no asesoramiento legal.",
    ),
    learnMore: tx(locale, "Learn more", "Más información"),
    hide: tx(locale, "Hide", "Ocultar"),
    recordsTitle: tx(locale, "Records", "Registros"),
    openTitle: tx(locale, "Open requests", "Solicitudes abiertas"),
    markResolved: tx(locale, "Mark as resolved", "Marcar como resuelto"),
    confirmResolved: tx(locale, "Confirm", "Confirmar"),
    resolutionNote: tx(locale, "Note (optional)", "Nota (opcional)"),
    resolutionDate: tx(locale, "Resolution date", "Fecha de resolución"),
    reopen: tx(locale, "Reopen", "Reabrir"),
    history: tx(locale, "History", "Historial"),
    archiveTitle: tx(locale, "Resolved", "Resueltos"),
    issues: tx(locale, "Issues", "Solicitudes"),
    documents: tx(locale, "Documents", "Documentos"),
    evidence: tx(locale, "Evidence", "Evidencia"),
    reminders: tx(locale, "Reminders", "Recordatorios"),
    change: tx(locale, "Change", "Cambiar"),
    seeAll: tx(locale, "See all steps", "Ver todos los pasos"),
    addButton: tx(locale, "+ Add reminder", "+ Agregar recordatorio"),
    photos: tx(locale, "Condition photos", "Fotos del estado"),
    notes: tx(locale, "Notes", "Notas"),
    emptyIssues: tx(locale, "No open requests.", "No hay solicitudes abiertas."),
    emptyDocs: tx(locale, "No documents yet.", "Aún no hay documentos."),
    emptyReminders: tx(locale, "No reminders yet.", "Aún no hay recordatorios."),
    account: tx(locale, "Account", "Cuenta"),
    logOut: tx(locale, "Log out", "Salir"),
    menu: tx(locale, "Account menu", "Menú de la cuenta"),
    downloadData: tx(locale, "Download my data", "Descargar mis datos"),
    close: tx(locale, "Close", "Cerrar"),
    overdue: tx(locale, "Overdue", "Vencidos"),
    soon: tx(locale, "Soon", "Pronto"),
    later: tx(locale, "Later", "Más adelante"),
    markDone: tx(locale, "Mark done", "Marcar como hecho"),
    nextStepsLink: tx(locale, "Your next steps are on Reminders", "Sus próximos pasos están en Recordatorios"),
    deleteIssue: tx(locale, "Delete", "Eliminar"),
    deleteIssueConfirm: tx(locale, "Delete this request?", "¿Eliminar esta solicitud?"),
    deleteIssueSent: tx(locale, "Sent messages stay in the Landlord history.", "Los mensajes enviados se quedan en el historial del propietario."),
    deleteReminder: tx(locale, "Delete", "Eliminar"),
    deleteConfirm: tx(locale, "Delete this reminder?", "¿Eliminar este recordatorio?"),
    dismissReminder: tx(locale, "Dismiss", "Descartar"),
    cancelAction: tx(locale, "Cancel", "Cancelar"),
    undo: tx(locale, "Undo", "Deshacer"),
    deletedToast: tx(locale, "Reminder deleted", "Recordatorio eliminado"),
    dismissedToast: tx(locale, "Reminder dismissed", "Recordatorio descartado"),
  };
}

export function evidenceFilename(today: string): string {
  return `rent-right-evidence-${today}.pdf`;
}
