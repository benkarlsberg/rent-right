import {
  addAssistantMessage,
  addLedger,
  addNotification,
  createNamedUser,
  createUnit,
  deleteUserAccount,
  getUserByEmail,
  insertCondition,
  insertDeadline,
  insertLog,
  insertMessage,
  saveRentCheck,
} from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import { serializeCard } from "@/lib/chat-card";
import { addDays, todayISO } from "@/lib/rules/dates";
import { checkRentIncrease, depositReturnDeadline, repairReminder, retaliationWindow, type RepairSeverity } from "@/lib/rules/engine";
import { dueLine, rentHeadline } from "@/lib/phone";
import { percentLabel } from "@/lib/format";
import { appUrl, relayAddress } from "@/lib/text";
import { landlordMessageBody } from "@/lib/email";
import { hasUserActor, withActor } from "@/lib/pg";
import { runLeaseReview, sampleLeaseText, saveDepositAndDeadline } from "@/lib/workflow";

export const DEMO_EMAIL = "demo@rentright.local";

export async function startSampleTenancy(): Promise<string> {
  if (hasUserActor()) return withActor(null, () => startSampleTenancy());
  const existing = await getUserByEmail(DEMO_EMAIL);
  if (existing) await deleteUserAccount(existing.id);
  const user = await createNamedUser(DEMO_EMAIL, "Maya Chen", "en");
  const today = todayISO();
  const unit = await createUnit(user.id, {
    street: "1842 N Echo Park Ave",
    unitNumber: "3",
    city: "Los Angeles",
    postalCode: "90026",
    region: "Los Angeles County",
    jurisdiction: "city_la",
    jurisdictionConfirmed: true,
    rsoStatus: "covered",
    rstpoTier: "unsure",
    landlordName: "Elena Vasquez",
    landlordEmail: "elena.vasquez@example.com",
    landlordPhone: "",
    rentCents: 215_000,
    depositCents: 215_000,
    moveInDate: "2024-08-01",
  });

  const oldDate = addDays(today, -40);
  const oldRepair = await insertLog({
    unitId: unit.id,
    userId: user.id,
    type: "repair",
    severity: "other",
    room: "Bathroom",
    description: "The bathroom exhaust fan stopped working and the ceiling has a damp spot. Please repair both.",
    eventDate: oldDate,
    createdAt: `${oldDate}T18:00:00.000Z`,
  });

  const leakDate = addDays(today, -2);
  const leak = await insertLog({
    unitId: unit.id,
    userId: user.id,
    type: "repair",
    severity: "leak",
    room: "Kitchen",
    description: "Water is dripping from the pipe under the kitchen sink. I put a bowl under it. Please send someone to fix the leak.",
    eventDate: leakDate,
    createdAt: `${leakDate}T18:00:00.000Z`,
  });

  const noticeDate = addDays(today, -1);
  const window = retaliationWindow(oldDate, noticeDate);
  await insertLog({
    unitId: unit.id,
    userId: user.id,
    type: "notice_received",
    noticeKind: "rent_increase",
    description: "I received a notice raising rent from $2,150 to $2,257.50 effective next month. I am logging the notice only.",
    eventDate: noticeDate,
    createdAt: `${noticeDate}T18:00:00.000Z`,
    flags: { retaliation: { ...window, relatedEntryId: oldRepair.id } },
  });

  for (const item of [
    { date: oldDate, severity: "other" as RepairSeverity, source: oldRepair.id },
    { date: leakDate, severity: "leak" as RepairSeverity, source: leak.id },
  ]) {
    const reminder = repairReminder(item.date, item.severity);
    await insertDeadline({
      unitId: unit.id,
      ruleId: reminder.ruleId,
      kind: "repair",
      anchorDate: item.date,
      dueDate: reminder.dueDate,
      explanation: reminder.explanation,
      explanationEs: reminder.explanationEs,
      computation: reminder.computation,
      sourceId: item.source,
      status: "open",
      unsure: reminder.unsure,
    });
  }

  const token = randomToken();
  const responseUrl = `${appUrl()}/r/${token}`;
  await insertMessage({
    unitId: unit.id,
    userId: user.id,
    logEntryId: leak.id,
    direction: "outbound",
    fromEmail: relayAddress(unit.relayLocal),
    toEmail: unit.landlordEmail,
    ccEmail: user.email,
    subject: "Kitchen sink leak",
    body: landlordMessageBody(leak.description, responseUrl),
    deliveryStatus: "delivered",
    deliveryDetail: "Sample tenancy. Marked delivered so the thread has a timestamp. No email was sent.",
    responseToken: token,
    createdAt: `${leakDate}T18:05:00.000Z`,
  });
  await insertMessage({
    unitId: unit.id,
    userId: null,
    logEntryId: leak.id,
    direction: "inbound",
    fromEmail: unit.landlordEmail,
    toEmail: relayAddress(unit.relayLocal),
    ccEmail: user.email,
    subject: "Re: Kitchen sink leak",
    body: "Thanks for the note. I will try to send someone next week.",
    deliveryStatus: "received",
    deliveryDetail: "Inbound reply captured by the relay.",
    createdAt: `${addDays(today, -1)}T16:00:00.000Z`,
  });

  await saveDepositAndDeadline(user, unit, {
    amountCents: 215_000,
    receivedDate: "2024-08-01",
    moveOutDate: addDays(today, -4),
    forwardingAddress: "900 Sunset Blvd, Los Angeles, CA 90012",
    landlordDeductions: "",
    tenantNotes: "",
  });

  const increase = checkRentIncrease({
    jurisdiction: "city_la",
    rsoStatus: "covered",
    rstpoTier: "unsure",
    lowestRentCents: 215_000,
    proposedRentCents: 225_750,
    noticeDate: addDays(today, -20),
    effectiveDate: addDays(today, 40),
    lastIncreaseDate: "2025-08-01",
    claimsExemption: false,
  });
  await saveRentCheck(user.id, unit.id, { sample: true }, increase);

  for (const paid of [addDays(today, -70), addDays(today, -40), addDays(today, -10)]) {
    await addLedger(user.id, unit.id, {
      amountCents: 215_000,
      periodStart: paid,
      periodEnd: addDays(paid, 30),
      paidOn: paid,
      method: "transfer",
      notes: "Logged by the tenant.",
      receiptFileId: null,
    });
  }

  await insertCondition(user.id, unit.id, "move_in", [
    { room: "Kitchen", condition: "fair", issues: ["fixtures"], notes: "Slow drain. Photographed the cabinet.", photoFileId: null },
    { room: "Bathroom", condition: "good", issues: [], notes: "Clean at move-in.", photoFileId: null },
    { room: "Living room", condition: "good", issues: [], notes: "Small scuff on the west wall.", photoFileId: null },
  ], "Move-in notes written by the tenant.");

  await runLeaseReview(user, unit, sampleLeaseText(), "sample-lease.txt");

  const stamp = Date.now();
  const leakReminder = repairReminder(leakDate, "leak");
  const moveOut = addDays(today, -4);
  const depositDue = depositReturnDeadline(moveOut);
  const depositLine = dueLine(depositDue.dueDate, today, "en");
  const samples: { role: "user" | "assistant"; content: string; ruleId: string | null; unsure: boolean }[] = [
    { role: "user", content: "My sink is leaking", ruleId: null, unsure: false },
    {
      role: "assistant",
      content: serializeCard({
        headline: "Repair logged",
        status: "Sent",
        action: { id: "open-landlord", label: "Open landlord" },
        detail: `${leakReminder.explanation}\n\n${leakReminder.computation}\n\nThis sample already has the note in the landlord thread. A new repair stays unsent until you tap Send to landlord.`,
        ruleId: leakReminder.ruleId,
      }),
      ruleId: leakReminder.ruleId,
      unsure: false,
    },
    { role: "user", content: "My landlord raised rent to $2,257.50", ruleId: null, unsure: false },
    {
      role: "assistant",
      content: serializeCard({
        headline: rentHeadline(increase.applicable.status, "en"),
        status: increase.applicable.ppm != null ? percentLabel(increase.applicable.ppm) : "No single cap",
        action: null,
        detail: [increase.applicable.reason, increase.notice.computation, increase.jurisdictionNote].filter(Boolean).join("\n\n"),
        ruleId: increase.applicable.ruleId,
      }),
      ruleId: increase.applicable.ruleId,
      unsure: increase.applicable.status === "unsure",
    },
    { role: "user", content: "I moved out, where's my deposit?", ruleId: null, unsure: false },
    {
      role: "assistant",
      content: serializeCard({
        headline: "Deposit",
        status: `${depositLine.subtitle} · ${depositLine.title}`,
        action: { id: "letter", label: "Draft a letter" },
        detail: `${depositDue.explanation}\n\nThe letter is not emailed. You would mail or send it yourself.`,
        ruleId: depositDue.ruleId,
      }),
      ruleId: depositDue.ruleId,
      unsure: false,
    },
  ];
  for (const [index, item] of samples.entries()) {
    await addAssistantMessage(user.id, unit.id, item.role, {
      locale: "en",
      content: item.content,
      ruleIds: item.ruleId ? [item.ruleId] : [],
      unsure: item.unsure,
      createdAt: new Date(stamp + index).toISOString(),
    });
  }

  await addNotification(
    user.id,
    "Repair reminder",
    "The kitchen leak reminder is coming up. The date was computed from the day you logged the request.",
    "/deadlines",
  );
  return user.id;
}
