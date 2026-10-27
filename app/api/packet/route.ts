import { getDeposit, listConditions, listDeadlines, listLeaseReviews, listLedger, listLogHistory, listMessages, listPhotos, primaryUnit, readFileForUser } from "@/lib/db";
import { landlordReady } from "@/lib/landlord";
import { buildPacket, type PacketImage } from "@/lib/packet";
import { renderPacket } from "@/lib/pdf";
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
  const logs = await listLogHistory(user.id, unit.id);
  const conditions = await listConditions(user.id, unit.id);
  const photos = await listPhotos(user.id, unit.id);
  const imageIds = new Set<string>();
  for (const log of logs) if (log.photoFileId) imageIds.add(log.photoFileId);
  for (const photo of photos) imageIds.add(photo.fileId);
  for (const report of conditions) for (const room of report.rooms) if (room.photoFileId) imageIds.add(room.photoFileId);
  const images: PacketImage[] = [];
  for (const id of imageIds) {
    const file = await readFileForUser(user.id, id);
    if (!file) continue;
    const caption = photos.find((photo) => photo.fileId === id);
    images.push({ id, bytes: file.bytes, mime: file.mime, caption: caption ? [caption.room, caption.caption].filter(Boolean).join(" — ") : "" });
  }
  const model = buildPacket({
    user,
    unit,
    logs,
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
    conditions: conditions.map((report) => ({
      id: report.id,
      kind: report.kind,
      createdAt: report.createdAt,
      contentHash: report.contentHash,
      acknowledgedAt: report.acknowledgedAt,
      rooms: report.rooms,
    })),
    leaseNotes: reviews.flatMap((review) => (review.result.findings || []).filter((finding) => finding.quote).slice(0, 30).map((finding) => ({
      quote: finding.quote,
      ruleId: finding.ruleId,
      filename: review.filename,
    }))),
    images,
    messageImages: photos.filter((photo) => photo.messageId).map((photo) => ({ messageId: photo.messageId as string, fileId: photo.fileId })),
  });
  const pdf = await renderPacket(model);
  const filename = evidenceFilename(todayISO());
  return new Response(Buffer.from(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${filename}"` },
  });
  });
}
