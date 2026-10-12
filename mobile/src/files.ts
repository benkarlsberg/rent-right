import { fetch } from "expo/fetch";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { apiBase } from "@/api";

export async function saveAuthorizedFile(path: string, filename: string, token: string) {
  const url = `${apiBase()}${path}`;
  if (Platform.OS === "web") {
    const response = await globalThis.fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Could not download the file.");
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.click();
    return;
  }
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Could not download the file.");
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(await response.bytes());
  await Sharing.shareAsync(file.uri);
}
