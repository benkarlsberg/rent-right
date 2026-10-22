"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { lookupJurisdiction } from "@/lib/geo";
import { isAllowedJurisdiction } from "@/lib/rules/cities";
import { detectPlace } from "@/lib/rules/detect";
import {
  acknowledgeCondition,
  addFeedback,
  addLandlordResponse,
  blockLandlord,
  addLedger,
  createInvite,
  createMagicLink,
  createUnit,
  deleteUserAccount,
  getLog,
  insertCondition,
  insertLog,
  messageByToken,
  peekUnit,
  reportAbuse,
  logMailed,
  primaryUnit,
  saveFile,
  saveRentCheck,
  setDeadlineStatus,
  updateUnit,
  updateUser,
  voidLedger,
  type UnitInput,
} from "@/lib/db";
import { centsField, dateField, emailValue, field, fileOf, must } from "@/lib/forms";
import { demandLetter } from "@/lib/letters";
import { checkRentIncrease, type AreaKey, type Jurisdiction, type RsoStatus, type RstpoTier } from "@/lib/rules/engine";
import { adoptActor, clearSessionCookie, currentUser, setSessionCookie, writeLocale } from "@/lib/session";
import { DEMO_EMAIL, startSampleTenancy } from "@/lib/seed";
import { appUrl } from "@/lib/text";
import { sendTenantEmail } from "@/lib/email";
import { askAssistant, emailLandlord, extractPdfOrText, recordLog, runLeaseReview, sampleLeaseText, saveDepositAndDeadline } from "@/lib/workflow";
import type { Locale } from "@/lib/disclaimer";

function fail(path: string, error: unknown): never {
  unstable_rethrow(error);
  const message = error instanceof Error ? error.message : "Something went wrong.";
  redirect(`${path}?error=${encodeURIComponent(message.slice(0, 300))}`);
}

const COUNTY_AREAS: AreaKey[] = [
  "los_angeles_orange",
  "riverside_san_bernardino",
  "san_diego",
  "san_francisco_bay",
  "other_ca",
];

async function actor() {
  const user = await currentUser();
  if (!user) redirect("/login");
  adoptActor(user.id);
  return user;
}

async function homeUnit() {
  const user = await actor();
  const unit = await primaryUnit(user.id);
  if (!unit) redirect("/onboarding");
  return { user, unit };
}

function unitInput(form: FormData): UnitInput {
  const requested = field(form, "jurisdiction");
  const street = must(form, "street", "Street address");
  const city = must(form, "city", "City");
  const postalCode = field(form, "postalCode");
  const region = field(form, "region");
  const detected = detectPlace({ address: street, city, postalCode, region });
  const jurisdiction = requested && requested !== "unsure" && isAllowedJurisdiction(requested) ? requested : detected.jurisdiction;
  if (!isAllowedJurisdiction(jurisdiction)) throw new Error("Choose a jurisdiction.");
  return {
    street,
    unitNumber: field(form, "unitNumber"),
    city,
    postalCode,
    region,
    jurisdiction,
    jurisdictionConfirmed: form.get("jurisdictionConfirmed") === "on",
    rsoStatus: (field(form, "rsoStatus") || "unsure") as RsoStatus,
    rstpoTier: (field(form, "rstpoTier") || "unsure") as RstpoTier,
    landlordName: must(form, "landlordName", "Landlord name"),
    landlordEmail: emailValue(must(form, "landlordEmail", "Landlord email")),
    landlordPhone: field(form, "landlordPhone"),
    rentCents: centsField(form, "rent"),
    depositCents: centsField(form, "deposit"),
    moveInDate: dateField(form, "moveInDate"),
  };
}

export async function requestMagicLink(form: FormData) {
  const email = emailValue(must(form, "email", "Email"));
  try {
    const { token, supabase } = await createMagicLink(email);
    if (supabase && !token) redirect("/login?sent=1");
    const link = `${appUrl()}/auth/verify?token=${token}`;
    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
      await sendTenantEmail(email, "Your Rent Right sign-in link", `Sign in: ${link}\nThis link expires in 30 minutes.`);
      redirect("/login?sent=1");
    }
    redirect(`/login?dev=${encodeURIComponent(link)}`);
  } catch (error) {
    fail("/login", error);
  }
}

export async function openSample() {
  try {
    const id = await startSampleTenancy();
    await setSessionCookie(id);
  } catch (error) {
    fail("/login", error);
  }
  redirect("/home");
}

