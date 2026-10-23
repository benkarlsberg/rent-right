import { cardAfterSend, serializeCard, type ChatCard } from "@/lib/chat-card";
import { planFromIntent, planTurn, repairFacts, resolveIntent, type TurnPlan } from "@/lib/chat-intent";
import {
  addAssistantMessage,
  archiveChat,
  assertWritable,
  assistantMessageContent,
  closeChatDraft,
  countAssistantThisMonth,
  createChatDraft,
  getDeposit,
  listDeadlines,
  listLeaseReviews,
  openChatDraft,
  saveFile,
  saveRentCheck,
  setChatDraftPayload,
  updateAssistantMessage,
  type Unit,
  type User,
} from "@/lib/db";
import { demandLetter } from "@/lib/letters";
import { deliveryLabel, dueLine, findingStatus, rentHeadline } from "@/lib/phone";
import { answerQuestion } from "@/lib/rules/assistant";
import { detectPlace } from "@/lib/rules/detect";
import { todayISO } from "@/lib/rules/dates";
import { checkRentIncrease, depositReturnDeadline, repairReminder, type AreaKey, type RepairSeverity } from "@/lib/rules/engine";
import { getRule } from "@/lib/rules/library";
import { formatMoney, percentLabel } from "@/lib/format";
import { tx } from "@/lib/text";
import { findResolutionTarget, resolveRepair } from "@/lib/issues";
import { issueTitle } from "@/lib/resolution";
import { CHAT_MONTHLY_CAP, emailLandlord, extractPdfOrText, recordLog, runLeaseReview, saveDepositAndDeadline } from "@/lib/workflow";

const AREAS = new Set<AreaKey>(["los_angeles_orange", "riverside_san_bernardino", "san_diego", "san_francisco_bay", "other_ca"]);

function monthPrefix(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit" }).format(now);
  return `${parts}-01`;
}

async function remember(user: User, unit: Unit, role: "user" | "assistant", content: string, ruleId: string | null, unsure: boolean): Promise<string> {
  return await addAssistantMessage(user.id, unit.id, role, { locale: user.locale, content, ruleIds: ruleId ? [ruleId] : [], unsure });
}

async function say(user: User, unit: Unit, card: ChatCard): Promise<string> {
  return await remember(user, unit, "assistant", serializeCard(card), card.ruleId, card.status.toLowerCase().includes("unsure") || card.headline.toLowerCase().includes("not sure"));
}

async function asked(user: User, unit: Unit, text: string) {
  if (await countAssistantThisMonth(user.id, monthPrefix()) >= CHAT_MONTHLY_CAP) {
    throw new Error("This free account reached 40 questions this month.");
  }
  await addAssistantMessage(user.id, unit.id, "user", { locale: user.locale, content: text, ruleIds: [], unsure: false });
}

export async function runChatTurn(user: User, unit: Unit, input: {
  text?: string;
  action?: string;
  draftId?: string;
  attachment?: { name: string; mime: string; base64: string } | null;
}): Promise<void> {
  let text = (input.text || "").trim();
  const action = (input.action || "").trim();
  if (action === "clear") {
    await archiveChat(user.id);
    return;
  }
  assertWritable(unit, user.locale);
  if (action.startsWith("prompt:")) text = action.slice("prompt:".length).trim();
  if (action === "send") {
    await confirmSend(user, unit, input.draftId || "");
    return;
  }
  if (action.startsWith("resolve:")) {
    await confirmResolve(user, unit, action.slice("resolve:".length));
    return;
  }
  if (action === "letter") {
    await asked(user, unit, text || tx(user.locale, "Draft a letter", "Redactar una carta"));
    await askForLetter(user, unit);
    return;
  }
  if (!text && !input.attachment) throw new Error(tx(user.locale, "Say what you need.", "Diga qué necesita."));
  await asked(user, unit, text || input.attachment?.name || tx(user.locale, "Attachment", "Archivo"));
  if (input.attachment && looksLikeLease(text, input.attachment)) {
    await reviewAttachment(user, unit, input.attachment);
    return;
  }

  const pending = await openChatDraft(user.id);
  const pendingKind = pending && pending.unitId === unit.id ? (pending.kind as "repair" | "rent_date" | "deposit_date" | "letter") : null;
  let plan = planTurn(text, pendingKind);
  if (plan.type === "rights" || plan.type === "unclear") {
    const intent = await resolveIntent(text, pendingKind);
    if (intent !== "rights" && intent !== "unclear") plan = planFromIntent(intent, text);
  }
  if (input.attachment?.mime.startsWith("image/") && (plan.type === "unclear" || plan.type === "repair") && !looksLikeLease(text, input.attachment)) {
    plan = planFromIntent("repair", text || "Photo attached from the chat.");
  }
  if (plan.type !== "confirm_send" && plan.type !== "continue_date" && plan.type !== "letter_text" && pending) {
    await closeChatDraft(user.id, pending.id, "cancelled");
  }
  await execute(user, unit, plan, pending, input.attachment || null, text);
}

