import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { api } from "@/api";
import { parseGoogleCallback, GOOGLE_REDIRECT } from "@/google-callback";
import type { Me } from "@/session";

const PKCE_KEY = "rr_google_pkce";
const inflight = new Map<string, Promise<Me>>();

async function rememberPkce(pkce: string) {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(PKCE_KEY, pkce);
}

async function readPkce(): Promise<string> {
  if (Platform.OS === "web") return "";
  return (await SecureStore.getItemAsync(PKCE_KEY)) || "";
}

async function forgetPkce() {
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(PKCE_KEY).catch(() => undefined);
}

/** Exchange one callback once. A second arrival of the same code reuses the first result. */
export function exchangeGoogleCallback(url: string, pkce?: string): Promise<Me> {
  const parsed = parseGoogleCallback(url);
  if (parsed.error) return Promise.reject(new Error(parsed.error));
  if (!parsed.code) return Promise.reject(new Error("Could not sign in with Google."));
  const existing = inflight.get(parsed.code);
  if (existing) return existing;
  const job = (async () => {
    const stored = pkce || await readPkce();
    if (!stored) throw new Error("Could not sign in with Google.");
    const session = await api<Me>("auth/google/finish", { body: { code: parsed.code, pkce: stored } });
    await forgetPkce();
    return session;
  })();
  inflight.set(parsed.code, job);
  return job;
}

/** In-app Google sign-in. The browser closes back into the app with the one-time code. */
export async function signInWithGoogleNative(): Promise<Me | null> {
  const started = await api<{ url: string; pkce: string }>("auth/google/start", { body: {} });
  await rememberPkce(started.pkce);
  WebBrowser.maybeCompleteAuthSession();
  const result = await WebBrowser.openAuthSessionAsync(started.url, GOOGLE_REDIRECT);
  if (result.type === "cancel" || result.type === "dismiss") {
    await forgetPkce();
    return null;
  }
  if (result.type !== "success" || !result.url) throw new Error("Could not sign in with Google.");
  return exchangeGoogleCallback(result.url, started.pkce);
}
