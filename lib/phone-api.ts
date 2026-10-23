import "server-only";

import { legalNotice, LIBRARY_VERSION, type Locale } from "@/lib/disclaimer";
import { signSession } from "@/lib/crypto";
import {
  addFeedback,
  addLedger,
  archiveChat,
  createInvite,
  createMagicLink,
  consumeMagicLink,
  createUnit,
  deleteUserAccount,
  reviewerAttemptOpen,
  getDeposit,
  getLog,
  getUser,
  latestRentCheck,
  listAssistant,
  listConditions,
  insertCustomReminder,
  listDeadlines,
  listLeaseReviews,
  listLedger,
  listLogs,
  listMessages,
  insertCondition,
  primaryUnit,
  profileForAuthUser,
  saveFile,
  saveRentCheck,
  setDeadlineStatus,
  setTenantReminder,
  unitAddress,
  updateUnit,
  updateUser,
  voidLedger,
  type Unit,
  type UnitInput,
  type User,
} from "@/lib/db";
import { emailValue } from "@/lib/forms";
import { formatDate, formatMoney, formatTimestamp, percentLabel } from "@/lib/format";
import { getRule } from "@/lib/rules/library";
import { suggestPlace } from "@/lib/geo";
import { detectPlace, localProtectionNote, placeSummary } from "@/lib/rules/detect";
import { isAllowedJurisdiction } from "@/lib/rules/cities";
import { checkRentIncrease, type Jurisdiction, type RsoStatus, type RstpoTier } from "@/lib/rules/engine";
import { parseISODate, todayISO } from "@/lib/rules/dates";
import {
  deadlineCards,
  evidenceFilename,
  issueBoard,
  logCards,
  nextSteps,
  recordsLabels,
  reminderNote,
  type DeadlineInput,
  type LogInput,
  type MessageInput,
} from "@/lib/records-view";
import {
  chatPreview,
  deliveryLabel,
  dueLine,
  findingStatus,
  logKind,
  messageSide,
  rentHeadline,
} from "@/lib/phone";
import { sendTenantEmail } from "@/lib/email";
import { signInMessage, signInUrl } from "@/lib/email-template";
import { currentUser } from "@/lib/session";
import { reviewerEmail, reviewerMatch } from "@/lib/reviewer";
import { DEMO_EMAIL, startSampleTenancy } from "@/lib/seed";
import { userFromAppleIdToken } from "@/lib/supabase-auth";
import { appUrl, relayAddress, tx } from "@/lib/text";
import { parseCard } from "@/lib/chat-card";
import { runChatTurn } from "@/lib/chat-turn";
import { archivedNote, previewResidence, residencePayload, saveResidence, selectResidence } from "@/lib/residence";
import { issueHistory, issueSummary, reopenRepair, resolveRepair } from "@/lib/issues";
import { askAssistant, emailLandlord, extractPdfOrText, recordLog, runLeaseReview, sampleLeaseText, saveDepositAndDeadline } from "@/lib/workflow";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    },
  });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dollars(value: unknown): number | null {
  if (value == null || value === "") return null;
  const amount = Number(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a dollar amount.");
  return Math.round(amount * 100);
}

function dateOrNull(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("Use a real date.");
  return raw;
}

function reminderDate(value: unknown, locale: Locale, required: boolean): string | null {
  const raw = text(value);
  if (!raw) {
    if (required) throw new Error(tx(locale, "Enter a date.", "Escriba una fecha."));
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw < "2000-01-01" || raw > "2100-12-31") {
    throw new Error(tx(locale, "Use a real date.", "Use una fecha real."));
  }
  try {
    parseISODate(raw);
  } catch {
    throw new Error(tx(locale, "Use a real date.", "Use una fecha real."));
  }
  return raw;
}

function localeOf(user: User | null, input?: Record<string, unknown>): Locale {
  if (input && (input.locale === "es" || input.locale === "en")) return input.locale;
  return user?.locale === "es" ? "es" : "en";
}

async function sessionPayload(user: User) {
  const unit = await primaryUnit(user.id);
  return {
    token: signSession(user.id),
    user: publicUser(user),
    needsUnit: !unit,
    unit: unit ? publicUnit(unit) : null,
  };
}

function publicUser(user: User) {
  return {
    name: user.name,
    email: user.email,
    locale: user.locale,
    lowBandwidth: user.lowBandwidth,
    sample: user.email === DEMO_EMAIL,
  };
}

function publicUnit(unit: Unit) {
  return {
    id: unit.id,
    address: unitAddress(unit),
    landlordName: unit.landlordName,
    landlordEmail: unit.landlordEmail,
    relay: relayAddress(unit.relayLocal),
    rent: unit.rentCents != null ? formatMoney(unit.rentCents, "en") : "",
    jurisdiction: unit.jurisdiction,
    rsoStatus: unit.rsoStatus,
    rstpoTier: unit.rstpoTier,
    archived: Boolean(unit.archivedAt),
  };
}

async function actor(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new Error("Sign in required.");
  return user;
}

async function withUnit(): Promise<{ user: User; unit: Unit }> {
  const user = await actor();
  const unit = await primaryUnit(user.id);
  if (!unit) throw new Error("Add your unit first.");
  return { user, unit };
}

function unitInput(input: Record<string, unknown>): UnitInput {
  const street = text(input.street);
  const city = text(input.city);
  const landlordName = text(input.landlordName);
  const landlordEmail = text(input.landlordEmail);
  if (!street || !city || !landlordName || !landlordEmail) throw new Error("Add the address and landlord.");
  const requested = text(input.jurisdiction);
  const detected = detectPlace({
    address: street,
    city,
    postalCode: text(input.postalCode),
    region: text(input.region),
  });
  const jurisdiction = requested && requested !== "unsure" && isAllowedJurisdiction(requested) ? requested : detected.jurisdiction;
  if (!isAllowedJurisdiction(jurisdiction)) throw new Error("Choose a jurisdiction.");
  return {
    street,
    unitNumber: text(input.unitNumber),
    city,
    postalCode: text(input.postalCode),
    region: text(input.region),
    jurisdiction,
    jurisdictionConfirmed: input.jurisdictionConfirmed === true,
    rsoStatus: (text(input.rsoStatus) || "unsure") as RsoStatus,
    rstpoTier: (text(input.rstpoTier) || "unsure") as RstpoTier,
    landlordName,
    landlordEmail: emailValue(landlordEmail),
    landlordPhone: text(input.landlordPhone),
    rentCents: dollars(input.rent),
    depositCents: dollars(input.deposit),
    moveInDate: dateOrNull(input.moveInDate),
    leaseEndDate: dateOrNull(input.leaseEndDate),
  };
}

function notice(locale: Locale) {
  return legalNotice(locale);
}

function unitPlace(unit: Unit) {
  return detectPlace({ address: unit.street, city: unit.city, postalCode: unit.postalCode, region: unit.region });
}

function unitLocal(unit: Unit, locale: Locale) {
  const place = unitPlace(unit);
  if (place.pack) return null;
  return localProtectionNote(place.localOrdinance, locale);
}

export async function handlePhone(request: Request, path: string[]): Promise<Response> {
  try {
    const user = await currentUser();
    const { runAsUser } = await import("@/lib/session");
    return await runAsUser(user, () => route(request, path));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    const status = message === "Sign in required." ? 401 : 400;
    return json({ error: message }, status);
  }
}

async function route(request: Request, path: string[]): Promise<Response> {
  const method = request.method;
  const key = path.join("/");

  if (method === "GET" && key === "") {
    return json({
      name: "Rent Right",
      libraryVersion: LIBRARY_VERSION,
      notice: notice("en"),
      noticeEs: notice("es"),
    });
  }

  if (method === "POST" && key === "auth/magic") {
    const input = await readBody(request);
    const email = emailValue(text(input.email));
    const { token, supabase } = await createMagicLink(email);
    if (token && process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
      const mail = signInMessage(signInUrl(token));
      const sent = await sendTenantEmail(email, mail.subject, mail.text, mail.html);
      return json({ sent });
    }
    if (supabase && !token) return json({ sent: true });
    return json({ sent: false, devToken: token });
  }

  if (method === "POST" && key === "auth/verify") {
    const input = await readBody(request);
    const user = await consumeMagicLink(text(input.token));
    return json(await sessionPayload(user));
  }

  if (method === "POST" && key === "auth/demo") {
    const id = await startSampleTenancy();
    const user = await getUser(id);
    if (!user) throw new Error("Could not open the sample.");
    return json(await sessionPayload(user));
  }

  if (method === "POST" && key === "auth/reviewer") {
    const input = await readBody(request);
    const email = text(input.email).trim().toLowerCase();
    const code = text(input.code).trim();
    const expected = reviewerEmail();
    if (!expected || email !== expected) throw new Error("That code did not work.");
    if (!(await reviewerAttemptOpen(email))) throw new Error("Too many tries. Wait an hour and try again.");
    if (!reviewerMatch(email, code)) throw new Error("That code did not work.");
    const id = await startSampleTenancy();
    const user = await getUser(id);
    if (!user) throw new Error("Could not open the sample.");
    return json(await sessionPayload(user));
  }

  if (method === "POST" && key === "auth/apple") {
    const input = await readBody(request);
    const remote = await userFromAppleIdToken(text(input.identityToken), text(input.nonce));
    if (!remote) throw new Error("Could not sign in with Apple.");
    const user = await profileForAuthUser(remote.id, remote.email);
    const name = text(input.name);
    if (name && !user.name) await updateUser(user.id, { name });
    const fresh = await getUser(user.id);
    if (!fresh) throw new Error("Could not sign in with Apple.");
    return json(await sessionPayload(fresh));
  }

  if (method === "GET" && key === "me") {
    const user = await actor();
    return json(await sessionPayload(user));
  }

  if (method === "POST" && key === "place") {
    const user = await actor();
    const body = await readBody(request);
    const street = text(body.street);
    const city = text(body.city);
    const postalCode = text(body.postalCode);
    const region = text(body.region) || "CA";
    if (!street || !city || !postalCode) throw new Error("Add the street, city, and ZIP.");
    const found = await suggestPlace([street, city, region, postalCode].join(", "));
    return json({
      summary: placeSummary(found.place, user.locale),
      inCalifornia: found.place.inCalifornia,
      suggestion: found.suggestion,
    });
  }

  if (method === "POST" && key === "unit") {
    const user = await actor();
    const body = await readBody(request);
    const input = unitInput(body);
    if (text(body.name)) await updateUser(user.id, { name: text(body.name) });
    const existing = await primaryUnit(user.id);
    const unit = existing ? await updateUnit(user.id, existing.id, input) : await createUnit(user.id, input);
    const fresh = await getUser(user.id);
    if (!fresh) throw new Error("Sign in required.");
    return json({ ...(await sessionPayload(fresh)), unit: publicUnit(unit) });
  }

  if (method === "GET" && key === "home") return json(await homePayload());
  if (method === "GET" && key === "lease") return json(await leasePayload());
  if (method === "POST" && key === "lease") return json(await reviewPosted(await readBody(request)));
  if (method === "POST" && key === "lease/sample") return json(await reviewSample());
  if (method === "POST" && key === "lease/feedback") {
    const { user } = await withUnit();
    const input = await readBody(request);
    await addFeedback(user.id, text(input.reviewId), text(input.note) || "This looks wrong.");
    return json({ ok: true });
  }
  if (method === "GET" && key === "log") return json(await logPayload());
  if (method === "GET" && path[0] === "log" && path[1]) return json(await logDetail(path[1]));
  if (method === "POST" && key === "log") return json(await createLog(await readBody(request)));
  if (method === "GET" && key === "chat") return json(await chatPayload());
  if (method === "POST" && key === "chat") return json(await sendChat(await readBody(request)));
  if (method === "GET" && key === "dates") return json(await datesPayload());
  if (method === "POST" && path[0] === "dates" && path[1]) {
    const user = await actor();
    const input = await readBody(request);
    await setDeadlineStatus(user.id, path[1], input.status === "done" ? "done" : "open");
    return json(await datesPayload());
  }
  if (method === "GET" && key === "deposit") return json(await depositPayload());
  if (method === "POST" && key === "deposit") return json(await saveDepositForm(await readBody(request)));
  if (method === "GET" && key === "increase") return json(await increasePayload());
  if (method === "POST" && key === "increase") return json(await runIncrease(await readBody(request)));
  if (method === "GET" && key === "assistant") return json(await assistantPayload());
  if (method === "POST" && key === "assistant") return json(await ask(await readBody(request)));
  if (method === "GET" && key === "thread") return json(await threadPayload());
  if (method === "POST" && key === "records/reminder") return json(await saveReminder(await readBody(request)));
  if (method === "POST" && key === "records/reminder/new") return json(await addReminder(await readBody(request)));
  if (method === "POST" && key === "records/resolve") return json(await resolvePosted(await readBody(request)));
  if (method === "POST" && key === "records/reopen") return json(await reopenPosted(await readBody(request)));
  if (method === "POST" && key === "thread") return json(await postThread(await readBody(request)));
  if (method === "GET" && key === "records") return json(await recordsPayload());
  if (method === "GET" && key === "ledger") return json(await ledgerPayload());
  if (method === "POST" && key === "ledger") return json(await addPayment(await readBody(request)));
  if (method === "POST" && path[0] === "ledger" && path[2] === "void" && path[1]) {
    const user = await actor();
    await voidLedger(user.id, path[1]);
    return json(await ledgerPayload());
  }
  if (method === "GET" && key === "condition") return json(await conditionPayload());
  if (method === "POST" && key === "condition") return json(await saveCondition(await readBody(request)));
  if (method === "GET" && key === "packet") return json(await packetPayload());
  if (method === "POST" && key === "settings") return json(await saveSettings(await readBody(request)));
  if (method === "GET" && key === "residence") return json(await residencePayload(await actor()));
  if (method === "POST" && key === "residence/preview") return json(await previewResidence(await actor(), await readBody(request)));
  if (method === "POST" && key === "residence/save") {
    const user = await actor();
    const saved = await saveResidence(user, await readBody(request));
    const fresh = await getUser(user.id);
    if (!fresh) throw new Error("Sign in required.");
    return json({ ...(await sessionPayload(fresh)), note: saved.note });
  }
  if (method === "POST" && key === "residence/select") {
    const user = await actor();
    await selectResidence(user, text((await readBody(request)).id));
    const fresh = await getUser(user.id);
    if (!fresh) throw new Error("Sign in required.");
    return json(await sessionPayload(fresh));
  }
  if (method === "POST" && key === "invite") {
    const { user, unit } = await withUnit();
    const token = await createInvite(user.id, unit.id);
    return json({ link: `${appUrl()}/invite/${token}` });
  }
  if (method === "POST" && key === "account/delete") {
    const user = await actor();
    const input = await readBody(request);
    if (text(input.confirm) !== "DELETE") throw new Error("Type DELETE to confirm.");
    await deleteUserAccount(user.id);
    return json({ ok: true });
  }

  return json({ error: "Not found." }, 404);
}

async function homePayload() {
  const { user, unit } = await withUnit();
  const locale = user.locale;
  const today = todayISO();
  const deadlines = (await listDeadlines(user.id, unit.id)).filter((item) => item.status === "open");
  const logs = await listLogs(user.id, unit.id);
  const rent = await latestRentCheck(user.id, unit.id);
  const cards: { id: string; href: string; kicker: string; title: string; subtitle: string; detail: string; tone: string }[] = [];

  const upcoming = deadlines.find((item) => item.dueDate && item.dueDate >= today) || deadlines[deadlines.length - 1];
  const depositDue = deadlines.find((item) => item.kind === "deposit");
  const shown = [upcoming, depositDue].filter((item, index, list) => item && list.findIndex((other) => other?.id === item.id) === index);
  for (const item of shown) {
    if (!item) continue;
    const line = dueLine(item.dueDate, today, locale);
    cards.push({
      id: item.id,
      href: item.kind === "deposit" ? "/deposit" : "/dates",
      kicker: item.kind === "deposit" ? tx(locale, "Deposit", "Depósito") : tx(locale, "Repair", "Reparación"),
      title: line.title,
      subtitle: line.subtitle,
      detail: locale === "es" ? item.explanationEs : item.explanation,
      tone: line.subtitle === "Date passed" || line.subtitle === "Fecha pasada" ? "bad" : "ok",
    });
  }

  const flag = logs
    .map((entry) => entry.flags.retaliation as { flagged?: boolean; explanation?: string; explanationEs?: string; ruleId?: string } | undefined)
    .find((item) => item?.flagged);
  if (flag) {
    cards.push({
      id: "retaliation",
      href: "/log",
      kicker: tx(locale, "Notice", "Aviso"),
      title: tx(locale, "After a repair", "Después de una reparación"),
      subtitle: tx(locale, "Inside 180 days", "Dentro de 180 días"),
      detail: `${locale === "es" ? flag.explanationEs : flag.explanation || ""} Rule ${flag.ruleId || "CA-CC-1942.5"}.`,
      tone: "warn",
    });
  }

  if (rent?.result) {
    const status = rent.result.applicable.status;
    cards.push({
      id: rent.id,
      href: "/increase",
      kicker: tx(locale, "Rent", "Renta"),
      title: rentHeadline(status, locale),
      subtitle: rent.result.applicable.ppm != null ? percentLabel(rent.result.applicable.ppm) : tx(locale, "No single cap", "Sin un solo tope"),
      detail: locale === "es" ? rent.result.applicable.reasonEs : rent.result.applicable.reason,
      tone: status === "over_cap" ? "bad" : status === "within_cap" ? "ok" : "warn",
    });
  }

  return {
    hello: user.name || tx(locale, "there", ""),
    address: unitAddress(unit),
    sample: user.email === DEMO_EMAIL,
    local: unitLocal(unit, locale),
    cards,
    notice: notice(locale),
  };
}

async function leasePayload() {
  const { user, unit } = await withUnit();
  const locale = user.locale;
  const reviews = (await listLeaseReviews(user.id, unit.id)).slice(0, 3).map((review) => ({
    id: review.id,
    filename: review.filename,
    when: formatTimestamp(review.createdAt, locale),
    findings: review.result.findings.map((finding) => {
      const rule = finding.ruleId ? getRule(finding.ruleId) : null;
      return {
        id: finding.id,
        status: findingStatus(finding.label, locale),
        ruleId: finding.ruleId,
        title: rule ? (locale === "es" ? rule.titleEs : rule.titleEn) : tx(locale, "No matching rule", "Sin regla"),
        quote: finding.quote,
        detail: locale === "es" ? finding.reasonEs : finding.reasonEn,
        citation: finding.citation,
      };
    }),
  }));
  return { reviews, local: unitLocal(unit, locale), notice: notice(locale) };
}

async function reviewPosted(input: Record<string, unknown>) {
  const { user, unit } = await withUnit();
  let textBody = text(input.text);
  const filename = text(input.filename) || "lease.txt";
  if (typeof input.fileBase64 === "string" && input.fileBase64) {
    const bytes = Buffer.from(input.fileBase64, "base64");
    await saveFile(user.id, unit.id, filename, text(input.mime) || "application/octet-stream", bytes);
    const extracted = await extractPdfOrText(bytes, text(input.mime), filename);
    textBody = [extracted, textBody].filter(Boolean).join("\n\n");
  }
  await runLeaseReview(user, unit, textBody, filename);
  return leasePayload();
}

async function reviewSample() {
  const { user, unit } = await withUnit();
  await runLeaseReview(user, unit, sampleLeaseText(), "sample-lease.txt");
  return leasePayload();
}

async function logPayload() {
  const { user, unit } = await withUnit();
  const locale = user.locale;
  return {
    items: (await listLogs(user.id, unit.id)).map((entry) => ({
      id: entry.id,
      kind: logKind(entry.type, locale),
      date: formatDate(entry.eventDate, locale),
      line: entry.description.slice(0, 80),
    })),
  };
}

async function logDetail(id: string) {
  const { user, unit } = await withUnit();
  const locale = user.locale;
  const entry = await getLog(user.id, id);
  const flag = entry.flags.retaliation as { flagged?: boolean; explanation?: string; explanationEs?: string; ruleId?: string } | undefined;
  const repair = entry.type === "repair";
  const summary = repair ? issueSummary(entry, await listMessages(user.id, unit.id), locale) : null;
  const labels = recordsLabels(locale);
  return {
    id: entry.id,
    kind: logKind(entry.type, locale),
    date: formatDate(entry.eventDate, locale),
    text: entry.description,
    record: `Hash ${entry.contentHash}\nPrevious ${entry.prevHash}`,
    flag: flag?.flagged
      ? { title: tx(locale, "Inside 180 days of a repair", "Dentro de 180 días de una reparación"), detail: `${locale === "es" ? flag.explanationEs : flag.explanation} Rule ${flag.ruleId}.`, notice: notice(locale) }
      : null,
    history: repair ? await issueHistory(user, entry.id) : [],
    resolution: repair && summary
      ? {
          status: entry.status,
          pending: entry.status === "pending_confirm",
          canResolve: entry.status !== "resolved" && !unit.archivedAt,
          canReopen: entry.status === "resolved" && !unit.archivedAt,
          source: summary.source,
          duration: summary.duration,
          note: entry.resolutionNote,
          reported: summary.reportedLabel,
          resolved: summary.resolvedLabel,
          pendingTitle: entry.status === "pending_confirm" ? tx(locale, "Landlord says fixed, confirm?", "El propietario dice que está arreglado. ¿Confirmar?") : null,
          pendingNote: summary.pendingNote,
          earliest: entry.eventDate || entry.createdAt.slice(0, 10),
          today: todayISO(),
        }
      : null,
    labels: {
      markResolved: labels.markResolved,
      confirmResolved: labels.confirmResolved,
      resolutionNote: labels.resolutionNote,
      resolutionDate: labels.resolutionDate,
      reopen: labels.reopen,
      history: labels.history,
    },
  };
}

async function createLog(input: Record<string, unknown>) {
  const { user, unit } = await withUnit();
  if (!text(input.description)) throw new Error("Add a short note.");
  let photoFileId: string | null = null;
  if (typeof input.photoBase64 === "string" && input.photoBase64) {
    photoFileId = await saveFile(user.id, unit.id, "log-photo.jpg", "image/jpeg", Buffer.from(input.photoBase64, "base64"));
  }
  const entry = await recordLog({
    user,
    unit,
    type: text(input.type) || "repair",
    noticeKind: text(input.noticeKind) || null,
    severity: text(input.severity) || null,
    room: text(input.room) || null,
    description: text(input.description),
    eventDate: dateOrNull(input.eventDate) || todayISO(),
    photoFileId,
    sendEmail: input.sendEmail === true,
    subject: text(input.subject),
    entryAt: text(input.entryAt) || null,
    noticeAt: text(input.noticeAt) || null,
  });
  return { id: entry.id };
}

async function chatPayload() {
  const user = await actor();
  const unit = await primaryUnit(user.id);
  const locale = user.locale;
  if (!unit) return { landlord: "", items: [], needsUnit: true, archived: false, archivedNote: null };
  return {
    landlord: unit.landlordName || unit.landlordEmail,
    archived: Boolean(unit.archivedAt),
    archivedNote: archivedNote(unit, locale),
    items: (await listMessages(user.id, unit.id)).map((message) => {
      const preview = chatPreview(message.body);
      return {
        id: message.id,
        side: messageSide(message.direction),
        text: preview.text,
        detail: preview.detail,
        time: formatTimestamp(message.createdAt, locale),
        status: deliveryLabel(message.deliveryStatus, message.openIndicative, locale),
      };
    }),
  };
}

async function sendChat(input: Record<string, unknown>) {
  const user = await actor();
  const unit = await primaryUnit(user.id);
  if (!unit) throw new Error("Add your place before sending a message.");
  const message = text(input.text);
  if (message.length < 2) throw new Error("Write a message.");
  await emailLandlord({
    user,
    unit,
    logEntryId: null,
    subject: text(input.subject) || tx(user.locale, "Message from your tenant", "Mensaje de su inquilino"),
    tenantText: message,
  });
  return chatPayload();
}

async function datesPayload() {
  const { user, unit } = await withUnit();
  const locale = user.locale;
  const today = todayISO();
  return {
    notice: notice(locale),
    items: (await listDeadlines(user.id, unit.id)).map((item) => {
      const line = dueLine(item.dueDate, today, locale);
      return {
        id: item.id,
        title: item.kind === "deposit" ? tx(locale, "Deposit", "Depósito") : item.kind === "repair" ? tx(locale, "Repair", "Reparación") : tx(locale, "Notice", "Aviso"),
        date: line.title,
        subtitle: line.subtitle,
        status: item.status,
        detail: `${locale === "es" ? item.explanationEs : item.explanation}\n\n${item.computation}\nRule ${item.ruleId}`,
      };
    }),
  };
}

async function depositPayload() {
  const { user, unit } = await withUnit();
  const locale = user.locale;
  const deposit = await getDeposit(user.id, unit.id);
  const deadline = (await listDeadlines(user.id, unit.id)).find((item) => item.kind === "deposit" && item.status === "open");
  const line = dueLine(deadline?.dueDate || null, todayISO(), locale);
  return {
    title: deadline ? line.title : tx(locale, "No move-out date", "Sin fecha de salida"),
    subtitle: deadline ? line.subtitle : tx(locale, "Add a move-out date", "Agregue la salida"),
    amount: deposit?.amount_cents != null ? formatMoney(deposit.amount_cents, locale) : unit.depositCents != null ? formatMoney(unit.depositCents, locale) : "",
    moveOut: deposit?.move_out_date || "",
    forwarding: deposit?.forwarding_address || "",
    deductions: deposit?.landlord_deductions || "",
    detail: deadline ? (locale === "es" ? deadline.explanationEs : deadline.explanation) : tx(locale, "The 21-day count starts when you enter a move-out date.", "El conteo de 21 días empieza cuando anota la fecha de salida."),
    notice: notice(locale),
  };
}

async function saveDepositForm(input: Record<string, unknown>) {
  const { user, unit } = await withUnit();
  await saveDepositAndDeadline(user, unit, {
    amountCents: dollars(input.amount),
    receivedDate: dateOrNull(input.receivedDate),
    moveOutDate: dateOrNull(input.moveOutDate),
    forwardingAddress: text(input.forwardingAddress),
    landlordDeductions: text(input.landlordDeductions),
    tenantNotes: text(input.tenantNotes),
  });
  return depositPayload();
}

async function increasePayload() {
  const { user, unit } = await withUnit();
  const locale = user.locale;
  const saved = await latestRentCheck(user.id, unit.id);
  const result = saved?.result;
  return {
    jurisdiction: unit.jurisdiction,
    rsoStatus: unit.rsoStatus,
    lowest: unit.rentCents != null ? String(unit.rentCents / 100) : "",
    result: result
      ? {
          title: rentHeadline(result.applicable.status, locale),
          subtitle: result.applicable.ppm != null ? percentLabel(result.applicable.ppm) : tx(locale, "No single cap", "Sin un solo tope"),
          max: result.applicable.maxRentCents != null ? formatMoney(result.applicable.maxRentCents, locale) : null,
          ruleId: result.applicable.ruleId,
          detail: [
            locale === "es" ? result.applicable.reasonEs : result.applicable.reason,
            result.notice.computation,
            result.frequency.computation,
            locale === "es" ? result.jurisdictionNoteEs : result.jurisdictionNote,
            result.exemptionUnverified ? tx(locale, "A claimed exemption was not verified.", "Una exención mencionada no se verificó.") : "",
          ].filter(Boolean).join("\n\n"),
        }
      : null,
    local: unitLocal(unit, locale),
    notice: notice(locale),
  };
}

async function runIncrease(input: Record<string, unknown>) {
  const { user, unit } = await withUnit();
  const lowest = dollars(input.lowest);
  const proposed = dollars(input.proposed);
  if (!lowest || !proposed) throw new Error("Enter the current rent and the proposed rent.");
  const effectiveDate = dateOrNull(input.effectiveDate);
  if (!effectiveDate) throw new Error("Enter the date the new rent would start.");
  const areas = ["los_angeles_orange", "riverside_san_bernardino", "san_diego", "san_francisco_bay", "other_ca"] as const;
  const jurisdiction = (text(input.jurisdiction) || unit.jurisdiction) as Jurisdiction;
  const place = unitPlace(unit);
  const statewide = jurisdiction === "ca" || jurisdiction === "other_ca";
  const result = checkRentIncrease({
    jurisdiction,
    rsoStatus: (text(input.rsoStatus) || unit.rsoStatus) as RsoStatus,
    rstpoTier: (text(input.rstpoTier) || unit.rstpoTier) as RstpoTier,
    countyArea: areas.find((area) => area === text(input.countyArea)) || (statewide ? place.area ?? undefined : undefined),
    localOrdinanceName: statewide ? place.localOrdinance?.name ?? null : null,
    lowestRentCents: lowest,
    proposedRentCents: proposed,
    noticeDate: dateOrNull(input.noticeDate) || todayISO(),
    effectiveDate,
    lastIncreaseDate: dateOrNull(input.lastIncreaseDate),
    claimsExemption: input.claimsExemption === true,
  });
  await saveRentCheck(user.id, unit.id, input, result);
  return increasePayload();
}

async function assistantCards(user: User) {
  const locale = user.locale;
  const rows = await listAssistant(user.id, "visible");
  return rows.map((row) => {
    if (row.role === "user") return { role: "user" as const, text: row.content };
    const ids = Array.isArray(row.rule_ids) ? row.rule_ids.map(String) : JSON.parse(String(row.rule_ids || "[]")) as string[];
    const rules = ids.map((id) => getRule(id)).filter((rule) => rule != null);
    const handoff = /cannot tell you what to do|no puede decirle qué hacer/i.test(row.content);
    const unsure = row.unsure === 1 || rules.length === 0;
    const first = rules[0];
    const headline = handoff
      ? tx(locale, "Contact legal aid", "Contacte asistencia legal")
      : unsure || !first
        ? tx(locale, "Unsure", "No se puede precisar")
        : locale === "es" ? first.titleEs : first.titleEn;
    const detail = rules.length
      ? rules.map((rule) => `${locale === "es" ? rule.summaryEs : rule.summaryEn}\n${rule.id} · ${rule.citation}`).join("\n\n")
      : tx(locale, "No library rule matched closely enough to cite.", "Ninguna regla de la biblioteca coincidió lo bastante para citarla.");
    return { role: "assistant" as const, headline, detail, ruleIds: ids, notice: notice(locale) };
  });
}

async function assistantPayload() {
  const user = await actor();
  return { items: await assistantCards(user), notice: notice(user.locale) };
}

async function ask(input: Record<string, unknown>) {
  const user = await actor();
  const unit = await primaryUnit(user.id);
  await askAssistant(user, unit, text(input.question), user.locale);
  return assistantPayload();
}

function chips(locale: Locale) {
  return locale === "es"
    ? [
        { label: "Se filtra el fregadero", text: "Se filtra el fregadero" },
        { label: "Revisar mi contrato", text: "Revisar mi contrato" },
        { label: "Revisar un aumento", text: "Mi casero subio la renta a $2,100" },
        { label: "Mi depósito", text: "Me mude, donde esta mi deposito?" },
      ]
    : [
        { label: "My sink is leaking", text: "My sink is leaking" },
        { label: "Check my lease", text: "Check my lease" },
        { label: "Check a rent increase", text: "My landlord raised rent to $2,100" },
        { label: "Where's my deposit?", text: "I moved out, where's my deposit?" },
      ];
}

function emptyThread(user: User) {
  const locale = user.locale;
  return {
    landlord: "",
    needsUnit: true,
    items: [] as { role: "user" | "card" }[],
    chips: chips(locale),
    notice: notice(locale),
    steps: { title: tx(locale, "Your next steps", "Sus próximos pasos"), held: tx(locale, "Nothing was sent.", "No se envió nada."), items: [] },
    packetFile: evidenceFilename(todayISO()),
  };
}

async function threadPayload() {
  const user = await actor();
  const unit = await primaryUnit(user.id);
  if (!unit) return emptyThread(user);
  const locale = user.locale;
  const rows = await listAssistant(user.id, "visible");
  const items = rows.map((row) => {
    if (row.role === "user") return { role: "user" as const, text: row.content };
    const card = parseCard(row.content);
    if (!card) {
      return {
        role: "card" as const,
        headline: tx(locale, "Note", "Nota"),
        status: tx(locale, "Saved", "Guardado"),
        action: null,
        detail: row.content,
        ruleId: null,
        notice: notice(locale),
      };
    }
    return { role: "card" as const, ...card, notice: notice(locale) };
  });
  return {
    landlord: unit.landlordName,
    needsUnit: false,
    items,
    chips: rows.some((row) => row.role === "user") ? [] : chips(locale),
    notice: notice(locale),
    steps: (await recordsBundle(user, unit)).steps,
    packetFile: evidenceFilename(todayISO()),
    archived: Boolean(unit.archivedAt),
    archivedNote: archivedNote(unit, locale),
  };
}

async function postThread(input: Record<string, unknown>) {
  const user = await actor();
  const unit = await primaryUnit(user.id);
  if (!unit) {
    if (text(input.action) === "clear") {
      await archiveChat(user.id);
      return emptyThread(user);
    }
    throw new Error("Add your place before sending a message.");
  }
  const file = input.attachment;
  const attachment = file && typeof file === "object" && !Array.isArray(file)
    ? {
        name: text((file as { name?: unknown }).name) || "upload",
        mime: text((file as { mime?: unknown }).mime) || "application/octet-stream",
        base64: text((file as { base64?: unknown }).base64),
      }
    : null;
  if (attachment && attachment.base64.length > 8_000_000) throw new Error("That file is too large.");
  if (attachment && !attachment.base64) throw new Error("That file was empty.");
  await runChatTurn(user, unit, {
    text: text(input.text),
    action: text(input.action),
    draftId: text(input.draftId),
    attachment: attachment?.base64 ? attachment : null,
  });
  return threadPayload();
}

async function recordsBundle(user: User, unit: NonNullable<Awaited<ReturnType<typeof primaryUnit>>>) {
  const locale = user.locale;
  const today = todayISO();
  const deadlines = await listDeadlines(user.id, unit.id);
  const logs = await listLogs(user.id, unit.id);
  const messages = await listMessages(user.id, unit.id);
  const reviews = await listLeaseReviews(user.id, unit.id);
  const deadlineInput: DeadlineInput[] = deadlines.map((item) => ({
    id: item.id,
    kind: item.kind,
    ruleId: item.ruleId,
    anchorDate: item.anchorDate,
    dueDate: item.dueDate,
    explanation: item.explanation,
    explanationEs: item.explanationEs,
    computation: item.computation,
    sourceId: item.sourceId,
    status: item.status,
    tenantReminderOn: item.tenantReminderOn,
  }));
  const logInput: LogInput[] = logs.map((item) => ({
    id: item.id,
    type: item.type,
    description: item.description,
    eventDate: item.eventDate,
    createdAt: item.createdAt,
    status: item.status,
  }));
  const board = issueBoard({
    locale,
    logs: logs.map((item) => ({
      id: item.id,
      type: item.type,
      description: item.description,
      eventDate: item.eventDate,
      createdAt: item.createdAt,
      status: item.status,
      room: item.room,
      resolvedAt: item.resolvedAt,
      resolvedBy: item.resolvedBy,
      resolutionNote: item.resolutionNote,
      flags: item.flags,
    })),
    messages: messages.map((item) => ({
      logEntryId: item.logEntryId,
      direction: item.direction,
      subject: item.subject,
      deliveryStatus: item.deliveryStatus,
      createdAt: item.createdAt,
    })),
  });
  const messageInput: MessageInput[] = messages.map((item) => ({
    logEntryId: item.logEntryId,
    direction: item.direction,
    subject: item.subject,
    deliveryStatus: item.deliveryStatus,
    createdAt: item.createdAt,
  }));
  const mail = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  return {
    deadlines: deadlineCards(deadlineInput.filter((item) => item.status !== "resolved"), logInput, locale, today),
    notes: logCards(logInput.filter((item) => item.type !== "repair" && item.type !== "issue_event"), messageInput, locale).slice(0, 20),
    issues: board.open,
    archive: board.archive,
    steps: (() => {
      const planned = nextSteps({
        locale,
        today,
        deadlines: deadlineInput,
        logs: logInput,
        messages: messageInput,
        hasRecords: logs.length + messages.length + deadlines.length + reviews.length > 0,
      });
      if (!unit.archivedAt) return planned;
      return { ...planned, items: planned.items.filter((item) => item.action === "export" || item.action === "small_claims") };
    })(),
    reviews,
    labels: recordsLabels(locale),
    reminderNote: reminderNote(mail, locale),
    reminderMail: mail,
    packetFile: evidenceFilename(today),
    today,
  };
}

async function recordsPayload() {
  const user = await actor();
  const unit = await primaryUnit(user.id);
  const locale = user.locale;
  const labels = recordsLabels(locale);
  if (!unit) {
    return {
      name: user.name,
      address: "",
      sample: user.email === DEMO_EMAIL,
      locale,
      notice: notice(locale),
      deadlines: [],
      notes: [],
      issues: [],
      archive: [],
      steps: { title: tx(locale, "Your next steps", "Sus próximos pasos"), held: tx(locale, "Nothing was sent.", "No se envió nada."), items: [] },
      lease: null,
      needsUnit: true,
      labels,
      reminderNote: reminderNote(false, locale),
      reminderMail: false,
      packetFile: evidenceFilename(todayISO()),
      today: todayISO(),
      archived: false,
      archivedNote: null,
    };
  }
  const bundle = await recordsBundle(user, unit);
  const review = bundle.reviews[0];
  const finding = review?.result.findings.find((item) => item.label !== "looks_standard") || review?.result.findings[0];
  return {
    name: user.name,
    address: unitAddress(unit),
    sample: user.email === DEMO_EMAIL,
    locale,
    notice: notice(locale),
    deadlines: bundle.deadlines,
    notes: bundle.notes,
    issues: bundle.issues,
    archive: bundle.archive,
    steps: bundle.steps,
    lease: review
      ? {
          filename: review.filename || tx(locale, "Lease", "Contrato"),
          headline: finding ? findingStatus(finding.label, locale) : tx(locale, "Reviewed", "Revisado"),
          detail: finding ? `${finding.quote}\n\n${finding.ruleId || ""}` : "",
        }
      : null,
    labels: bundle.labels,
    reminderNote: bundle.reminderNote,
    reminderMail: bundle.reminderMail,
    packetFile: bundle.packetFile,
    today: bundle.today,
    archived: Boolean(unit.archivedAt),
    archivedNote: archivedNote(unit, locale),
  };
}

async function resolvePosted(input: Record<string, unknown>) {
  const { user } = await withUnit();
  const id = text(input.id);
  if (!id) throw new Error(tx(user.locale, "Choose a request.", "Elija una solicitud."));
  await resolveRepair(user, id, { note: text(input.note), date: text(input.date) || null, source: text(input.source) === "landlord" ? "landlord" : null });
  return recordsPayload();
}

async function reopenPosted(input: Record<string, unknown>) {
  const { user } = await withUnit();
  const id = text(input.id);
  if (!id) throw new Error(tx(user.locale, "Choose a request.", "Elija una solicitud."));
  await reopenRepair(user, id);
  return recordsPayload();
}

async function saveReminder(input: Record<string, unknown>) {
  const { user } = await withUnit();
  const id = text(input.id);
  if (!id) throw new Error(tx(user.locale, "Choose a reminder.", "Elija un recordatorio."));
  await setTenantReminder(user.id, id, reminderDate(input.date, user.locale, false));
  return recordsPayload();
}

async function addReminder(input: Record<string, unknown>) {
  const { user, unit } = await withUnit();
  const label = text(input.label);
  if (!label) throw new Error(tx(user.locale, "Say what this reminder is for.", "Diga para qué es este recordatorio."));
  if (label.length > 200) throw new Error(tx(user.locale, "Keep the reminder under 200 characters.", "El recordatorio debe tener menos de 200 caracteres."));
  const date = reminderDate(input.date, user.locale, true);
  if (!date) throw new Error(tx(user.locale, "Enter a date.", "Escriba una fecha."));
  await insertCustomReminder(user.id, unit.id, label, date);
  return recordsPayload();
}

async function ledgerPayload() {
  const { user, unit } = await withUnit();
  const locale = user.locale;
  return {
    items: (await listLedger(user.id, unit.id)).map((row) => ({
      id: row.id,
      amount: formatMoney(row.amount_cents, locale),
      date: formatDate(row.paid_on, locale),
      method: row.method,
      voided: Boolean(row.voided_at),
    })),
  };
}

async function addPayment(input: Record<string, unknown>) {
  const { user, unit } = await withUnit();
  const amount = dollars(input.amount);
  if (!amount) throw new Error("Enter the amount you paid.");
  await addLedger(user.id, unit.id, {
    amountCents: amount,
    periodStart: dateOrNull(input.periodStart),
    periodEnd: dateOrNull(input.periodEnd),
    paidOn: dateOrNull(input.paidOn) || todayISO(),
    method: text(input.method) || "other",
    notes: text(input.notes),
    receiptFileId: null,
  });
  return ledgerPayload();
}

const ROOMS = ["Living room", "Kitchen", "Bedroom", "Bathroom", "Other"];

async function conditionPayload() {
  const { user, unit } = await withUnit();
  const locale = user.locale;
  return {
    rooms: ROOMS,
    reports: (await listConditions(user.id, unit.id)).map((report) => ({
      id: report.id,
      kind: report.kind === "move_out" ? tx(locale, "Move-out", "Salida") : tx(locale, "Move-in", "Entrada"),
      when: formatTimestamp(report.createdAt, locale),
      line: report.rooms.map((room) => room.room).slice(0, 3).join(" · "),
      detail: report.rooms.map((room) => `${room.room}: ${room.condition}${room.notes ? ` — ${room.notes}` : ""}`).join("\n"),
      acked: Boolean(report.acknowledgedAt),
    })),
  };
}

async function saveCondition(input: Record<string, unknown>) {
  const { user, unit } = await withUnit();
  const roomsInput = Array.isArray(input.rooms) ? input.rooms : [];
  const rooms = ROOMS.map((room) => {
    const match = roomsInput.find((item) => item && typeof item === "object" && (item as { room?: string }).room === room) as { condition?: string; notes?: string; photoBase64?: string } | undefined;
    return {
      room,
      condition: match?.condition || "good",
      issues: [] as string[],
      notes: match?.notes || "",
      photoFileId: null as string | null,
    };
  });
  for (const room of rooms) {
    const match = roomsInput.find((item) => item && typeof item === "object" && (item as { room?: string }).room === room.room) as { photoBase64?: string } | undefined;
    if (match?.photoBase64) {
      room.photoFileId = await saveFile(user.id, unit.id, `${room.room}.jpg`, "image/jpeg", Buffer.from(match.photoBase64, "base64"));
    }
  }
  await insertCondition(user.id, unit.id, text(input.kind) === "move_out" ? "move_out" : "move_in", rooms, text(input.notes));
  return conditionPayload();
}

async function packetPayload() {
  const { user, unit } = await withUnit();
  const locale = user.locale;
  return {
    title: tx(locale, "Your records", "Sus registros"),
    subtitle: tx(locale, "Facts only", "Solo hechos"),
    detail: tx(
      locale,
      "The PDF lists what you stored. It does not say who is responsible or what to file.",
      "El PDF lista lo que usted guardó. No dice quién es responsable ni qué presentar.",
    ),
    address: unitAddress(unit),
    notice: notice(locale),
  };
}

async function saveSettings(input: Record<string, unknown>) {
  const user = await actor();
  const locale: Locale = input.locale === "es" ? "es" : input.locale === "en" ? "en" : user.locale;
  await updateUser(user.id, {
    name: text(input.name) || user.name,
    phone: text(input.phone),
    locale,
    lowBandwidth: input.lowBandwidth === true,
  });
  const fresh = await getUser(user.id);
  if (!fresh) throw new Error("Sign in required.");
  return sessionPayload(fresh);
}
