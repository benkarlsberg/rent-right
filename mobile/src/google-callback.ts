export const GOOGLE_REDIRECT = "rentright://auth/callback";

/** Read the one-time code Supabase appends when it returns to the app. */
export function parseGoogleCallback(url: string): { code: string; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { code: "", error: "Could not sign in with Google." };
  }
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const code = parsed.searchParams.get("code") || hash.get("code") || "";
  const error = parsed.searchParams.get("error_description")
    || parsed.searchParams.get("error")
    || hash.get("error_description")
    || hash.get("error")
    || "";
  return { code, error };
}
