import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { acceptInvite, consumeMagicLink, profileForAuthUser } from "@/lib/db";
import { signSession } from "@/lib/crypto";
import { setSessionCookie } from "@/lib/session";
import { userFromGoogleCode, userFromSupabaseAccessToken } from "@/lib/supabase-auth";
import { appUrl } from "@/lib/text";

const hashPage = `<!doctype html>
<meta charset="utf-8">
<title>Rent Right</title>
<p>Finishing sign-in…</p>
<script>
var hash = new URLSearchParams(location.hash.replace(/^#/, ""));
var token = hash.get("access_token");
var problem = hash.get("error_description") || hash.get("error");
if (token) location.replace("/auth/verify?access_token=" + encodeURIComponent(token));
else if (problem) location.replace("/?error=" + encodeURIComponent(problem));
else document.body.textContent = "That sign-in link is invalid or expired.";
</script>`;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const accessToken = url.searchParams.get("access_token") || "";
  const token = url.searchParams.get("token") || "";
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error") || "";
  if (!code && !accessToken && !token) {
    if (oauthError) return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(oauthError)}`, appUrl()));
    return new NextResponse(hashPage, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  try {
    const user = code
      ? await userFromGoogle(code)
      : accessToken
        ? await userFromAccessToken(accessToken)
        : await consumeMagicLink(token);
    await setSessionCookie(user.id);
    const jar = await cookies();
    const invite = jar.get("rr_invite")?.value;
    if (invite) {
      try { await acceptInvite(user.id, invite); } catch { /* invite may be expired */ }
      jar.delete("rr_invite");
    }
    const session = signSession(user.id);
    if (code || accessToken) return NextResponse.redirect(new URL(`/?session=${encodeURIComponent(session)}`, appUrl()));
    return NextResponse.redirect(new URL(`/open?session=${encodeURIComponent(session)}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in failed.";
    return NextResponse.redirect(new URL(`/open?error=${encodeURIComponent(message)}`, request.url));
  }
}

async function userFromGoogle(code: string) {
  const jar = await cookies();
  const stored = jar.get("rr_pkce")?.value || "";
  jar.delete("rr_pkce");
  const remote = await userFromGoogleCode(code, stored);
  if (!remote) throw new Error("Could not sign in with Google.");
  return profileForAuthUser(remote.id, remote.email);
}

async function userFromAccessToken(accessToken: string) {
  const remote = await userFromSupabaseAccessToken(accessToken);
  if (!remote) throw new Error("Could not sign in with Google.");
  return profileForAuthUser(remote.id, remote.email);
}
