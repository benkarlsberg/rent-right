import Constants from "expo-constants";
import { Platform } from "react-native";

export function apiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") return `http://${host}:3000`;
  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

export async function api<T = Record<string, unknown>>(path: string, options?: { method?: string; body?: unknown; token?: string | null }): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body !== undefined) headers["content-type"] = "application/json";
  if (options?.token) headers.authorization = `Bearer ${options.token}`;
  const response = await fetch(`${apiBase()}/api/v1/${path}`.replace(/\/$/, ""), {
    method: options?.method || (options?.body !== undefined ? "POST" : "GET"),
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
