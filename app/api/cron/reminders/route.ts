import { drainRoundTrips, withActor } from "@/lib/pg";
import { dispatchReminders } from "@/lib/workflow";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  drainRoundTrips();
  try {
    const sent = await withActor(null, () => dispatchReminders());
    return Response.json({ reminders: sent, queries: drainRoundTrips() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The reminder job failed.";
    return Response.json({ reminders: null, queries: drainRoundTrips(), error: message.slice(0, 180) }, { status: 500 });
  }
}
