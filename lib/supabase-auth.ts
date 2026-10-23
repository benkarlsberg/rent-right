import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { appUrl } from "@/lib/text";

export function supabaseAuthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

function supabaseAdminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function client(key: string): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function memoryStorage() {
  const bag = new Map<string, string>();
  return {
    bag,
    getItem: (key: string) => bag.get(key) ?? null,
    setItem: (key: string, value: string) => {
      bag.set(key, value);
    },
    removeItem: (key: string) => {
      bag.delete(key);
    },
  };
}

function redirectTo(): string {
  return `${appUrl()}/auth/verify`;
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
  for (const type of ["magiclink", "email"] as const) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error && data.user) return { id: data.user.id, email: data.user.email || "" };
  }
  return null;
}

function pkceClient(storage: ReturnType<typeof memoryStorage>) {
  // persistSession must stay true. With it false, GoTrueClient drops the storage
  // adapter and keeps the PKCE verifier in a private map, so the cookie we send
  // to the browser is empty and the callback cannot exchange the code.
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
      storage,
      skipAutoInitialize: true,
    },
  });
}

export async function startGoogleSignIn(): Promise<{ url: string; pkce: string }> {
  if (!supabaseAuthConfigured()) throw new Error("Google sign-in is not available yet.");
  const storage = memoryStorage();
  const supabase = pkceClient(storage);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo(), skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error(error?.message || "Could not start Google sign-in.");
  const flowId = data.flowId ?? null;
  const entries = [...storage.bag.entries()];
  if (!entries.some(([key]) => key.includes("-flow-") && key.endsWith("-code-verifier"))) {
    throw new Error("Could not start Google sign-in.");
  }
  return { url: data.url, pkce: JSON.stringify({ flowId, entries }) };
}

export async function userFromGoogleCode(code: string, stored: string): Promise<{ id: string; email: string } | null> {
  if (!code || !supabaseAuthConfigured()) return null;
  let flowId: string | null = null;
  const storage = memoryStorage();
  try {
    const parsed = JSON.parse(stored) as { flowId?: string | null; entries?: [string, string][] };
    flowId = parsed.flowId || null;
    for (const [key, value] of parsed.entries || []) storage.setItem(key, value);
  } catch {
    console.error("Google sign-in exchange failed: stored verifier could not be read");
    return null;
  }
  if (![...storage.bag.keys()].some((key) => key.includes("-flow-") && key.endsWith("-code-verifier"))) {
    console.error("Google sign-in exchange failed: stored verifier was missing");
    return null;
  }
  const supabase = pkceClient(storage);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
  if (error || !data.user?.email) {
    console.error("Google sign-in exchange failed:", error?.name || "Error", error?.message || "no user");
    return null;
  }
  return { id: data.user.id, email: data.user.email };
}

export async function userFromSupabaseAccessToken(token: string): Promise<{ id: string; email: string } | null> {
  if (!token || !supabaseAuthConfigured()) return null;
  const supabase = client(process.env.SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

export async function userIdFromSupabaseToken(token: string | undefined): Promise<string | null> {
  if (!token || !supabaseAuthConfigured() || token.split(".").length !== 3) return null;
  const supabase = client(process.env.SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
