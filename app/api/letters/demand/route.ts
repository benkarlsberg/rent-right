import { getDeposit, primaryUnit, unitAddress } from "@/lib/db";
import { demandLetter } from "@/lib/letters";
import { renderPdf } from "@/lib/pdf";
import { currentUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  const unit = primaryUnit(user.id);
  if (!unit) return new Response("Add a unit first.", { status: 400 });
  const deposit = getDeposit(user.id, unit.id);
  const notes = new URL(request.url).searchParams.get("notes") || "";
  try {
    const text = demandLetter({
      tenantName: user.name || user.email,
      unitAddress: unitAddress(unit),
      landlordName: unit.landlordName,
      landlordEmail: unit.landlordEmail,
      depositCents: deposit?.amount_cents || 0,
      moveOutDate: deposit?.move_out_date || "[move-out date]",
      dueDate: "[21 days after move-out]",
      forwardingAddress: deposit?.forwarding_address || "[forwarding address]",
      deductionNotes: deposit?.landlord_deductions || "",
      disputeNotes: notes,
      letterDate: new Date().toISOString().slice(0, 10),
    });
    const due = (await import("@/lib/db")).listDeadlines(user.id, unit.id).find((item) => item.kind === "deposit" && item.dueDate);
    const withDue = due?.dueDate ? text.replace("[21 days after move-out]", due.dueDate) : text;
    const pdf = await renderPdf("Security deposit letter", withDue.split("\n"));
    return new Response(Buffer.from(pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=deposit-letter.pdf" },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Could not build the letter.", { status: 400 });
  }
}
