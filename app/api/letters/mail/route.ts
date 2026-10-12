import { getLog, primaryUnit, unitAddress } from "@/lib/db";
import { certifiedMailLetter } from "@/lib/letters";
import { renderPdf } from "@/lib/pdf";
import { currentUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  const unit = primaryUnit(user.id);
  if (!unit) return new Response("Add a unit first.", { status: 400 });
  const logId = new URL(request.url).searchParams.get("log") || "";
  const entry = getLog(user.id, logId);
  const text = certifiedMailLetter({
    letterDate: new Date().toISOString().slice(0, 10),
    tenantName: user.name || user.email,
    unitAddress: unitAddress(unit),
    landlordName: unit.landlordName,
    landlordEmail: unit.landlordEmail,
    subject: entry.type,
    body: entry.description,
    logId: entry.id,
    contentHash: entry.contentHash,
  });
  const pdf = await renderPdf("Letter to mail", text.split("\n"));
  return new Response(Buffer.from(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=letter-to-mail.pdf" },
  });
}
