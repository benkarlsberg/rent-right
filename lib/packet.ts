import { DISCLAIMER_EN } from "@/lib/disclaimer";
import { formatMoney, formatTimestamp } from "@/lib/format";
import type { Unit, User } from "@/lib/db";
import { unitAddress } from "@/lib/db";
import { relayAddress } from "@/lib/text";

export function packetLines(input: {
  user: User;
  unit: Unit;
  logs: { eventDate: string; createdAt: string; type: string; description: string; contentHash: string; prevHash: string; version: number }[];
  messages: { createdAt: string; direction: string; fromEmail: string; toEmail: string; ccEmail: string | null; subject: string; body: string; deliveryStatus: string; deliveryDetail: string | null; openIndicative: boolean }[];
  deadlines: { ruleId: string; kind: string; dueDate: string | null; computation: string; explanation: string; status: string }[];
  ledger: { paidOn: string; amountCents: number; method: string; notes: string; voidedAt: string | null }[];
  deposit: { amountCents: number | null; moveOutDate: string | null; forwardingAddress: string } | null;
  conditions: { kind: string; createdAt: string; contentHash: string | null; acknowledgedAt: string | null }[];
}): string[] {
  const lines: string[] = [
    "# What this packet is",
    "This packet lists records the tenant stored in Rent Right, in chronological order. It does not say who is responsible, what claim to file, or what the tenant should do.",
    `Prepared ${new Date().toISOString()} for ${input.user.name || input.user.email}.`,
    "# Property the tenant entered",
    unitAddress(input.unit),
    `Jurisdiction selected by the tenant: ${input.unit.jurisdiction}. Confirmed by tenant: ${input.unit.jurisdictionConfirmed ? "yes" : "no"}.`,
    `Landlord name entered: ${input.unit.landlordName || "(blank)"}. Landlord email entered: ${input.unit.landlordEmail || "(blank)"}.`,
    `Relay address: ${relayAddress(input.unit.relayLocal)}. Monthly rent entered: ${input.unit.rentCents != null ? formatMoney(input.unit.rentCents, "en") : "(blank)"}.`,
    "# Request and notice log",
  ];
  if (input.logs.length === 0) lines.push("No log entries.");
  for (const entry of input.logs) {
    lines.push(
      `${entry.eventDate} | ${entry.type} | version ${entry.version} | stored ${formatTimestamp(entry.createdAt, "en")}`,
    );
    lines.push(entry.description);
    lines.push(`Hash ${entry.contentHash}`);
    lines.push(`Previous hash ${entry.prevHash}`);
  }
  lines.push("# Email thread");
  if (input.messages.length === 0) lines.push("No relay messages.");
  for (const message of input.messages) {
    lines.push(
      `${formatTimestamp(message.createdAt, "en")} | ${message.direction} | ${message.deliveryStatus}${message.openIndicative ? " | open receipt (indicative only)" : ""}`,
    );
    lines.push(`From ${message.fromEmail} to ${message.toEmail}${message.ccEmail ? ` cc ${message.ccEmail}` : ""}`);
    lines.push(`Subject: ${message.subject}`);
    if (message.deliveryDetail) lines.push(`Delivery note: ${message.deliveryDetail}`);
    lines.push(message.body);
  }
  lines.push("# Dates the rules engine computed");
  for (const deadline of input.deadlines) {
    lines.push(`${deadline.kind} | rule ${deadline.ruleId} | due ${deadline.dueDate || "unsure"} | status ${deadline.status}`);
    lines.push(deadline.computation);
    lines.push(deadline.explanation);
  }
  lines.push("# Security deposit facts the tenant entered");
  if (!input.deposit) lines.push("No deposit record.");
  else {
    lines.push(
      `Amount ${input.deposit.amountCents != null ? formatMoney(input.deposit.amountCents, "en") : "(blank)"}. Move-out date ${input.deposit.moveOutDate || "(blank)"}. Forwarding address ${input.deposit.forwardingAddress || "(blank)"}.`,
    );
  }
  lines.push("# Rent ledger the tenant entered");
  for (const row of input.ledger) {
    lines.push(
      `${row.paidOn} | ${formatMoney(row.amountCents, "en")} | ${row.method}${row.voidedAt ? " | voided" : ""} | ${row.notes}`,
    );
  }
  lines.push("# Condition reports");
  for (const report of input.conditions) {
    lines.push(
      `${report.kind} stored ${formatTimestamp(report.createdAt, "en")} hash ${report.contentHash || "(none)"} landlord acknowledged ${report.acknowledgedAt || "not yet"}`,
    );
  }
  lines.push("# End of records");
  lines.push(DISCLAIMER_EN);
  return lines;
}
