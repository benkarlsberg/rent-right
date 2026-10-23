import { NextResponse } from "next/server";
import { startAppleSignIn } from "@/lib/supabase-auth";
import { appUrl } from "@/lib/text";

export async function GET() {
  try {
    const { url, pkce } = await startAppleSignIn();
    const response = NextResponse.redirect(url);
    response.cookies.set("rr_pkce", pkce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start Apple sign-in.";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, appUrl()));
  }
}