function looksLikeLease(text: string, file: { name: string; mime: string }): boolean {
  const name = `${text} ${file.name}`.toLowerCase();
  if (/lease|contrato/.test(name)) return true;
  if (!text && (file.mime === "application/pdf" || file.mime.startsWith("text/") || file.name.toLowerCase().endsWith(".pdf") || file.name.toLowerCase().endsWith(".txt"))) return true;
  return false;
}

async function confirmSend(user: User, unit: Unit, draftId: string) {
  const draft = await openChatDraft(user.id);
  if (!draft || draft.kind !== "repair" || draft.id !== draftId || draft.unitId !== unit.id) {
    await say(user, unit, {
      headline: tx(user.locale, "Nothing to send", "Nada para enviar"),
      status: tx(user.locale, "Not sent", "No enviado"),
      action: null,
      detail: tx(user.locale, "There is no repair email waiting. Nothing was sent.", "No hay un correo de reparación en espera. No se envió nada."),
      ruleId: null,
    });
    return;
  }
  const subject = String(draft.payload.subject || "Repair");
  const body = String(draft.payload.text || "");
  const logId = typeof draft.payload.logId === "string" ? draft.payload.logId : null;
  const status = await emailLandlord({ user, unit, logEntryId: logId, subject, tenantText: body });
  const confirmed: ChatCard = {
    headline: tx(user.locale, "Landlord email", "Correo al propietario"),
    status: deliveryLabel(status, false, user.locale),
    action: { id: "open-landlord", label: tx(user.locale, "Open landlord", "Abrir propietario") },
    detail: tx(user.locale, `You confirmed this send.\n\n${body}`, `Usted confirmó este envío.\n\n${body}`),
    ruleId: null,
  };
  const messageId = typeof draft.payload.cardMessageId === "string" ? draft.payload.cardMessageId : "";
  const stored = messageId ? await assistantMessageContent(user.id, messageId) : null;
  const next = stored ? cardAfterSend(stored, confirmed) : stored;
  const replaced = stored && next && next !== stored
    ? await updateAssistantMessage(user.id, messageId, { content: next, ruleIds: [], unsure: false })
    : false;
  if (!replaced) await say(user, unit, confirmed);
  await closeChatDraft(user.id, draft.id, "sent");
}

