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

async function startOAuth(provider: "google" | "apple"): Promise<{ url: string; pkce: string }> {
  const label = provider === "apple" ? "Apple" : "Google";
  if (!supabaseAuthConfigured()) throw new Error(`${label} sign-in is not available yet.`);
  const storage = memoryStorage();
  const supabase = pkceClient(storage);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectTo(), skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error(error?.message || `Could not start ${label} sign-in.`);
  const flowId = data.flowId ?? null;
  const entries = [...storage.bag.entries()];
  if (!entries.some(([key]) => key.includes("-flow-") && key.endsWith("-code-verifier"))) {
    throw new Error(`Could not start ${label} sign-in.`);
  }
  return { url: data.url, pkce: JSON.stringify({ flowId, entries }) };
}

export function startGoogleSignIn(): Promise<{ url: string; pkce: string }> {
  return startOAuth("google");
}

export function startAppleSignIn(): Promise<{ url: string; pkce: string }> {
  return startOAuth("apple");
}

export type AuthIdentity = { id: string; email: string; name: string };

export function nameFromAuthUser(user: { user_metadata?: unknown; identities?: { identity_data?: unknown }[] } | null | undefined): string {
  const sources = [user?.user_metadata, ...(user?.identities || []).map((item) => item.identity_data)];
  for (const source of sources) {
    const name = nameFromMetadata(source);
    if (name) return name;
  }
  return "";
}

function nameFromMetadata(source: unknown): string {
  if (!source || typeof source !== "object") return "";
  const meta = source as Record<string, unknown>;
  const full = metaString(meta.full_name) || metaString(meta.name);
  if (full) return full;
  return [metaString(meta.given_name), metaString(meta.family_name)].filter(Boolean).join(" ");
}

function metaString(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function userFromAppleIdToken(identityToken: string, nonce: string): Promise<AuthIdentity | null> {
  if (!identityToken || !nonce || !supabaseAuthConfigured()) return null;
  const supabase = client(process.env.SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: identityToken,
    nonce,
  });
  const email = data.user?.email || "";
  if (error || !data.user || !email) return null;
  return { id: data.user.id, email, name: nameFromAuthUser(data.user) };
}

/** Deletes the Auth user with the service role. Returns false when that key is not configured. */
export async function deleteSupabaseAuthUser(userId: string): Promise<boolean> {
  if (!userId || !supabaseAdminConfigured()) return false;
  const admin = client(process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && !/not found/i.test(error.message)) throw new Error(error.message);
  return true;
}

export async function userFromGoogleCode(code: string, stored: string): Promise<AuthIdentity | null> {
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
  return { id: data.user.id, email: data.user.email, name: nameFromAuthUser(data.user) };
}

export async function userFromSupabaseAccessToken(token: string): Promise<AuthIdentity | null> {
  if (!token || !supabaseAuthConfigured()) return null;
  const supabase = client(process.env.SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email, name: nameFromAuthUser(data.user) };
}

export async function userIdFromSupabaseToken(token: string | undefined): Promise<string | null> {
  if (!token || !supabaseAuthConfigured() || token.split(".").length !== 3) return null;
  const supabase = client(process.env.SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
