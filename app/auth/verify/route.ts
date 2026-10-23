import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { acceptInvite, consumeMagicLink, profileForAuthUser } from "@/lib/db";
import { signSession } from "@/lib/crypto";
import { setSessionCookie } from "@/lib/session";
import { userFromGoogleCode, userFromSupabaseAccessToken } from "@/lib/supabase-auth";
import { iconLinks } from "@/lib/legal-html";
import { appUrl } from "@/lib/text";

const hashPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Rent Right</title>
${iconLinks}
</head>
<body>
<p>Finishing sign-in…</p>
<script>
var hash = new URLSearchParams(location.hash.replace(/^#/, ""));
var token = hash.get("access_token");
var problem = hash.get("error_description") || hash.get("error");
if (token) location.replace("/auth/verify?access_token=" + encodeURIComponent(token));
else if (problem) location.replace("/?error=" + encodeURIComponent(problem));
else location.replace("/auth/expired");
</script>
</body>
</html>`;

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
    return webSession(request, signSession(user.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const next = new URL(request.url);
    next.pathname = "/auth/expired";
    next.search = "";
    if (message === "Could not sign in with Google.") next.searchParams.set("error", message);
    return NextResponse.redirect(next);
  }
}

function webSession(request: Request, session: string): NextResponse {
  const next = new URL(request.url);
  next.pathname = "/";
  next.search = "";
  next.searchParams.set("session", session);
  return NextResponse.redirect(next);
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