async function execute(user: User, unit: Unit, plan: TurnPlan, pending: Awaited<ReturnType<typeof openChatDraft>>, attachment: { name: string; mime: string; base64: string } | null, text: string) {
  if (plan.type === "confirm_send") {
    await confirmSend(user, unit, pending?.kind === "repair" ? pending.id : "");
    return;
  }
  if (plan.type === "continue_date" && pending?.kind === "rent_date") {
    const proposed = numberOrNull(pending.payload.proposedCents);
    const lowest = numberOrNull(pending.payload.lowestCents) ?? unit.rentCents;
    await runRent(user, unit, lowest, proposed, resolveDay(plan.date));
    await closeChatDraft(user.id, pending.id, "done");
    return;
  }
  if (plan.type === "continue_date" && pending?.kind === "deposit_date") {
    await runDeposit(user, unit, resolveDay(plan.date));
    await closeChatDraft(user.id, pending.id, "done");
    return;
  }
  if (plan.type === "letter_text" && pending?.kind === "letter") {
    await writeLetter(user, unit, plan.text);
    await closeChatDraft(user.id, pending.id, "done");
    return;
  }
  if (plan.type === "resolve_issue") {
    await offerResolve(user, unit, plan.summary);
    return;
  }
  if (plan.type === "repair") {
    await logRepair(user, unit, plan.summary, plan.severity, plan.room, attachment);
    return;
  }
  if (plan.type === "lease") {
    await say(user, unit, {
      headline: tx(user.locale, "Add your lease", "Agregue su contrato"),
      status: tx(user.locale, "Not reviewed", "Sin revisión"),
      action: null,
      detail: tx(user.locale, "Use + to add a PDF or a photo of the lease. Nothing was reviewed yet.", "Use + para agregar un PDF o una foto del contrato. Aún no se revisó nada."),
      ruleId: null,
    });
    return;
  }
  if (plan.type === "rent") {
    if (plan.proposedCents == null) {
      await say(user, unit, {
        headline: tx(user.locale, "Need the new rent", "Falta la renta nueva"),
        status: tx(user.locale, "Not checked", "Sin revisión"),
        action: null,
        detail: tx(user.locale, "Say the new amount, like $2,100. No cap was checked.", "Diga el monto nuevo, como $2,100. No se revisó un tope."),
        ruleId: null,
      });
      return;
    }
    const lowest = plan.lowestCents ?? unit.rentCents;
    if (!plan.effectiveDate) {
      const draft = await createChatDraft(user.id, unit.id, "rent_date", { proposedCents: plan.proposedCents, lowestCents: lowest });
      await say(user, unit, {
        headline: tx(user.locale, "Need a start date", "Falta la fecha de inicio"),
        status: formatMoney(plan.proposedCents, user.locale),
        action: null,
        detail: tx(
          user.locale,
          "Say the date the new rent would start, like 2026-11-01. No cap was checked yet.",
          "Diga la fecha en que empezaría la renta nueva, como 2026-11-01. Aún no se revisó un tope.",
        ),
        ruleId: draft.id ? null : null,
      });
      return;
    }
    await runRent(user, unit, lowest, plan.proposedCents, resolveDay(plan.effectiveDate));
    return;
  }
  if (plan.type === "deposit") {
    if (!plan.moveOutDate) {
      await createChatDraft(user.id, unit.id, "deposit_date", {});
      const existing = (await listDeadlines(user.id, unit.id)).find((item) => item.kind === "deposit" && item.status === "open");
      if (existing) {
        await sayDeposit(user, unit, existing.dueDate, existing.explanation, existing.explanationEs, existing.ruleId);
        return;
      }
      await say(user, unit, {
        headline: tx(user.locale, "Need your move-out date", "Falta la fecha de salida"),
        status: tx(user.locale, "Not counted", "Sin conteo"),
        action: null,
        detail: tx(user.locale, "Say the day you moved out, like 2026-09-01. The 21-day count has not started.", "Diga el día en que se mudó, como 2026-09-01. El conteo de 21 días no ha empezado."),
        ruleId: "CA-CC-1950.5",
      });
      return;
    }
    await runDeposit(user, unit, resolveDay(plan.moveOutDate));
    return;
  }
  if (plan.type === "packet") {
    await say(user, unit, {
      headline: tx(user.locale, "Records PDF", "PDF de registros"),
      status: tx(user.locale, "Facts only", "Solo hechos"),
      action: { id: "download-packet", label: tx(user.locale, "Download", "Descargar") },
      detail: tx(user.locale, "The PDF lists what you stored. It does not say who is responsible or what to file.", "El PDF lista lo que usted guardó. No dice quién es responsable ni qué presentar."),
      ruleId: null,
    });
    return;
  }
  if (plan.type === "deadlines") {
    const next = (await listDeadlines(user.id, unit.id)).find((item) => item.status === "open" && item.dueDate);
    if (!next) {
      await say(user, unit, {
        headline: tx(user.locale, "No open date", "Sin fecha abierta"),
        status: tx(user.locale, "Nothing due", "Nada pendiente"),
        action: null,
        detail: tx(user.locale, "No open deadline is stored yet.", "Aún no hay una fecha abierta guardada."),
        ruleId: null,
      });
      return;
    }
    const line = dueLine(next.dueDate, todayISO(), user.locale);
    await say(user, unit, {
      headline: line.title,
      status: line.subtitle,
      action: null,
      detail: `${user.locale === "es" ? next.explanationEs : next.explanation}\n\n${next.computation}`,
      ruleId: next.ruleId,
    });
    return;
  }
  if (plan.type === "rights") {
    await answerRights(user, unit, text);
    return;
  }
  await say(user, unit, suggestionCard(user));
}

