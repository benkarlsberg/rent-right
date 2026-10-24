import { fetch } from "expo/fetch";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { apiBase, plainServerError, reachError } from "@/api";

async function packetNeedsLandlord(path: string, response: { headers: { get(name: string): string | null }; json(): Promise<unknown> }): Promise<boolean> {
  if (!path.startsWith("/api/packet")) return false;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) return false;
  const data = (await response.json().catch(() => null)) as { needsLandlord?: boolean } | null;
  if (data?.needsLandlord) return true;
  throw new Error("Could not download the file. Try again.");
}

export async function saveAuthorizedFile(path: string, filename: string, token: string): Promise<"saved" | "needs-landlord"> {
  const url = `${apiBase()}${path}`;
  if (Platform.OS === "web") {
    let response: Response;
    try {
      response = await globalThis.fetch(url, { headers: { authorization: `Bearer ${token}` } });
    } catch (error) {
      throw new Error(reachError(error));
    }
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(plainServerError(data?.error, response.status, "Could not download the file. Try again."));
    }
    if (await packetNeedsLandlord(path, response)) return "needs-landlord";
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.click();
    return "saved";
  }
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  } catch (error) {
    throw new Error(reachError(error));
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(plainServerError(data?.error, response.status, "Could not download the file. Try again."));
  }
  if (await packetNeedsLandlord(path, response)) return "needs-landlord";
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(await response.bytes());
  await Sharing.shareAsync(file.uri);
  return "saved";
}
