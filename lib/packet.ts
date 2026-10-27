import { formatAddressLines } from "@/lib/address-format";
import { DISCLAIMER_EN } from "@/lib/disclaimer";
import { formatDate, formatMoney, formatTimestamp } from "@/lib/format";
import type { Unit, User } from "@/lib/db";
import { packByJurisdiction } from "@/lib/rules/cities";
import { relayDomain } from "@/lib/text";

const SMALL_CLAIMS_URL = "https://selfhelp.courts.ca.gov/small-claims";

const REMINDER_NOTE =
  "A follow-up date is the tenant's own reminder, counted as 7 days after the request was stored. It is not a legal deadline, and it does not mean the landlord had to answer by that date.";

export type PacketImage = { id: string; bytes: Uint8Array; mime: string; caption?: string };

export type PacketLog = {
  id?: string;
  versionGroup?: string;
  version?: number;
  type: string;
  description: string;
  eventDate: string;
  createdAt: string;
  contentHash?: string;
  prevHash?: string;
  status?: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
  photoFileId?: string | null;
  flags?: Record<string, unknown> | null;
};

export type PacketMessage = {
  createdAt: string;
  direction: string;
  subject: string;
  body: string;
  deliveryStatus: string;
  logEntryId?: string | null;
  fromEmail?: string;
  toEmail?: string;
  ccEmail?: string | null;
  deliveryDetail?: string | null;
  openIndicative?: boolean;
};

export type PacketModel = {
  title: string;
  prepared: string;
  about: string;
  tenant: string;
  property: [string, string];
  place: string;
  landlord: string;
  rent: string;
  summary: string[];
  reminderNote: string | null;
  issues: {
    title: string;
    status: string;
    reported: string;
    reminder: string | null;
    description: string;
    updates: string[];
    messages: { when: string; direction: string; subject: string; excerpt: string }[];
    images: PacketImage[];
  }[];
  communications: { when: string; direction: string; subject: string; excerpt: string }[];
  conditions: { title: string; when: string; images: PacketImage[] }[];
  looseImages: PacketImage[];
  ledger: string[];
  deposit: string | null;
  leaseNotes: string[];
  otherNotes: string[];
  verification: { label: string; code: string }[];
  closing: string;
  disclaimer: string;
};

function removed(log: PacketLog): boolean {
  return Boolean(log.flags && log.flags.removed === true);
}

function codeOf(hash: string | null | undefined): string {
  const hex = String(hash || "").replace(/[^a-f0-9]/gi, "");
  return (hex || "none").slice(0, 12);
}

function excerpt(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= 160) return clean;
  return `${clean.slice(0, 157).trim()}...`;
}

function when(iso: string): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatDate(iso, "en");
  return formatTimestamp(iso, "en");
}

export function jurisdictionLabel(code: string): string {
  if (!code || code === "ca" || code === "other_ca") return "California";
  if (code === "unsure") return "California, city not confirmed";
  const pack = packByJurisdiction(code);
  if (!pack) return "California";
  if (pack.match === "unincorporated" || pack.name.toLowerCase().startsWith("unincorporated")) return pack.name;
  if (pack.name.toLowerCase().startsWith("city of")) return pack.name;
  return `City of ${pack.name}`;
}

function tenantLine(user: User): string {
  const name = (user.name || "").trim();
  const email = user.email || "";
  const hidden = /privaterelay\.appleid\.com$/i.test(email) || email.endsWith(`@${relayDomain()}`);
  if (name) return name;
  if (email && !hidden) return email;
  return "Tenant";
}

function statusLabel(log: PacketLog): string {
  if (removed(log)) return "Removed by tenant";
  if (log.status === "resolved" && log.resolvedAt) return `Resolved on ${when(log.resolvedAt)}`;
  if (log.status === "resolved") return "Resolved";
  if (log.status === "pending_confirm") return "Landlord says fixed";
  return "Open";
}

function visibleMessage(message: PacketMessage): boolean {
  return message.deliveryStatus !== "draft" && message.deliveryStatus !== "discarded";
}

