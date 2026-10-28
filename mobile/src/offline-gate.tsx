import { useEffect, useState, type ReactNode } from "react";
import { Platform, View } from "react-native";
import { apiBase } from "@/api";
import { colors } from "@/theme";
import { Button, H1, Muted } from "@/ui";

export function OfflineGate({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(() => Platform.OS === "web" && typeof navigator !== "undefined" && navigator.onLine === false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (Platform.OS === "web") {
      const sync = () => setOffline(navigator.onLine === false);
      window.addEventListener("online", sync);
      window.addEventListener("offline", sync);
      return () => {
        window.removeEventListener("online", sync);
        window.removeEventListener("offline", sync);
      };
    }
    let cancel = false;
    void fetch(`${apiBase()}/api/v1`, { method: "GET" }).then(() => {
      if (!cancel) setOffline(false);
    }).catch(() => {
      if (!cancel) setOffline(true);
    });
    return () => {
      cancel = true;
    };
  }, [attempt]);

  if (!offline) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: "center", padding: 24 }}>
      <H1>You are offline</H1>
      <Muted>Rent Right could not reach the internet. Your records stay on the server.</Muted>
      <Button label="Retry" onPress={() => { setOffline(false); setAttempt((value) => value + 1); }} />
    </View>
  );
}
