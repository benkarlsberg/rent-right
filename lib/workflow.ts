import { aiConfigured, completeJson, extractImageText } from "@/lib/ai";
import { chatContext, rulesPrompt } from "@/lib/chat-text";
import { landlordReady } from "@/lib/landlord";
import {
  addAssistantMessage,
  recentConversationTurns,
  addNotification,
  countAssistantThisMonth,
  countLeaseReviewsThisMonth,
  countOutboundSince,
  findCachedReview,
  getUser,
  assertWritable,
  insertDeadline,
  insertLog,
  insertMessage,
  isBlocked,
  promoteDraftMessage,
  leaseTextHash,
  listLogs,
  replaceOpenDeadline,
  saveDeposit,
  saveLeaseReview,
  type Unit,
  type User,
} from "@/lib/db";
import { landlordMessageBody, sendRelayEmail } from "@/lib/email";
import { renderMail } from "@/lib/email-template";
import { LIBRARY_VERSION, type Locale } from "@/lib/disclaimer";
import { LEASE_REVIEW_MONTHLY_CAP, mergeModelFindings, redactPii, reviewLease, type ModelFinding } from "@/lib/lease/review";
import { answerFromModelIds, answerQuestion, selectRules } from "@/lib/rules/assistant";
import { RULES } from "@/lib/rules/library";
import {
  depositReturnDeadline,
  entryNoticeCheck,
  pendingReminderSlots,
  repairReminder,
  retaliationWindow,
  threeDayNoticeDeadline,
  type RepairSeverity,
} from "@/lib/rules/engine";
import { isSampleAccount } from "@/lib/sample";
import { appUrl, relayAddress } from "@/lib/text";
import { randomToken } from "@/lib/crypto";
import { daysBetween, todayISO } from "@/lib/rules/dates";

const EMAIL_DAILY_CAP = 20;
export const CHAT_MONTHLY_CAP = 40;

function monthPrefix(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
  }).format(now);
  return `${parts}-01`;
}

export async function recordLog(input: {
  user: User;
  unit: Unit;
  type: string;
  noticeKind: string | null;
  severity: string | null;
  room: string | null;
  description: string;
  eventDate: string;
  photoFileId: string | null;
  sendEmail: boolean;
  subject: string;
  entryAt: string | null;
  noticeAt: string | null;
  createdAt?: string;
}) {
  assertWritable(input.unit, input.user.locale);
  const flags: Record<string, unknown> = {};
  if (input.entryAt && input.noticeAt) {
    flags.entry = entryNoticeCheck(input.noticeAt, input.entryAt);
  }
  if ((input.noticeKind === "rent_increase" || input.noticeKind === "eviction") && input.eventDate) {
    const repairs = (await listLogs(input.user.id, input.unit.id)).filter((entry) => entry.type === "repair");
    const hits = repairs
      .map((entry) => ({ entry, window: retaliationWindow(entry.eventDate, input.eventDate) }))
      .filter((item) => item.window.flagged)
      .sort((a, b) => a.window.daysSince - b.window.daysSince);
    if (hits[0]) {
      flags.retaliation = {
        ...hits[0].window,
        relatedEntryId: hits[0].entry.id,
      };
    }
  }
  const entry = await insertLog({
    unitId: input.unit.id,
    userId: input.user.id,
    type: input.type,
    noticeKind: input.noticeKind,
    severity: input.severity,
    room: input.room,
    description: input.description,
    flags,
    photoFileId: input.photoFileId,
    eventDate: input.eventDate,
    createdAt: input.createdAt,
  });

  if (input.type === "repair" && input.severity) {
    const reminder = repairReminder(input.eventDate, input.severity as RepairSeverity);
    await insertDeadline({
      unitId: input.unit.id,
      ruleId: reminder.ruleId,
      kind: "repair",
      anchorDate: input.eventDate,
      dueDate: reminder.dueDate,
      explanation: reminder.explanation,
      explanationEs: reminder.explanationEs,
      computation: reminder.computation,
      sourceId: entry.id,
      status: "open",
      unsure: reminder.unsure,
    });
  }

  if (input.noticeKind === "pay_or_quit_3day") {
    const counted = threeDayNoticeDeadline(input.eventDate);
    await insertDeadline({
      unitId: input.unit.id,
      ruleId: counted.ruleId,
      kind: "notice_3day",
      anchorDate: input.eventDate,
      dueDate: counted.dueDate,
      explanation: counted.explanation,
      explanationEs: counted.explanationEs,
      computation: counted.computation,
      sourceId: entry.id,
      status: "open",
      unsure: counted.unsure,
    });
  }

  if (input.sendEmail && landlordReady(input.unit)) {
    await emailLandlord({
      user: input.user,
      unit: input.unit,
      logEntryId: entry.id,
      subject: input.subject || `Message about ${input.unit.street}`,
      tenantText: input.description,
    });
  }
  return entry;
}

