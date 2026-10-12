import { exportUserData } from "@/lib/db";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  const data = await exportUserData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": "attachment; filename=rent-right-export.json",
    },
  });
}
