import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { acceptInvite } from "@/lib/db";
import { currentUser } from "@/lib/session";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const user = await currentUser();
  if (!user) {
    const jar = await cookies();
    jar.set("rr_invite", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
    return NextResponse.redirect(new URL("/login?next=invite", request.url));
  }
  try {
    acceptInvite(user.id, token);
    return NextResponse.redirect(new URL("/home", request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite failed.";
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(message)}`, request.url));
  }
}
