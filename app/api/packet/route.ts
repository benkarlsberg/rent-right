import { getDeposit, listConditions, listDeadlines, listLedger, listLogHistory, listMessages, primaryUnit } from "@/lib/db";
import { packetLines } from "@/lib/packet";
import { renderPdf } from "@/lib/pdf";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  const unit = primaryUnit(user.id);
  if (!unit) return new Response("Add a unit first.", { status: 400 });
  const deposit = getDeposit(user.id, unit.id);
  const lines = packetLines({
    user,
    unit,
    logs: listLogHistory(user.id, unit.id),
    messages: listMessages(user.id, unit.id),
    deadlines: listDeadlines(user.id, unit.id),
    ledger: listLedger(user.id, unit.id).map((row) => ({
      paidOn: row.paid_on,
      amountCents: row.amount_cents,
      method: row.method,
      notes: row.notes,
      voidedAt: row.voided_at,
    })),
    deposit: deposit ? { amountCents: deposit.amount_cents, moveOutDate: deposit.move_out_date, forwardingAddress: deposit.forwarding_address } : null,
    conditions: listConditions(user.id, unit.id).map((report) => ({
      kind: report.kind,
      createdAt: report.createdAt,
      contentHash: report.contentHash,
      acknowledgedAt: report.acknowledgedAt,
    })),
  });
  const pdf = await renderPdf("Factual evidence packet", lines);
  return new Response(Buffer.from(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=rent-right-packet.pdf" },
  });
}
