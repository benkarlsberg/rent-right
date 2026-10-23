import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/session";
import { colors } from "@/theme";

function installWebViewport() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    const content = meta.getAttribute("content") || "";
    const extras = ["viewport-fit=cover", "interactive-widget=resizes-content"].filter((part) => !content.includes(part));
    if (extras.length) meta.setAttribute("content", `${content}, ${extras.join(", ")}`);
  }
  document.getElementById("rr-home")?.remove();
  document.getElementById("rr-legal")?.remove();
  if (document.getElementById("rr-viewport")) return;
  const style = document.createElement("style");
  style.id = "rr-viewport";
  style.textContent = "html,body,#root{height:100dvh;min-height:100dvh}#root{display:flex;flex-direction:column;min-height:0}";
  document.head.appendChild(style);
}

installWebViewport();

export default function RootLayout() {
  installWebViewport();
  const app = (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.paper },
            headerShadowVisible: false,
            headerTintColor: colors.pine,
            headerTitleStyle: { color: colors.ink, fontWeight: "600" },
            contentStyle: { backgroundColor: colors.paper },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="setup" options={{ title: "Your place" }} />
          <Stack.Screen name="lease" options={{ title: "Lease" }} />
          <Stack.Screen name="deposit" options={{ title: "Deposit" }} />
          <Stack.Screen name="increase" options={{ title: "Rent increase" }} />
          <Stack.Screen name="assistant" options={{ title: "Rights" }} />
          <Stack.Screen name="ledger" options={{ title: "Rent paid" }} />
          <Stack.Screen name="photos" options={{ title: "Photos" }} />
          <Stack.Screen name="packet" options={{ title: "Records" }} />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
          <Stack.Screen name="log-new" options={{ title: "New note" }} />
          <Stack.Screen name="log/[id]" options={{ title: "Log" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
  if (Platform.OS !== "web") return app;
  return (
    <View style={{ flex: 1, backgroundColor: "#E6F0EE", alignItems: "center" }}>
      <View style={{ width: "100%", maxWidth: 420, flex: 1 }}>{app}</View>
    </View>
  );
}