function suggestionCard(user: User): ChatCard {
  const spanish = user.locale === "es";
  return {
    headline: tx(user.locale, "What do you want to do?", "¿Qué quiere hacer?"),
    status: tx(user.locale, "Nothing was sent.", "No se envió nada."),
    action: null,
    actions: spanish
      ? [
          { id: "prompt:Se filtra el fregadero", label: "Se filtra el fregadero" },
          { id: "prompt:Revisar mi contrato", label: "Revisar mi contrato" },
          { id: "prompt:Mi casero subio la renta a $2,100", label: "Revisar un aumento" },
          { id: "prompt:Me mude, donde esta mi deposito?", label: "¿Dónde está mi depósito?" },
          { id: "reset", label: "Empezar de nuevo" },
        ]
      : [
          { id: "prompt:My sink is leaking", label: "My sink is leaking" },
          { id: "prompt:Check my lease", label: "Check my lease" },
          { id: "prompt:My landlord raised rent to $2,100", label: "Check a rent increase" },
          { id: "prompt:I moved out, where's my deposit?", label: "Where's my deposit?" },
          { id: "reset", label: "Start over" },
        ],
    detail: tx(user.locale, "Pick one, or describe it in your own words.", "Elija una, o descríbala con sus palabras."),
    ruleId: null,
  };
}

async function answerRights(user: User, unit: Unit, question: string) {
  const answer = answerQuestion(question, user.locale);
  const rule = answer.ruleIds[0] ? getRule(answer.ruleIds[0]) : undefined;
  if (!answer.handoff && (answer.unsure || !rule)) {
    await say(user, unit, suggestionCard(user));
    return;
  }
  const headline = answer.handoff
    ? tx(user.locale, "Contact legal aid", "Contacte asistencia legal")
    : user.locale === "es" ? rule!.titleEs : rule!.titleEn;
  await say(user, unit, {
    headline,
    status: answer.ruleIds[0] || tx(user.locale, "Unsure", "No se puede precisar"),
    action: null,
    detail: answer.text,
    ruleId: answer.ruleIds[0] || null,
  });
}

async function offerResolve(user: User, unit: Unit, summary: string) {
  const target = await findResolutionTarget(user, unit.id, summary);
  if (target.kind === "none") {
    await say(user, unit, {
      headline: tx(user.locale, "No open request", "No hay una solicitud abierta"),
      status: tx(user.locale, "Nothing changed", "Nada cambió"),
      action: null,
      detail: tx(user.locale, "There is no open request to mark resolved.", "No hay una solicitud abierta para marcar como resuelta."),
      ruleId: null,
    });
    return;
  }
  if (target.kind === "ambiguous") {
    await say(user, unit, {
      headline: tx(user.locale, "More than one open request", "Hay más de una solicitud abierta"),
      status: tx(user.locale, "Nothing changed", "Nada cambió"),
      action: null,
      detail: tx(user.locale, "Open Records and mark the request that was fixed. Nothing was changed.", "Abra Registros y marque la solicitud que se arregló. No se cambió nada."),
      ruleId: null,
    });
    return;
  }
  const name = target.title || issueTitle(summary);
  await say(user, unit, {
    headline: target.pending
      ? tx(user.locale, "Landlord says fixed, confirm?", "El propietario dice que está arreglado. ¿Confirmar?")
      : tx(user.locale, `Mark your ${name} as resolved?`, `¿Marcar ${name} como resuelto?`),
    status: tx(user.locale, "Not resolved yet", "Aún no está resuelto"),
    action: { id: `resolve:${target.id}`, label: tx(user.locale, "Confirm", "Confirmar") },
    detail: tx(user.locale, "Confirming closes the reminders for this request. Nothing is emailed.", "Confirmar cierra los recordatorios de esta solicitud. No se envía ningún correo."),
    ruleId: null,
  });
}

