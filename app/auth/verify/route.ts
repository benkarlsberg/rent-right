import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { acceptInvite, consumeMagicLink } from "@/lib/db";
import { signSession } from "@/lib/crypto";
import { setSessionCookie } from "@/lib/session";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  try {
    const user = consumeMagicLink(token);
    await setSessionCookie(user.id);
    const jar = await cookies();
    const invite = jar.get("rr_invite")?.value;
    if (invite) {
      try { acceptInvite(user.id, invite); } catch { /* invite may be expired */ }
      jar.delete("rr_invite");
    }
    const session = signSession(user.id);
    return NextResponse.redirect(new URL(`/open?session=${encodeURIComponent(session)}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in failed.";
    return NextResponse.redirect(new URL(`/open?error=${encodeURIComponent(message)}`, request.url));
  }
}
