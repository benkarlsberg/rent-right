import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { captureLoadedPath } from "@/back-nav";
import { listenForPush } from "@/push";
import { SessionProvider } from "@/session";
import { colors } from "@/theme";

if (Platform.OS === "web" && typeof window !== "undefined") captureLoadedPath(window.location.pathname);

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

function PushBridge() {
  useEffect(() => listenForPush(), []);
  return null;
}

export default function RootLayout() {
  installWebViewport();
  const app = (
    <SafeAreaProvider>
      <SessionProvider>
        <PushBridge />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="setup" />
          <Stack.Screen name="lease" />
          <Stack.Screen name="deposit" />
          <Stack.Screen name="increase" />
          <Stack.Screen name="assistant" />
          <Stack.Screen name="ledger" />
          <Stack.Screen name="packet" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="residence" />
          <Stack.Screen name="log-new" />
          <Stack.Screen name="log/[id]" />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
  if (Platform.OS !== "web") return app;
  return (
    <View style={{ flex: 1, backgroundColor: "#E6F0EE", alignItems: "center", width: "100%", minWidth: 0, overflow: "hidden" }}>
      <View style={{ width: "100%", maxWidth: 420, minWidth: 0, flex: 1, overflow: "hidden" }}>{app}</View>
    </View>
  );
}
