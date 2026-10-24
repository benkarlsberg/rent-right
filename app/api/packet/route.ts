import { getDeposit, listConditions, listDeadlines, listLeaseReviews, listLedger, listLogHistory, listMessages, primaryUnit } from "@/lib/db";
import { landlordReady } from "@/lib/landlord";
import { packetLines } from "@/lib/packet";
import { renderPdf } from "@/lib/pdf";
import { withActor } from "@/lib/pg";
import { todayISO } from "@/lib/rules/dates";
import { evidenceFilename } from "@/lib/records-view";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  return withActor(user.id, async () => {
  const unit = await primaryUnit(user.id);
  if (!unit) return new Response("Add a unit first.", { status: 400 });
  if (!landlordReady(unit)) return Response.json({ needsLandlord: true });
  const deposit = await getDeposit(user.id, unit.id);
  const reviews = await listLeaseReviews(user.id, unit.id);
  const lines = packetLines({
    user,
    unit,
    logs: await listLogHistory(user.id, unit.id),
    messages: (await listMessages(user.id, unit.id)).filter((message) => message.deliveryStatus !== "draft" && message.deliveryStatus !== "discarded"),
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
    leaseNotes: reviews.flatMap((review) => (review.result.findings || []).filter((finding) => finding.quote).slice(0, 30).map((finding) => ({
      quote: finding.quote,
      ruleId: finding.ruleId,
      filename: review.filename,
    }))),
  });
  const pdf = await renderPdf("Factual evidence packet", lines);
  const filename = evidenceFilename(todayISO());
  return new Response(Buffer.from(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${filename}"` },
  });
  });
}