async function confirmResolve(user: User, unit: Unit, issueId: string) {
  try {
    const entry = await resolveRepair(user, issueId, { note: "", date: null });
    const name = issueTitle(entry.description, tx(user.locale, "request", "solicitud"));
    await say(user, unit, {
      headline: tx(user.locale, `${name} is resolved`, `${name} está resuelto`),
      status: entry.resolvedBy === "landlord"
        ? tx(user.locale, "Landlord confirmed", "Confirmado por el propietario")
        : tx(user.locale, "Tenant marked", "Marcado por el inquilino"),
      action: null,
      detail: tx(user.locale, "The open reminders for this request are closed. Nothing was emailed. The history stays in Records.", "Los recordatorios abiertos de esta solicitud quedaron cerrados. No se envió ningún correo. El historial se queda en Registros."),
      ruleId: null,
    });
  } catch (error) {
    await say(user, unit, {
      headline: tx(user.locale, "Not resolved", "No se resolvió"),
      status: tx(user.locale, "Nothing changed", "Nada cambió"),
      action: null,
      detail: error instanceof Error ? error.message : tx(user.locale, "The request was not changed.", "La solicitud no cambió."),
      ruleId: null,
    });
  }
}

async function logRepair(user: User, unit: Unit, summary: string, severity: RepairSeverity, room: string | null, attachment: { name: string; mime: string; base64: string } | null) {
  let photoFileId: string | null = null;
  if (attachment?.mime.startsWith("image/")) {
    photoFileId = await saveFile(user.id, unit.id, attachment.name || "repair.jpg", attachment.mime, Buffer.from(attachment.base64, "base64"));
  }
  const facts = repairFacts(summary);
  const entry = await recordLog({
    user,
    unit,
    type: "repair",
    noticeKind: null,
    severity: severity || facts.severity,
    room,
    description: summary,
    eventDate: todayISO(),
    photoFileId,
    sendEmail: false,
    subject: "",
    entryAt: null,
    noticeAt: null,
  });
  const reminder = repairReminder(todayISO(), severity);
  const draft = await createChatDraft(user.id, unit.id, "repair", {
    logId: entry.id,
    subject: tx(user.locale, `${room || "Home"} repair`, `Reparación: ${room || "vivienda"}`),
    text: summary,
  });
  const messageId = await say(user, unit, {
    headline: tx(user.locale, "Repair logged", "Reparación anotada"),
    status: tx(user.locale, "Not sent", "No enviado"),
    action: { id: `send:${draft.id}`, label: tx(user.locale, "Send to landlord", "Enviar al propietario") },
    detail: `${user.locale === "es" ? reminder.explanationEs : reminder.explanation}\n\n${reminder.computation}\n\n${tx(user.locale, "Nothing was emailed. Send only if you want the landlord to get this note.", "No se envió ningún correo. Envíe solo si quiere que el propietario reciba esta nota.")}`,
    ruleId: reminder.ruleId,
  });
  await setChatDraftPayload(user.id, draft.id, { ...draft.payload, cardMessageId: messageId });
}

