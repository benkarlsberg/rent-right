import { readFileForUser } from "@/lib/db";
import { adoptActor, currentUser } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  adoptActor(user.id);
  const { id } = await context.params;
  const file = await readFileForUser(user.id, id);
  if (!file) return new Response("Not found.", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.mime || "application/octet-stream",
      "content-disposition": `inline; filename="${file.name.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
}
