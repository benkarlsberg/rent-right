import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function supabaseAuthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

function supabaseAdminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function client(key: string): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function redirectTo(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/verify`;
}

/** Returns a token hash when the service role can mint a link. Otherwise Supabase emails the user. */
export async function sendSupabaseMagicLink(email: string): Promise<string | null> {
  if (!supabaseAuthConfigured() && !supabaseAdminConfigured()) throw new Error("Supabase Auth is not configured.");
  if (supabaseAdminConfigured()) {
    const admin = client(process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: redirectTo() },
    });
    if (error) throw new Error(error.message);
    return data.properties?.hashed_token || null;
  }
  const supabase = client(process.env.SUPABASE_ANON_KEY!);
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw new Error(error.message);
  return null;
}

export async function userFromSupabaseOtp(tokenHash: string): Promise<{ id: string; email: string } | null> {
  if (!tokenHash || !supabaseAuthConfigured()) return null;
  const supabase = client(process.env.SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email || "" };
}

export async function userIdFromSupabaseToken(token: string | undefined): Promise<string | null> {
  if (!token || !supabaseAuthConfigured() || token.split(".").length !== 3) return null;
  const supabase = client(process.env.SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
