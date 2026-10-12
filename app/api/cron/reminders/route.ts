import { dispatchReminders } from "@/lib/workflow";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sent = await dispatchReminders();
  return Response.json({ reminders: sent });
}
