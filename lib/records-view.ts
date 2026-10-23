import type { Locale } from "@/lib/disclaimer";
import { formatDate, formatTimestamp } from "@/lib/format";
import { daysBetween } from "@/lib/rules/dates";
import { tx } from "@/lib/text";

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
};

export type MessageInput = {
  logEntryId: string | null;
  direction: string;
  subject: string;
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
};

export type LogCard = {
  id: string;
  line: string;
  title: string;
  status: string;
  when: string;
  issue: string;
  message: string | null;
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
    : item.status === "replaced"
      ? tx(locale, "Replaced", "Reemplazado")
      : tx(locale, "Open", "Abierto");
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
  };
}

function logTitle(type: string, locale: Locale): string {
  if (type === "repair") return tx(locale, "Repair request", "Solicitud de reparación");
  if (type === "notice_received") return tx(locale, "Notice you saved", "Aviso que guardó");
  if (type === "payment") return tx(locale, "Payment", "Pago");
  if (type === "conversation") return tx(locale, "Note", "Nota");
  return tx(locale, "Record", "Registro");
}

export function logCards(logs: LogInput[], messages: MessageInput[], locale: Locale): LogCard[] {
  return logs.map((log) => {
    const related = messages
      .filter((message) => message.logEntryId === log.id)
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
    if (outbound?.subject) {
      parts.push(tx(locale, `With the message “${outbound.subject}”`, `Con el mensaje “${outbound.subject}”`));
    }
    if (inbound?.subject) {
      parts.push(tx(locale, `Reply: “${inbound.subject}”`, `Respuesta: “${inbound.subject}”`));
    }
    const title = logTitle(log.type, locale);
    return {
      id: log.id,
      line: `${title} · ${status}`,
      title,
      status,
      when: formatTimestamp(log.createdAt, locale),
      issue: log.description,
      message: parts.join(" ") || null,
    };
  });
}

function sentRepairIds(logs: LogInput[], messages: MessageInput[]): Set<string> {
  const ids = new Set<string>();
  for (const log of logs) {
    if (log.type !== "repair") continue;
    const sent = messages.some((message) =>
      message.logEntryId === log.id
      && message.direction === "outbound"
      && (message.deliveryStatus === "sent" || message.deliveryStatus === "delivered"));
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
  const unsent = input.logs.find((log) => log.type === "repair" && !sent.has(log.id));
  const items: StepItem[] = [];
  if (followUpDue[0]?.dueDate) {
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
        title: tx(locale, `Wait for the landlord until ${date}`, `Espere al propietario hasta el ${date}`),
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
        title: tx(locale, `Wait for the landlord until ${date}`, `Espere al propietario hasta el ${date}`),
        button: tx(locale, `Wait until ${date}`, `Espere hasta el ${date}`),
        detail: tx(
          locale,
          `This is your follow-up date for ${issue}. It does not mean the landlord must answer by then. Nothing is emailed from this step.`,
          `Esta es su fecha de seguimiento para ${issue}. No significa que el propietario deba responder para entonces. Este paso no envía ningún correo.`,
        ),
      });
    }
  } else if (unsent) {
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
  }
  if (input.hasRecords && items.length < 3) {
    items.push({
      id: "export",
      action: "export",
      href: null,
      title: tx(locale, "Export your evidence", "Exporte su evidencia"),
      button: tx(locale, "Export evidence", "Exportar evidencia"),
      detail: tx(
        locale,
        "A PDF of the requests, messages, and dates saved in this account.",
        "Un PDF de las solicitudes, los mensajes y las fechas guardadas en esta cuenta.",
      ),
    });
  }
  if (input.hasRecords && items.length < 3) {
    items.push({
      id: "small_claims",
      action: "small_claims",
      href: SMALL_CLAIMS_URL,
      title: tx(locale, "Learn about small claims", "Infórmese sobre reclamos menores"),
      button: tx(locale, "Learn about small claims", "Infórmese sobre reclamos menores"),
      detail: tx(
        locale,
        "Small claims is a self-help option. Rent Right does not file a case and does not give legal advice.",
        "Los reclamos menores son una opción de autoayuda. Rent Right no presenta un caso y no da asesoramiento legal.",
      ),
    });
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
  };
}

export function evidenceFilename(today: string): string {
  return `rent-right-evidence-${today}.pdf`;
}