async function storeLandlordMail(input: {
  user: User;
  unit: Unit;
  logEntryId: string | null;
  existingId?: string | null;
  subject: string;
  body: string;
  deliveryStatus: string;
  deliveryDetail: string | null;
  providerId?: string | null;
  responseToken?: string | null;
}) {
  if (input.existingId) {
    await promoteDraftMessage(input.user.id, input.existingId, {
      body: input.body,
      subject: input.subject,
      toEmail: input.unit.landlordEmail,
      deliveryStatus: input.deliveryStatus,
      deliveryDetail: input.deliveryDetail,
      providerId: input.providerId || null,
      responseToken: input.responseToken || null,
    });
    return;
  }
  await insertMessage({
    unitId: input.unit.id,
    userId: input.user.id,
    logEntryId: input.logEntryId,
    direction: "outbound",
    fromEmail: relayAddress(input.unit.relayLocal),
    toEmail: input.unit.landlordEmail,
    ccEmail: input.user.email,
    subject: input.subject,
    body: input.body,
    deliveryStatus: input.deliveryStatus,
    deliveryDetail: input.deliveryDetail,
    providerId: input.providerId,
    responseToken: input.responseToken,
  });
}

export async function emailLandlord(input: {
  user: User;
  unit: Unit;
  logEntryId: string | null;
  existingId?: string | null;
  subject: string;
  tenantText: string;
}) {
  assertWritable(input.unit, input.user.locale);
  if (!input.unit.landlordEmail) {
    throw new Error("Add the landlord's email on your unit before sending.");
  }
  if (isSampleAccount(input.user.email)) {
    await storeLandlordMail({
      ...input,
      body: input.tenantText,
      deliveryStatus: "local_only",
      deliveryDetail: "This sample home does not email a landlord.",
    });
    return "local_only";
  }
  if (await isBlocked(input.unit.id)) {
    await storeLandlordMail({
      ...input,
      body: input.tenantText,
      deliveryStatus: "blocked",
      deliveryDetail: "The landlord blocked later mail. Print a letter and mail it yourself.",
    });
    return "blocked";
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (await countOutboundSince(input.unit.id, since) >= EMAIL_DAILY_CAP) {
    throw new Error("This unit reached the daily email limit (20). Use a printed letter.");
  }
  const token = randomToken();
  const responseUrl = `${appUrl()}/r/${token}`;
  const body = landlordMessageBody(input.tenantText, responseUrl);
  const mail = renderMail({
    subject: input.subject,
    heading: "Message from your tenant",
    paragraphs: [
      ...input.tenantText.trim().split(/\n+/).map((line) => line.trim()).filter(Boolean),
      "The tenant wrote this message. Rent Right only provides the mailbox.",
      "You can acknowledge, give a schedule, mark the issue fixed, dispute it, or block later non-essential mail.",
    ],
    button: { label: "Respond", href: responseUrl },
  });
  const sent = await sendRelayEmail({
    relayLocal: input.unit.relayLocal,
    to: input.unit.landlordEmail,
    cc: input.user.email,
    subject: input.subject,
    text: mail.text,
    html: mail.html,
  });
  await storeLandlordMail({
    ...input,
    body,
    deliveryStatus: sent.status,
    deliveryDetail: sent.detail,
    providerId: sent.providerId,
    responseToken: token,
  });
  return sent.status;
}

export async function saveDepositAndDeadline(user: User, unit: Unit, input: {
  amountCents: number | null;
  receivedDate: string | null;
  moveOutDate: string | null;
  forwardingAddress: string;
  landlordDeductions: string;
  tenantNotes: string;
}) {
  assertWritable(unit, user.locale);
  await saveDeposit(user.id, unit.id, input);
  if (input.moveOutDate) {
    const due = depositReturnDeadline(input.moveOutDate);
    await replaceOpenDeadline(unit.id, "deposit");
    await insertDeadline({
      unitId: unit.id,
      ruleId: due.ruleId,
      kind: "deposit",
      anchorDate: input.moveOutDate,
      dueDate: due.dueDate,
      explanation: due.explanation,
      explanationEs: due.explanationEs,
      computation: due.computation,
      sourceId: null,
      status: "open",
      unsure: due.unsure,
    });
  }
}

export async function runLeaseReview(user: User, unit: Unit, text: string, filename: string) {
  assertWritable(unit, user.locale);
  const cleaned = redactPii(text).trim();
  if (cleaned.length < 40) throw new Error("No lease text was found. Paste the text or upload a PDF with selectable text.");
  const textHash = leaseTextHash(cleaned, LIBRARY_VERSION, unit.rentCents, unit.jurisdiction);
  const cached = await findCachedReview(unit.id, textHash, LIBRARY_VERSION);
  if (cached) {
    const id = await saveLeaseReview({
      unitId: unit.id,
      userId: user.id,
      filename,
      textHash,
      rulesVersion: LIBRARY_VERSION,
      model: cached.model,
      cached: true,
      result: typeof cached.result === "string" ? JSON.parse(cached.result) : cached.result,
    });
    return id;
  }
  if (await countLeaseReviewsThisMonth(user.id, monthPrefix()) >= LEASE_REVIEW_MONTHLY_CAP) {
    throw new Error("This free account can run 3 new lease reviews per month. An identical lease does not count again.");
  }
  let review = reviewLease(cleaned, { monthlyRentCents: unit.rentCents, jurisdiction: unit.jurisdiction });
  const unsure = review.findings.filter((finding) => finding.label === "unsure");
  let model: string | null = null;
  if (unsure.length > 0) {
    const catalog = RULES.filter((rule) => rule.patterns.length > 0 || rule.findingLabel !== "informational")
      .map((rule) => `${rule.id} | ${rule.findingLabel} | ${rule.titleEn}`)
      .join("\n");
    const prompt = [
      "Classify lease clauses. Return JSON {\"findings\":[{\"quote\":\"exact words from the clause\",\"ruleId\":\"ID\"}]}.",
      "Use only rule IDs from the list. If none fit, return {\"findings\":[]}. Do not invent citations. Do not give advice.",
      "Rules:",
      catalog,
      "Clauses:",
      unsure.map((finding) => finding.quote).join("\n---\n"),
    ].join("\n");
    const completed = await completeJson("flash", prompt);
    if (completed && completed.json && typeof completed.json === "object") {
      const findings = (completed.json as { findings?: ModelFinding[] }).findings || [];
      review = mergeModelFindings(review, cleaned, findings, completed.model);
      model = completed.model;
    }
  }
  return await saveLeaseReview({
    unitId: unit.id,
    userId: user.id,
    filename,
    textHash,
    rulesVersion: LIBRARY_VERSION,
    model,
    cached: false,
    result: review,
  });
}

const SAMPLE_LEASE = `RESIDENTIAL LEASE

1. Rent. Tenant shall pay monthly rent of $2,150.00 due on the first day of each month.

2. Habitability. Tenant waives all rights to a habitable premises and agrees the landlord has no duty to repair the unit.

3. Deposit. Tenant shall pay a non-refundable security deposit of $4,300.

4. Entry. Landlord may enter the premises at any time without notice.

5. Disputes. Tenant waives the right to a jury trial and the right to sue the landlord for any reason.

6. Late fee. If rent is late, tenant shall pay a late fee of $500 or 20% of the monthly rent, whichever is greater, as a penalty.

7. Eviction. Tenant waives all just cause eviction protections and the protections of the Tenant Protection Act.

8. Fees. Tenant shall pay landlord's attorney fees in any dispute.

9. Use. Tenant shall not use the unit for any unlawful purpose. Guests may stay no more than ten nights.
`;

export function sampleLeaseText(): string {
  return SAMPLE_LEASE;
}

export async function askAssistant(user: User, unit: Unit | null, question: string, locale: Locale) {
  if (unit) assertWritable(unit, locale);
  const trimmed = question.trim();
  if (trimmed.length < 8) throw new Error("Ask a full question.");
  if (await countAssistantThisMonth(user.id, monthPrefix()) >= CHAT_MONTHLY_CAP) {
    throw new Error("This free account reached 40 questions this month.");
  }
  await addAssistantMessage(user.id, unit?.id || null, "user", { locale, content: trimmed, ruleIds: [], unsure: false });
  const context = aiConfigured() ? chatContext(await recentConversationTurns(user.id)) : { history: "", retrieval: "" };
  const selected = selectRules(context.retrieval || trimmed);
  let answer = answerQuestion(trimmed, locale);
  if (selected.rules.length > 0 && aiConfigured()) {
    const completed = await completeJson("lite", rulesPrompt(context.history, trimmed, selected.rules));
    const ids = (completed?.json as { ruleIds?: string[] } | undefined)?.ruleIds;
    if (completed && Array.isArray(ids)) answer = answerFromModelIds(trimmed, locale, selected.rules, ids);
  }
  await addAssistantMessage(user.id, unit?.id || null, "assistant", {
    locale,
    content: `${answer.text}\n\n${answer.disclaimer}`,
    ruleIds: answer.ruleIds,
    unsure: answer.unsure,
  });
  return answer;
}

export async function extractPdfOrText(bytes: Buffer, mime: string, filename: string): Promise<string> {
  if (mime.startsWith("text/") || filename.toLowerCase().endsWith(".txt")) return bytes.toString("utf8");
  if (mime.startsWith("image/")) {
    const text = await extractImageText(bytes, mime || "image/jpeg");
    return text || "";
  }
  if (mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    try {
      const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as {
        getDocument: (src: { data: Uint8Array; disableWorker?: boolean; isEvalSupported?: boolean }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string }[] }> }> }> };
      };
      const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true, isEvalSupported: false }).promise;
      let text = "";
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
        const page = await doc.getPage(pageNumber);
        const content = await page.getTextContent();
        text += `${content.items.map((item) => item.str || "").join(" ")}\n`;
      }
      return text;
    } catch {
      return "";
    }
  }
  return "";
}