async function runRent(user: User, unit: Unit, lowest: number | null, proposed: number | null, effectiveDate: string) {
  if (lowest == null || proposed == null) {
    await say(user, unit, {
      headline: tx(user.locale, "Need both rents", "Faltan las dos rentas"),
      status: tx(user.locale, "Not checked", "Sin revisión"),
      action: null,
      detail: tx(user.locale, "The current rent is not on the unit, and the message did not include it. No cap was checked.", "La renta actual no está en la unidad y el mensaje no la incluyó. No se revisó un tope."),
      ruleId: null,
    });
    return;
  }
  const place = detectPlace({ address: unit.street, city: unit.city, postalCode: unit.postalCode, region: unit.region });
  const result = checkRentIncrease({
    jurisdiction: unit.jurisdiction,
    rsoStatus: unit.rsoStatus,
    rstpoTier: unit.rstpoTier,
    countyArea: place.area && AREAS.has(place.area) ? place.area : undefined,
    localOrdinanceName: place.localOrdinance?.name ?? null,
    lowestRentCents: lowest,
    proposedRentCents: proposed,
    noticeDate: todayISO(),
    effectiveDate,
    lastIncreaseDate: null,
    claimsExemption: false,
  });
  await saveRentCheck(user.id, unit.id, { source: "chat", effectiveDate }, result);
  const status = result.applicable.ppm != null ? percentLabel(result.applicable.ppm) : tx(user.locale, "No single cap", "Sin un solo tope");
  await say(user, unit, {
    headline: rentHeadline(result.applicable.status, user.locale),
    status,
    action: null,
    detail: [
      user.locale === "es" ? result.applicable.reasonEs : result.applicable.reason,
      result.notice.computation,
      tx(user.locale, "The notice date was not in the message, so the 30-day or 90-day count uses today.", "La fecha del aviso no estaba en el mensaje, así que el conteo de 30 o 90 días usa hoy."),
      result.frequency.computation,
      user.locale === "es" ? result.jurisdictionNoteEs : result.jurisdictionNote,
    ].filter(Boolean).join("\n\n"),
    ruleId: result.applicable.ruleId,
  });
}

async function runDeposit(user: User, unit: Unit, moveOutDate: string) {
  const existing = await getDeposit(user.id, unit.id);
  await saveDepositAndDeadline(user, unit, {
    amountCents: existing?.amount_cents ?? unit.depositCents,
    receivedDate: existing?.received_date ?? unit.moveInDate,
    moveOutDate,
    forwardingAddress: existing?.forwarding_address || "",
    landlordDeductions: existing?.landlord_deductions || "",
    tenantNotes: existing?.tenant_notes || "",
  });
  const due = depositReturnDeadline(moveOutDate);
  await sayDeposit(user, unit, due.dueDate, due.explanation, due.explanationEs, due.ruleId);
}

async function sayDeposit(user: User, unit: Unit, dueDate: string | null, explanation: string, explanationEs: string, ruleId: string) {
  const line = dueLine(dueDate, todayISO(), user.locale);
  await say(user, unit, {
    headline: tx(user.locale, "Deposit", "Depósito"),
    status: `${line.subtitle} · ${line.title}`,
    action: { id: "letter", label: tx(user.locale, "Draft a letter", "Redactar una carta") },
    detail: `${user.locale === "es" ? explanationEs : explanation}\n\n${tx(user.locale, "The letter is not emailed. You would mail or send it yourself.", "La carta no se envía por correo. Usted la enviaría.")}`,
    ruleId,
  });
}

async function askForLetter(user: User, unit: Unit) {
  await createChatDraft(user.id, unit.id, "letter", {});
  await say(user, unit, {
    headline: tx(user.locale, "Your words", "Sus palabras"),
    status: tx(user.locale, "Not created", "Sin crear"),
    action: null,
    detail: tx(user.locale, "Write at least a short explanation in your own words. If a forwarding address is not saved, include “My forwarding address is …”. Nothing is emailed.", "Escriba al menos una explicación breve con sus palabras. Si no hay una dirección de reenvío guardada, incluya “My forwarding address is …”. No se envía ningún correo."),
    ruleId: "CA-CC-1950.5",
  });
}

