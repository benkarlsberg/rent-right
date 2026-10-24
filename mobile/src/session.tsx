import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { api } from "@/api";
import { clearTabCache } from "@/tab-cache";
import { userIdFromToken } from "@/tab-store";

const KEY = "rr_session";

export type Notice = { short: string; full: string; clinicShort: string; clinicFull: string };
export type Me = {
  token: string;
  needsUnit: boolean;
  needsLandlord?: boolean;
  user: { name: string; email: string; locale: "en" | "es"; lowBandwidth: boolean; sample: boolean };
  unit: { id?: string; address: string; landlordName: string; landlordEmail: string; relay: string; jurisdiction: string; archived?: boolean } | null;
};

type SessionValue = {
  ready: boolean;
  token: string | null;
  me: Me | null;
  signIn: (session: Me) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem(KEY) || null;
  return SecureStore.getItemAsync(KEY);
}

async function writeToken(token: string | null) {
  if (Platform.OS === "web") {
    if (token) globalThis.localStorage.setItem(KEY, token);
    else globalThis.localStorage.removeItem(KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const apply = useCallback(async (session: Me) => {
    if (token && userIdFromToken(token) !== userIdFromToken(session.token)) clearTabCache();
    await writeToken(session.token);
    setToken(session.token);
    setMe(session);
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const data = await api<Me>("me", { token });
    setMe({ ...data, token });
  }, [token]);

  const signOut = useCallback(async () => {
    clearTabCache();
    await writeToken(null);
    setToken(null);
    setMe(null);
  }, []);

  useEffect(() => {
    readToken()
      .then(async (saved) => {
        if (!saved) return;
        const data = await api<Me>("me", { token: saved });
        setToken(saved);
        setMe({ ...data, token: saved });
      })
      .catch(() => writeToken(null))
      .finally(() => setReady(true));
  }, []);

  return (
    <SessionContext.Provider
      value={{
        ready,
        token,
        me,
        signIn: apply,
        signOut,
        refresh,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session missing");
  return value;
}
