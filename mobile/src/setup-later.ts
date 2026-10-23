import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "rr_setup_later";

export async function skippedSetup(): Promise<boolean> {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem(KEY) === "1";
  return (await SecureStore.getItemAsync(KEY)) === "1";
}

export async function setSkippedSetup(skipped: boolean): Promise<void> {
  if (Platform.OS === "web") {
    if (skipped) globalThis.localStorage.setItem(KEY, "1");
    else globalThis.localStorage.removeItem(KEY);
    return;
  }
  if (skipped) await SecureStore.setItemAsync(KEY, "1");
  else await SecureStore.deleteItemAsync(KEY);
}