async function writeLetter(user: User, unit: Unit, text: string) {
  const deposit = await getDeposit(user.id, unit.id);
  const deadline = (await listDeadlines(user.id, unit.id)).find((item) => item.kind === "deposit" && item.status === "open");
  const addressMatch = text.match(/forwarding address is\s+(.+)/i);
  const forwarding = (addressMatch?.[1] || deposit?.forwarding_address || "").trim();
  const notes = text.replace(/forwarding address is\s+.+/i, "").trim();
  if (!deadline?.dueDate || !deadline.anchorDate || !deposit?.amount_cents) {
    await say(user, unit, {
      headline: tx(user.locale, "Letter not created", "Carta sin crear"),
      status: tx(user.locale, "Need a move-out date", "Falta la salida"),
      action: null,
      detail: tx(user.locale, "A move-out date and a deposit amount have to be saved first. Nothing was written.", "Primero hay que guardar una fecha de salida y un monto de depósito. No se escribió nada."),
      ruleId: "CA-CC-1950.5",
    });
    return;
  }
  if (!forwarding || notes.length < 20) {
    await say(user, unit, {
      headline: tx(user.locale, "Letter not created", "Carta sin crear"),
      status: tx(user.locale, "Need your words", "Faltan sus palabras"),
      action: null,
      detail: tx(user.locale, "Add a forwarding address and at least a short explanation in your own words. Nothing was written or emailed.", "Agregue una dirección de reenvío y al menos una explicación breve con sus palabras. No se escribió ni se envió nada."),
      ruleId: "CA-CC-1950.5",
    });
    return;
  }
  const letter = demandLetter({
    tenantName: user.name,
    unitAddress: [unit.street, unit.unitNumber, unit.city, unit.postalCode].filter(Boolean).join(", "),
    landlordName: unit.landlordName,
    landlordEmail: unit.landlordEmail,
    depositCents: deposit.amount_cents,
    moveOutDate: deadline.anchorDate,
    dueDate: deadline.dueDate,
    forwardingAddress: forwarding,
    deductionNotes: deposit.landlord_deductions || "",
    disputeNotes: notes,
    letterDate: todayISO(),
  });
  await say(user, unit, {
    headline: tx(user.locale, "Letter ready", "Carta lista"),
    status: tx(user.locale, "Not sent", "No enviado"),
    action: null,
    detail: `${letter}\n\n${tx(user.locale, "Rent Right did not mail this letter.", "Rent Right no envió esta carta.")}`,
    ruleId: "CA-CC-1950.5",
  });
}

async function reviewAttachment(user: User, unit: Unit, file: { name: string; mime: string; base64: string }) {
  const bytes = Buffer.from(file.base64, "base64");
  await saveFile(user.id, unit.id, file.name || "lease", file.mime || "application/octet-stream", bytes);
  const extracted = await extractPdfOrText(bytes, file.mime || "", file.name || "lease.txt");
  const id = await runLeaseReview(user, unit, extracted, file.name || "lease.txt");
  const review = (await listLeaseReviews(user.id, unit.id)).find((item) => item.id === id);
  const finding = review?.result.findings.find((item) => item.label !== "looks_standard") || review?.result.findings[0];
  await say(user, unit, {
    headline: finding ? findingStatus(finding.label, user.locale) : tx(user.locale, "Reviewed", "Revisado"),
    status: review ? tx(user.locale, `${review.result.findings.length} clauses`, `${review.result.findings.length} cláusulas`) : tx(user.locale, "Reviewed", "Revisado"),
    action: null,
    detail: review
      ? review.result.findings.map((item) => `${findingStatus(item.label, user.locale)}\n${item.quote}\n${item.ruleId || tx(user.locale, "unsure", "no se puede precisar")}`).join("\n\n")
      : tx(user.locale, "The review was saved.", "La revisión se guardó."),
    ruleId: finding?.ruleId || null,
  });
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function resolveDay(value: string): string {
  return value === "today" ? todayISO() : value;
}
