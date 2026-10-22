import { getDeposit, listConditions, listDeadlines, listLedger, listLogHistory, listMessages, primaryUnit } from "@/lib/db";
import { packetLines } from "@/lib/packet";
import { renderPdf } from "@/lib/pdf";
import { adoptActor, currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  adoptActor(user.id);
  const unit = await primaryUnit(user.id);
  if (!unit) return new Response("Add a unit first.", { status: 400 });
  const deposit = await getDeposit(user.id, unit.id);
  const lines = packetLines({
    user,
    unit,
    logs: await listLogHistory(user.id, unit.id),
    messages: await listMessages(user.id, unit.id),
    deadlines: await listDeadlines(user.id, unit.id),
    ledger: (await listLedger(user.id, unit.id)).map((row) => ({
      paidOn: row.paid_on,
      amountCents: row.amount_cents,
      method: row.method,
      notes: row.notes,
      voidedAt: row.voided_at,
    })),
    deposit: deposit ? { amountCents: deposit.amount_cents, moveOutDate: deposit.move_out_date, forwardingAddress: deposit.forwarding_address } : null,
    conditions: (await listConditions(user.id, unit.id)).map((report) => ({
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