function isoDay(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function dispatchReminders(today = todayISO()) {
  const { openDeadlines, reminderSlotsSent, markReminder, unitMemberUserIds, listDueNudges } = await import("@/lib/db");
  const { sendTenantEmail } = await import("@/lib/email");
  let sent = 0;
  const deliver = async (userId: string, subject: string, heading: string, body: string, paragraphs: string[], href: string, button: string) => {
    const user = await getUser(userId);
    if (!user) return false;
    await addNotification(userId, heading, body, href);
    const mail = renderMail({
      subject,
      heading,
      paragraphs,
      button: { label: button, href: `${appUrl()}${href}` },
    });
    const delivered = await sendTenantEmail(user.email, mail.subject, mail.text, mail.html);
    if (!delivered && process.env.RESEND_API_KEY && process.env.RESEND_FROM) return false;
    return true;
  };
  for (const deadline of await openDeadlines()) {
    if (!deadline.due_date) continue;
    const slots = pendingReminderSlots(deadline.due_date, today, await reminderSlotsSent(deadline.id));
    if (slots.length === 0) continue;
    const users = await unitMemberUserIds(deadline.unit_id);
    for (const slot of slots) {
      let failed = false;
      for (const userId of users) {
        const title = slot === "0d" ? "A tracked date is today" : `A tracked date is ${slot === "7d" ? "7" : "3"} days away`;
        const ok = await deliver(
          userId,
          `Rent Right: ${title}`,
          title,
          deadline.explanation,
          [
            deadline.explanation,
            `Rule ID: ${deadline.rule_id}`,
            "This is a reminder of a date computed from what you entered. Confirm with the official source.",
          ],
          "/deadlines",
          "Open deadlines",
        );
        if (!ok) {
          const user = await getUser(userId);
          if (user) failed = true;
          continue;
        }
        sent += 1;
      }
      if (!failed) await markReminder(deadline.id, slot, "in_app_email");
    }
  }
  for (const nudge of await listDueNudges()) {
    const on = isoDay(nudge.tenant_reminder_on);
    const late = daysBetween(on, today);
    if (late < 0 || late > 1) continue;
    const slot = `nudge:${on}`;
    if ((await reminderSlotsSent(nudge.id)).includes(slot)) continue;
    const users = await unitMemberUserIds(nudge.unit_id);
    const label = nudge.kind === "custom_reminder" && nudge.explanation
      ? nudge.explanation
      : "A reminder you saved on a record.";
    const body = `This is a reminder you set for yourself for ${on}. It is not a legal deadline. ${label} Nothing was sent to the landlord.`;
    let failed = false;
    for (const userId of users) {
      const ok = await deliver(
        userId,
        "Rent Right: Your reminder",
        "Your reminder",
        body,
        [
          `This is a reminder you set for yourself for ${on}. It is not a legal deadline.`,
          label,
          "Nothing was sent to the landlord.",
        ],
        "/records",
        "Open records",
      );
      if (!ok) {
        const user = await getUser(userId);
        if (user) failed = true;
        continue;
      }
      sent += 1;
    }
    if (!failed) await markReminder(nudge.id, slot, "in_app_email");
  }
  return sent;
}