export async function signOut() {
  await clearSessionCookie();
  redirect("/");
}

export async function saveOnboarding(form: FormData) {
  const user = await actor();
  try {
    const input = unitInput(form);
    if (field(form, "name")) await updateUser(user.id, { name: field(form, "name") });
    const existing = await primaryUnit(user.id);
    if (existing) await updateUnit(user.id, existing.id, input);
    else await createUnit(user.id, input);
  } catch (error) {
    fail("/onboarding", error);
  }
  redirect("/home");
}

export async function saveSettings(form: FormData) {
  const { user, unit } = await homeUnit();
  try {
    const locale = field(form, "locale") === "es" ? "es" : "en";
    await updateUser(user.id, {
      name: field(form, "name"),
      phone: field(form, "phone"),
      locale,
      lowBandwidth: form.get("lowBandwidth") === "on",
    });
    await writeLocale(locale);
    if (unit.role === "owner") await updateUnit(user.id, unit.id, unitInput(form));
  } catch (error) {
    fail("/settings", error);
  }
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function setLanguage(form: FormData) {
  const locale: Locale = field(form, "locale") === "es" ? "es" : "en";
  await writeLocale(locale);
  const user = await currentUser();
  if (user) await updateUser(user.id, { locale });
  redirect(field(form, "next") || "/home");
}

export async function removeAccount(form: FormData) {
  const user = await actor();
  if (field(form, "confirm") !== "DELETE") fail("/settings", new Error("Type DELETE to confirm."));
  if (user.email === DEMO_EMAIL) {
    await deleteUserAccount(user.id);
    await clearSessionCookie();
    redirect("/");
  }
  await deleteUserAccount(user.id);
  await clearSessionCookie();
  redirect("/");
}

export async function createLog(form: FormData) {
  const { user, unit } = await homeUnit();
  try {
    const photo = fileOf(form, "photo");
    const photoFileId = photo ? await saveFile(user.id, unit.id, photo.name, photo.type || "application/octet-stream", Buffer.from(await photo.arrayBuffer())) : null;
    await recordLog({
      user,
      unit,
      type: must(form, "type", "Type"),
      noticeKind: field(form, "noticeKind") || null,
      severity: field(form, "severity") || null,
      room: field(form, "room") || null,
      description: must(form, "description", "Description"),
      eventDate: dateField(form, "eventDate") || new Date().toISOString().slice(0, 10),
      photoFileId,
      sendEmail: form.get("sendEmail") === "on",
      subject: field(form, "subject"),
      entryAt: field(form, "entryAt") || null,
      noticeAt: field(form, "noticeAt") || null,
    });
  } catch (error) {
    fail("/log/new", error);
  }
  redirect("/log");
}

export async function reviewUpload(form: FormData) {
  const { user, unit } = await homeUnit();
  try {
    const pasted = field(form, "text");
    const file = fileOf(form, "file");
    let text = pasted;
    let filename = "pasted.txt";
    if (file) {
      filename = file.name;
      const extracted = await extractPdfOrText(Buffer.from(await file.arrayBuffer()), file.type || "", file.name);
      await saveFile(user.id, unit.id, file.name, file.type || "application/octet-stream", Buffer.from(await file.arrayBuffer()));
      text = [extracted, pasted].filter(Boolean).join("\n\n");
    }
    await runLeaseReview(user, unit, text, filename);
  } catch (error) {
    fail("/lease", error);
  }
  redirect("/lease");
}

export async function reviewSample() {
  const { user, unit } = await homeUnit();
  try {
    await runLeaseReview(user, unit, sampleLeaseText(), "sample-lease.txt");
  } catch (error) {
    fail("/lease", error);
  }
  redirect("/lease");
}

export async function sendFeedback(form: FormData) {
  const user = await actor();
  try {
    await addFeedback(user.id, must(form, "reviewId", "Review"), must(form, "note", "Note"));
  } catch (error) {
    fail("/lease", error);
  }
  redirect("/lease?feedback=1");
}

export async function saveDepositForm(form: FormData) {
  const { user, unit } = await homeUnit();
  try {
    await saveDepositAndDeadline(user, unit, {
      amountCents: centsField(form, "amount"),
      receivedDate: dateField(form, "receivedDate"),
      moveOutDate: dateField(form, "moveOutDate"),
      forwardingAddress: field(form, "forwardingAddress"),
      landlordDeductions: field(form, "landlordDeductions"),
      tenantNotes: field(form, "tenantNotes"),
    });
  } catch (error) {
    fail("/deposit", error);
  }
  redirect("/deposit");
}

export async function prepareDemand(form: FormData): Promise<void> {
  const { user, unit } = await homeUnit();
  const { getDeposit, unitAddress } = await import("@/lib/db");
  const deposit = await getDeposit(user.id, unit.id);
  try {
    demandLetter({
      tenantName: user.name || user.email,
      unitAddress: unitAddress(unit),
      landlordName: unit.landlordName,
      landlordEmail: unit.landlordEmail,
      depositCents: deposit?.amount_cents || centsField(form, "amount") || 0,
      moveOutDate: deposit?.move_out_date || "",
      dueDate: field(form, "dueDate"),
      forwardingAddress: field(form, "forwardingAddress") || deposit?.forwarding_address || "",
      deductionNotes: field(form, "landlordDeductions"),
      disputeNotes: must(form, "disputeNotes", "Your explanation"),
      letterDate: new Date().toISOString().slice(0, 10),
    });
  } catch (error) {
    fail("/deposit", error);
  }
  redirect(`/api/letters/demand?notes=${encodeURIComponent(field(form, "disputeNotes"))}`);
}

export async function addPayment(form: FormData) {
  const { user, unit } = await homeUnit();
  try {
    const receipt = fileOf(form, "receipt");
    const receiptFileId = receipt
      ? await saveFile(user.id, unit.id, receipt.name, receipt.type || "image/jpeg", Buffer.from(await receipt.arrayBuffer()))
      : null;
    await addLedger(user.id, unit.id, {
      amountCents: centsField(form, "amount") || 0,
      periodStart: dateField(form, "periodStart"),
      periodEnd: dateField(form, "periodEnd"),
      paidOn: dateField(form, "paidOn") || new Date().toISOString().slice(0, 10),
      method: field(form, "method") || "other",
      notes: field(form, "notes"),
      receiptFileId,
    });
  } catch (error) {
    fail("/ledger", error);
  }
  redirect("/ledger");
}

export async function voidPayment(form: FormData) {
  const user = await actor();
  try {
    await voidLedger(user.id, must(form, "id", "Payment"));
  } catch (error) {
    fail("/ledger", error);
  }
  redirect("/ledger");
}

export async function checkIncrease(form: FormData) {
  const { user, unit } = await homeUnit();
  try {
    const lowest = centsField(form, "lowest");
    const proposed = centsField(form, "proposed");
    if (!lowest || !proposed) throw new Error("Enter the current rent and the proposed rent.");
    const jurisdiction = (field(form, "jurisdiction") || unit.jurisdiction) as Jurisdiction;
    const place = detectPlace({ address: unit.street, city: unit.city, postalCode: unit.postalCode, region: unit.region });
    const statewide = jurisdiction === "ca" || jurisdiction === "other_ca";
    const result = checkRentIncrease({
      jurisdiction,
      rsoStatus: (field(form, "rsoStatus") || "unsure") as RsoStatus,
      rstpoTier: (field(form, "rstpoTier") || "unsure") as RstpoTier,
      countyArea: COUNTY_AREAS.find((area) => area === field(form, "countyArea")) || (statewide ? place.area ?? undefined : undefined),
      localOrdinanceName: statewide ? place.localOrdinance?.name ?? null : null,
      lowestRentCents: lowest,
      proposedRentCents: proposed,
      noticeDate: dateField(form, "noticeDate") || new Date().toISOString().slice(0, 10),
      effectiveDate: must(form, "effectiveDate", "Effective date"),
      lastIncreaseDate: dateField(form, "lastIncreaseDate"),
      claimsExemption: form.get("claimsExemption") === "on",
    });
    await saveRentCheck(user.id, unit.id, Object.fromEntries(form.entries()), result);
  } catch (error) {
    fail("/increase", error);
  }
  redirect("/increase");
}

export async function suggestPlace(form: FormData) {
  const address = must(form, "address", "Address");
  try {
    const found = await lookupJurisdiction(address);
    redirect(`/increase?suggestion=${encodeURIComponent(found.suggestion)}&note=${encodeURIComponent(found.note)}`);
  } catch (error) {
    fail("/increase", error);
  }
}

export async function ask(form: FormData) {
  const { user, unit } = await homeUnit();
  try {
    await askAssistant(user, unit, must(form, "question", "Question"), user.locale);
  } catch (error) {
    fail("/assistant", error);
  }
  redirect("/assistant");
}

export async function saveCondition(form: FormData) {
  const { user, unit } = await homeUnit();
  try {
    const rooms = ["Living room", "Kitchen", "Bedroom", "Bathroom", "Other / exterior"].map((room) => ({
      room,
      condition: field(form, `condition-${room}`) || "good",
      issues: form.getAll(`issues-${room}`).map(String),
      notes: field(form, `notes-${room}`),
      photoFileId: null as string | null,
    }));
    for (const room of rooms) {
      const photo = fileOf(form, `photo-${room.room}`);
      if (photo) {
        room.photoFileId = await saveFile(user.id, unit.id, photo.name, photo.type || "image/jpeg", Buffer.from(await photo.arrayBuffer()));
      }
    }
    await insertCondition(user.id, unit.id, field(form, "kind") === "move_out" ? "move_out" : "move_in", rooms, field(form, "notes"));
  } catch (error) {
    fail("/condition/new", error);
  }
  redirect("/condition");
}

export async function toggleDeadline(form: FormData) {
  const user = await actor();
  try {
    await setDeadlineStatus(user.id, must(form, "id", "Deadline"), field(form, "status") === "done" ? "done" : "open");
  } catch (error) {
    fail("/deadlines", error);
  }
  redirect("/deadlines");
}

export async function inviteRoommate() {
  const { user, unit } = await homeUnit();
  try {
    const token = await createInvite(user.id, unit.id);
    redirect(`/settings?invite=${encodeURIComponent(`${appUrl()}/invite/${token}`)}`);
  } catch (error) {
    fail("/settings", error);
  }
}

export async function markMailed(form: FormData) {
  const { user, unit } = await homeUnit();
  try {
    const receipt = fileOf(form, "receipt");
    const receiptFileId = receipt
      ? await saveFile(user.id, unit.id, receipt.name, receipt.type || "image/jpeg", Buffer.from(await receipt.arrayBuffer()))
      : null;
    await logMailed(user.id, unit.id, field(form, "logId") || null, receiptFileId);
  } catch (error) {
    fail("/letters", error);
  }
  redirect("/letters?logged=1");
}

export async function landlordReply(form: FormData) {
  adoptActor(null);
  const token = must(form, "token", "Link");
  const message = await messageByToken(token);
  if (!message) fail(`/r/${token}`, new Error("This link is not valid."));
  const action = field(form, "action");
  const note = field(form, "note");
  try {
    if (action === "block") {
      await blockLandlord(message.unitId, note || "Blocked from the response link.");
    } else if (action === "abuse") {
      await reportAbuse(message.unitId, "landlord-link", note || "Abuse report from the response link.");
    } else if (["acknowledge", "schedule", "fixed", "dispute"].includes(action)) {
      await addLandlordResponse(message.unitId, message.id, action, note);
      const unit = await peekUnit(message.unitId);
      if (unit) {
        await insertLog({
          unitId: unit.id,
          userId: unit.createdBy,
          type: "conversation",
          description: `Landlord used the response link: ${action}.${note ? ` Note: ${note}` : ""}`,
          eventDate: new Date().toISOString().slice(0, 10),
        });
      }
    } else {
      throw new Error("Choose a response.");
    }
  } catch (error) {
    fail(`/r/${token}`, error);
  }
  redirect(`/r/${token}?done=1`);
}

export async function ackReport(form: FormData) {
  adoptActor(null);
  const token = must(form, "token", "Link");
  try {
    await acknowledgeCondition(token, must(form, "name", "Name"));
  } catch (error) {
    fail(`/ack/${token}`, error);
  }
  redirect(`/ack/${token}?done=1`);
}

export async function resendLogEmail(form: FormData) {
  const { user, unit } = await homeUnit();
  try {
    const log = await getLog(user.id, must(form, "logId", "Log"));
    await emailLandlord({
      user,
      unit,
      logEntryId: log.id,
      subject: field(form, "subject") || `Message about ${unit.street}`,
      tenantText: log.description,
    });
  } catch (error) {
    fail("/log", error);
  }
  redirect("/messages");
}
