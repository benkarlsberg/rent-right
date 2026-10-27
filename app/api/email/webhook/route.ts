import { updateMessageStatus } from "@/lib/db";

export async function POST(request: Request) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    type?: string;
    data?: {
      email_id?: string;
      id?: string;
      bounce?: { message?: string; type?: string; subType?: string };
    };
  } | null;
  const id = body?.data?.email_id || body?.data?.id;
  if (!body?.type || !id) return new Response("ignored", { status: 202 });
  const map: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delayed",
    "email.bounced": "bounced",
    "email.opened": "delivered",
    "email.clicked": "delivered",
    "email.complained": "complained",
  };
  const status = map[body.type];
  if (!status) return new Response("ignored", { status: 202 });
  const bounce = [body.data?.bounce?.message, body.data?.bounce?.subType].filter(Boolean).join(" — ");
  const detail = body.type === "email.bounced"
    ? (bounce || "The recipient's mail server rejected the message.")
    : body.type === "email.complained"
      ? "The recipient marked the message as spam."
      : body.type === "email.delivery_delayed"
        ? "Delivery is delayed."
        : body.type === "email.delivered" || body.type === "email.opened" || body.type === "email.clicked"
          ? "Delivered."
          : body.type;
  await updateMessageStatus(id, status, detail, body.type === "email.opened" || body.type === "email.clicked");
  return new Response("ok");
}
