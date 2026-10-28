import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { api } from "@/api";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { Button, ErrorLine, H1, Muted, Page } from "@/ui";

const KEY = "rr_invite";

export function pendingInvite(): string {
  if (Platform.OS !== "web" || typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) || "";
}

export function keepInvite(token: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") window.localStorage.setItem(KEY, token);
}

export function clearInvite() {
  if (Platform.OS === "web" && typeof window !== "undefined") window.localStorage.removeItem(KEY);
}

export default function Invite() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token) || "";
  const { token: session, signIn } = useSession();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token) keepInvite(token);
  }, [token]);

  async function join() {
    if (!session || !token || busy) return;
    try {
      setBusy(true);
      setError("");
      await signIn(await api<Me>("invite/accept", { token: session, body: { token } }));
      clearInvite();
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this home.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <H1>Join this home</H1>
      <Muted>Sign in with the email that received the invite. Nothing is sent to the landlord.</Muted>
      <ErrorLine message={error} />
      {session ? (
        <Button label={busy ? "Joining" : "Join this home"} onPress={() => void join()} disabled={busy} />
      ) : (
        <Button label="Sign in to join" onPress={() => router.replace("/")} />
      )}
    </Page>
  );
}
