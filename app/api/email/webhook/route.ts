import { updateMessageStatus } from "@/lib/db";

export async function POST(request: Request) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    type?: string;
    data?: { email_id?: string; id?: string };
  } | null;
  const id = body?.data?.email_id || body?.data?.id;
  if (!body?.type || !id) return new Response("ignored", { status: 202 });
  const map: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delayed",
    "email.bounced": "bounced",
    "email.opened": "opened",
    "email.complained": "complained",
  };
  const status = map[body.type];
  if (!status) return new Response("ignored", { status: 202 });
  await updateMessageStatus(id, status, body.type, body.type === "email.opened");
  return new Response("ok");
}
