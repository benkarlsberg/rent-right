import { formatAddressLines } from "@/lib/address-format";
import { DISCLAIMER_EN } from "@/lib/disclaimer";
import { formatMoney, formatTimestamp } from "@/lib/format";
import type { Unit, User } from "@/lib/db";
import { relayAddress } from "@/lib/text";

const SMALL_CLAIMS_URL = "https://selfhelp.courts.ca.gov/small-claims";

export function packetLines(input: {
  user: User;
  unit: Unit;
  logs: { eventDate: string; createdAt: string; type: string; description: string; contentHash: string; prevHash: string; version: number; photoFileId?: string | null; status?: string; resolvedAt?: string | null; resolvedBy?: string | null; resolutionNote?: string | null }[];
  messages: { createdAt: string; direction: string; fromEmail: string; toEmail: string; ccEmail: string | null; subject: string; body: string; deliveryStatus: string; deliveryDetail: string | null; openIndicative: boolean }[];
  deadlines: { ruleId: string; kind: string; dueDate: string | null; computation: string; explanation: string; status: string; tenantReminderOn?: string | null; anchorDate?: string | null; createdAt?: string }[];
  ledger: { paidOn: string; amountCents: number; method: string; notes: string; voidedAt: string | null }[];
  deposit: { amountCents: number | null; moveOutDate: string | null; forwardingAddress: string } | null;
  conditions: { kind: string; createdAt: string; contentHash: string | null; acknowledgedAt: string | null }[];
  leaseNotes?: { quote: string; ruleId: string | null; filename?: string | null }[];
}): string[] {
  const lines: string[] = [
    "# What this packet is",
    "This is a record of communications stored in Rent Right. It is not legal advice and it is not a court filing.",
    `Prepared ${formatTimestamp(new Date().toISOString(), "en")} for ${input.user.name || input.user.email}.`,
    "# Property the tenant entered",
    ...formatAddressLines({
      street: input.unit.street,
      unit: input.unit.unitNumber,
      city: input.unit.city,
      region: input.unit.region,
      postalCode: input.unit.postalCode,
    }).filter(Boolean),
    `Jurisdiction selected by the tenant: ${input.unit.jurisdiction}. Confirmed by tenant: ${input.unit.jurisdictionConfirmed ? "yes" : "no"}.`,
    `Landlord name entered: ${input.unit.landlordName || "(blank)"}. Landlord email entered: ${input.unit.landlordEmail || "(blank)"}.`,
    `Relay address: ${relayAddress(input.unit.relayLocal)}. Monthly rent entered: ${input.unit.rentCents != null ? formatMoney(input.unit.rentCents, "en") : "(blank)"}.`,
    "# Issue timeline",
  ];

  type Event = { at: string; lines: string[] };
  const events: Event[] = [];
  for (const entry of input.logs) {
    const photo = entry.photoFileId ? ["A photo is stored with this note."] : [];
    events.push({
      at: entry.createdAt || entry.eventDate,
      lines: [
        `${entry.eventDate} | ${entry.type} | version ${entry.version} | stored ${formatTimestamp(entry.createdAt, "en")}`,
        entry.description,
        ...photo,
        `Hash ${entry.contentHash}`,
        `Previous hash ${entry.prevHash}`,
        ...(entry.status === "resolved"
          ? [`Resolved ${entry.resolvedAt || ""} by ${entry.resolvedBy || "unknown"}.${entry.resolutionNote ? ` Note: ${entry.resolutionNote}` : ""}`]
          : []),
      ],
    });
  }
  for (const message of input.messages) {
    const who = message.direction === "inbound" ? "Reply from the landlord" : "Message sent";
    events.push({
      at: message.createdAt,
      lines: [
        `${who} | ${formatTimestamp(message.createdAt, "en")} | ${message.direction} | ${message.deliveryStatus}${message.openIndicative ? " | open receipt (indicative only)" : ""}`,
        `From ${message.fromEmail} to ${message.toEmail}${message.ccEmail ? ` cc ${message.ccEmail}` : ""}`,
        `Subject: ${message.subject}`,
        ...(message.deliveryDetail ? [`Delivery note: ${message.deliveryDetail}`] : []),
        message.body,
      ],
    });
  }
  for (const deadline of input.deadlines) {
    const reminder = deadline.tenantReminderOn
      ? [`Tenant reminder: ${deadline.tenantReminderOn}. This is the tenant's own nudge. It does not change the computed date. Nothing in this packet was sent because of that reminder.`]
      : [];
    events.push({
      at: deadline.createdAt || deadline.dueDate || deadline.tenantReminderOn || "9999-12-31",
      lines: [
        `Date computed | ${deadline.kind} | rule ${deadline.ruleId} | due ${deadline.dueDate || "none"} | status ${deadline.status}`,
        deadline.computation,
        deadline.explanation,
        ...reminder,
      ],
    });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  if (events.length === 0) lines.push("No timeline entries.");
  for (const event of events) lines.push(...event.lines);

  lines.push("# Lease clause notes stored with a review");
  const notes = input.leaseNotes || [];
  if (notes.length === 0) lines.push("No lease clause notes stored.");
  for (const note of notes) {
    lines.push(note.filename ? `From ${note.filename}` : "From a lease review");
    lines.push(note.quote);
    if (note.ruleId) lines.push(`Rule ${note.ruleId}`);
  }

  lines.push("# Security deposit facts the tenant entered");
  if (!input.deposit) lines.push("No deposit record.");
  else {
    lines.push(
      `Amount ${input.deposit.amountCents != null ? formatMoney(input.deposit.amountCents, "en") : "(blank)"}. Move-out date ${input.deposit.moveOutDate || "(blank)"}. Forwarding address ${input.deposit.forwardingAddress || "(blank)"}.`,
    );
  }
  lines.push("# Rent ledger the tenant entered");
  if (input.ledger.length === 0) lines.push("No ledger rows.");
  for (const row of input.ledger) {
    lines.push(
      `${row.paidOn} | ${formatMoney(row.amountCents, "en")} | ${row.method}${row.voidedAt ? " | voided" : ""} | ${row.notes}`,
    );
  }
  lines.push("# Condition reports");
  if (input.conditions.length === 0) lines.push("No condition reports.");
  for (const report of input.conditions) {
    lines.push(
      `${report.kind} stored ${formatTimestamp(report.createdAt, "en")} hash ${report.contentHash || "(none)"} landlord acknowledged ${report.acknowledgedAt || "not yet"}`,
    );
  }
  lines.push("# Small claims is a self-help option");
  lines.push("Small claims is a self-help option. Rent Right does not file a case and does not give legal advice.");
  lines.push(`California courts self-help: ${SMALL_CLAIMS_URL}`);
  lines.push("# End of records");
  lines.push(DISCLAIMER_EN);
  return lines;
}
