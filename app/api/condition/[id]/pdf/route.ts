import { getCondition } from "@/lib/db";
import { renderPdf } from "@/lib/pdf";
import { adoptActor, currentUser } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  adoptActor(user.id);
  const { id } = await context.params;
  const report = await getCondition(user.id, id);
  const lines = [
    `# ${report.kind} condition report`,
    `Stored ${report.createdAt}`,
    `Hash ${report.contentHash}`,
    report.acknowledgedAt ? `Acknowledged by ${report.ackName} at ${report.acknowledgedAt}` : "Not acknowledged.",
    ...report.rooms.flatMap((room) => [`# ${room.room}`, `${room.condition}. Issues: ${room.issues.join(", ") || "none"}. ${room.notes}`]),
    report.notes,
  ];
  const pdf = await renderPdf("Condition report", lines);
  return new Response(Buffer.from(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=condition-report.pdf" },
  });
}