export function buildPacket(input: {
  user: User;
  unit: Unit;
  logs: PacketLog[];
  messages: PacketMessage[];
  deadlines: { ruleId?: string; kind: string; dueDate: string | null; computation?: string; explanation?: string; status: string; tenantReminderOn?: string | null; anchorDate?: string | null; createdAt?: string; sourceId?: string | null }[];
  ledger: { paidOn: string; amountCents: number; method: string; notes: string; voidedAt: string | null }[];
  deposit: { amountCents: number | null; moveOutDate: string | null; forwardingAddress: string } | null;
  conditions: { id?: string; kind: string; createdAt: string; contentHash?: string | null; acknowledgedAt?: string | null; rooms?: { room?: string; notes?: string; photoFileId?: string | null }[] }[];
  leaseNotes?: { quote: string; ruleId?: string | null; filename?: string | null }[];
  images?: PacketImage[];
  preparedAt?: string;
}): PacketModel {
  const images = new Map((input.images || []).map((image) => [image.id, image]));
  const logs = input.logs.filter((log) => log.description || log.type);
  const repairs = logs.filter((log) => log.type === "repair");
  const groups = new Map<string, PacketLog[]>();
  for (const log of repairs) {
    const key = log.versionGroup || log.id || log.createdAt;
    const list = groups.get(key) || [];
    list.push(log);
    groups.set(key, list);
  }
  const issues = [...groups.values()].map((versions) => {
    const latest = [...versions].sort((a, b) => (a.version || 1) - (b.version || 1) || a.createdAt.localeCompare(b.createdAt)).at(-1)!;
    const ids = new Set(versions.map((log) => log.id).filter(Boolean) as string[]);
    const reminder = input.deadlines.find((item) => item.kind === "repair" && item.status === "open" && item.sourceId && ids.has(item.sourceId) && (item.tenantReminderOn || item.dueDate));
    const messages = input.messages.filter((message) => visibleMessage(message) && message.logEntryId && ids.has(message.logEntryId));
    const photoIds = [
      ...versions.map((log) => log.photoFileId).filter(Boolean),
    ] as string[];
    const updates = versions
      .filter((log) => log.photoFileId && !images.has(log.photoFileId))
      .map(() => "A photo is stored with this note.");
    return {
      title: latest.description.replace(/\s+/g, " ").trim().slice(0, 90) || "Repair request",
      status: statusLabel(latest),
      reported: when(latest.eventDate || latest.createdAt),
      reminder: reminder ? when(reminder.tenantReminderOn || reminder.dueDate || "") : null,
      description: latest.description,
      updates,
      messages: messages.map((message) => ({
        when: when(message.createdAt),
        direction: message.direction === "inbound" ? "Received" : "Sent",
        subject: message.subject,
        excerpt: excerpt(message.body),
      })),
      images: photoIds.map((id) => images.get(id)).filter((image): image is PacketImage => Boolean(image)),
      sort: latest.eventDate || latest.createdAt,
      ids,
      hash: latest.contentHash || "",
    };
  }).sort((a, b) => a.sort.localeCompare(b.sort));

  const open = issues.filter((issue) => issue.status === "Open" || issue.status === "Landlord says fixed").length;
  const resolved = issues.filter((issue) => issue.status.startsWith("Resolved")).length;
  const gone = issues.filter((issue) => issue.status === "Removed by tenant").length;
  const mail = input.messages.filter(visibleMessage);
  const sent = mail.filter((message) => message.direction !== "inbound").length;
  const received = mail.filter((message) => message.direction === "inbound").length;
  const keyDates = input.deadlines
    .filter((item) => item.status === "open" && (item.dueDate || item.tenantReminderOn))
    .map((item) => `${item.kind === "deposit" ? "Deposit accounting" : "Follow-up"} ${when(item.tenantReminderOn || item.dueDate || "")}`);
  const summary = [
    `Open issues: ${open}`,
    `Resolved issues: ${resolved}`,
    `Removed by tenant: ${gone}`,
    `Messages sent: ${sent}`,
    `Messages received: ${received}`,
    keyDates.length ? `Key dates: ${keyDates.join("; ")}` : "",
  ].filter(Boolean);

  const used = new Set(issues.flatMap((issue) => [...issue.ids]));
  const otherNotes = logs
    .filter((log) => log.type !== "repair" && !(log.id && used.has(log.id)) && log.description)
    .map((log) => `${when(log.createdAt || log.eventDate)} — ${log.description}`);

  const lines = formatAddressLines({
    street: input.unit.street,
    unit: input.unit.unitNumber,
    city: input.unit.city,
    region: input.unit.region,
    postalCode: input.unit.postalCode,
  });

  const conditions = input.conditions.map((report) => {
    const ids = (report.rooms || []).map((room) => room.photoFileId).filter(Boolean) as string[];
    const shown = ids.map((id) => images.get(id)).filter((image): image is PacketImage => Boolean(image));
    return {
      title: report.kind === "move_out" ? "Move-out" : "Move-in",
      when: when(report.createdAt),
      images: shown,
      hash: report.contentHash || "",
      count: Math.max(shown.length, ids.length),
    };
  }).filter((report) => report.count > 0);

  const looseImages = (input.images || []).filter((image) => {
    const onIssue = issues.some((issue) => issue.images.some((item) => item.id === image.id));
    const onReport = conditions.some((report) => report.images.some((item) => item.id === image.id));
    return !onIssue && !onReport;
  });

  const ledger = input.ledger.filter((row) => !row.voidedAt).map((row) => (
    `${when(row.paidOn)} — ${formatMoney(row.amountCents, "en")} — ${row.method}${row.notes ? ` — ${row.notes}` : ""}`
  ));

  const deposit = input.deposit && (input.deposit.amountCents != null || input.deposit.moveOutDate || input.deposit.forwardingAddress)
    ? `Amount ${input.deposit.amountCents != null ? formatMoney(input.deposit.amountCents, "en") : "not entered"}. Move-out ${input.deposit.moveOutDate ? when(input.deposit.moveOutDate) : "not entered"}. Forwarding address ${input.deposit.forwardingAddress || "not entered"}.`
    : null;

  const leaseNotes = (input.leaseNotes || []).filter((note) => note.quote).map((note) => (
    `${note.filename ? `${note.filename}: ` : ""}${note.quote}`
  ));

  const verification = [
    ...issues.filter((issue) => issue.hash).map((issue) => ({ label: issue.title, code: codeOf(issue.hash) })),
    ...conditions.filter((report) => report.hash).map((report) => ({ label: `${report.title} ${report.when}`, code: codeOf(report.hash) })),
  ];

  return {
    title: "Evidence packet",
    prepared: when(input.preparedAt || new Date().toISOString()),
    about: "A record of communications and photos stored in Rent Right. It is not legal advice and it is not a court filing.",
    tenant: tenantLine(input.user),
    property: lines,
    place: jurisdictionLabel(input.unit.jurisdiction),
    landlord: input.unit.landlordName || "Not entered",
    rent: input.unit.rentCents != null ? formatMoney(input.unit.rentCents, "en") : "Not entered",
    summary,
    reminderNote: issues.some((issue) => issue.reminder) || keyDates.length ? REMINDER_NOTE : null,
    issues: issues.map(({ title, status, reported, reminder, description, updates, messages, images: issueImages }) => ({
      title, status, reported, reminder, description, updates, messages, images: issueImages,
    })),
    communications: mail.map((message) => ({
      when: when(message.createdAt),
      direction: message.direction === "inbound" ? "Received" : "Sent",
      subject: message.subject,
      excerpt: excerpt(message.body),
    })),
    conditions: conditions.map(({ title, when: at, images: reportImages }) => ({ title, when: at, images: reportImages })),
    looseImages,
    ledger,
    deposit,
    leaseNotes,
    otherNotes,
    verification,
    closing: `Small claims is a self-help option. Rent Right does not file a case and does not give legal advice. ${SMALL_CLAIMS_URL}`,
    disclaimer: DISCLAIMER_EN,
  };
}

export function packetLines(input: Parameters<typeof buildPacket>[0]): string[] {
  const model = buildPacket(input);
  const lines = [
    model.title,
    model.about,
    `Prepared ${model.prepared}`,
    `Tenant ${model.tenant}`,
    ...model.property.filter(Boolean),
    model.place,
    `Landlord ${model.landlord}`,
    `Monthly rent ${model.rent}`,
    ...model.summary,
    model.reminderNote || "",
    ...model.issues.flatMap((issue) => [
      issue.title,
      issue.status,
      `Reported ${issue.reported}`,
      issue.reminder ? `Reminder ${issue.reminder}` : "",
      issue.description,
      ...issue.updates,
      ...issue.messages.map((message) => `${message.direction} ${message.when} ${message.subject} ${message.excerpt}`),
    ]),
    ...model.communications.map((row) => `${row.direction} ${row.when} ${row.subject} ${row.excerpt}`),
    ...model.conditions.map((report) => `${report.title} ${report.when}`),
    ...model.ledger,
    model.deposit || "",
    ...model.leaseNotes,
    ...model.otherNotes,
    ...model.verification.map((row) => `${row.label} ${row.code}`),
    model.closing,
    model.disclaimer,
  ];
  return lines.filter((line) => line && line.trim());
}
