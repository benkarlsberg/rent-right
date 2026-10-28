import Constants from "expo-constants";
import { router } from "expo-router";
import { Platform } from "react-native";
import { api } from "@/api";

const ASKED = "rr_push_asked";
const STORED = "rr_expo_push";

function openPush(data: Record<string, unknown>) {
  const screen = typeof data.screen === "string" ? data.screen : "";
  const id = typeof data.id === "string" ? data.id : "";
  if (screen === "landlord") router.push("/landlord");
  else if (screen === "log" && id) router.push(`/log/${id}`);
  else if (screen === "reminders") router.push("/reminders");
}

/** Native only. The website never asks for or registers a push token. */
export async function offerPushRegistration(sessionToken: string | null, force = false): Promise<void> {
  if (Platform.OS === "web" || !sessionToken) return;
  const SecureStore = await import("expo-secure-store");
  if (!force && (await SecureStore.getItemAsync(ASKED)) === "1") return;
  const Notifications = await import("expo-notifications");
  const existing = await Notifications.getPermissionsAsync();
  const next = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
  await SecureStore.setItemAsync(ASKED, "1");
  if (next.status !== "granted") {
    await api("settings", { token: sessionToken, body: { pushEnabled: false } }).catch(() => undefined);
    return;
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Rent Right",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const minted = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  const pushToken = minted.data;
  if (!pushToken) return;
  await SecureStore.setItemAsync(STORED, pushToken);
  await api("devices", { token: sessionToken, body: { token: pushToken, platform: Platform.OS } });
  await api("settings", { token: sessionToken, body: { pushEnabled: true } }).catch(() => undefined);
}

export async function unregisterPush(sessionToken: string | null): Promise<void> {
  if (Platform.OS === "web" || !sessionToken) return;
  const SecureStore = await import("expo-secure-store");
  const pushToken = await SecureStore.getItemAsync(STORED);
  if (pushToken) {
    await api("devices/remove", { token: sessionToken, body: { token: pushToken } }).catch(() => undefined);
  }
  await SecureStore.deleteItemAsync(STORED).catch(() => undefined);
}

export function listenForPush(): () => void {
  if (Platform.OS === "web") return () => {};
  let dead = false;
  let remove: (() => void) | null = null;
  void import("expo-notifications").then(async (Notifications) => {
    if (dead) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const last = await Notifications.getLastNotificationResponseAsync();
    if (!dead && last) openPush(last.notification.request.content.data as Record<string, unknown>);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openPush(response.notification.request.content.data as Record<string, unknown>);
    });
    if (dead) subscription.remove();
    else remove = () => subscription.remove();
  }).catch(() => undefined);
  return () => {
    dead = true;
    remove?.();
  };
}
