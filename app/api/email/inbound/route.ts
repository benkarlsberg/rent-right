import { getUser, insertMessage, unitByRelay, unitMemberUserIds, addNotification } from "@/lib/db";
import { sendTenantEmail } from "@/lib/email";
import { renderMail } from "@/lib/email-template";
import { withActor } from "@/lib/pg";
import { appUrl, relayAddress } from "@/lib/text";

export async function POST(request: Request) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
  } | null;
  if (!body?.to) return new Response("Missing recipient", { status: 400 });
  const to = Array.isArray(body.to) ? body.to.join(",") : body.to;
  const match = to.match(/u-[a-z0-9]+/i);
  if (!match) return new Response("No relay address", { status: 202 });
  return withActor(null, async () => {
  const unit = await unitByRelay(match[0].toLowerCase());
  if (!unit) return new Response("Unknown unit", { status: 202 });
  await insertMessage({
    unitId: unit.id,
    userId: null,
    direction: "inbound",
    fromEmail: body.from || "unknown",
    toEmail: relayAddress(unit.relayLocal),
    subject: body.subject || "(no subject)",
    body: body.text || "",
    deliveryStatus: "received",
    deliveryDetail: "Inbound relay message.",
  });
  for (const userId of await unitMemberUserIds(unit.id)) {
    const user = await getUser(userId);
    await addNotification(userId, "Landlord reply", body.subject || "New reply in your log", "/messages");
    if (user) {
      const note = body.text || "A reply was logged. Open the app to read it.";
      const mail = renderMail({
        subject: "Rent Right: a reply was logged",
        heading: "A reply was logged",
        paragraphs: [note],
        button: { label: "Open Rent Right", href: appUrl() },
      });
      await sendTenantEmail(user.email, mail.subject, mail.text, mail.html);
    }
  }
  return new Response("ok");
  });
}
