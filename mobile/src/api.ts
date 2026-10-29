import Constants from "expo-constants";
import { Platform } from "react-native";
import { isDevBuild, resolveApiBase } from "@/release-config";

export function apiBase(): string {
  return resolveApiBase({
    configured: process.env.EXPO_PUBLIC_API_URL,
    dev: isDevBuild(),
    host: Constants.expoConfig?.hostUri?.split(":")[0],
    android: Platform.OS === "android",
  });
}

export function reachError(error: unknown): string {
  const message = error instanceof Error ? error.message : "network error";
  if (message === "Failed to fetch" || message === "Network request failed" || message === "Load failed") {
    return "Could not reach Rent Right. The browser blocked the response or the connection failed. This is not a message from the server.";
  }
  return message;
}

export function plainServerError(serverMessage: string | undefined, status: number, fallback = "Something went wrong. Try again."): string {
  if (serverMessage && /too many subrequests/i.test(serverMessage)) {
    return "Rent Right could not finish that just now. Wait a moment and try again.";
  }
  if (serverMessage === "Sign in required.") return "Sign in to continue.";
  if (serverMessage) return serverMessage;
  if (status === 401) return "Sign in to continue.";
  if (status >= 500) return "The database connection timed out. Try again.";
  return fallback;
}

function requestDeadline(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function api<T = Record<string, unknown>>(path: string, options?: { method?: string; body?: unknown; token?: string | null; signal?: AbortSignal }): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body !== undefined) headers["content-type"] = "application/json";
  if (options?.token) headers.authorization = `Bearer ${options.token}`;
  const deadline = requestDeadline(12_000);
  const signal = options?.signal && typeof AbortSignal.any === "function" ? AbortSignal.any([options.signal, deadline]) : options?.signal || deadline;
  let response: Response;
  try {
    response = await fetch(`${apiBase()}/api/v1/${path}`.replace(/\/$/, ""), {
      method: options?.method || (options?.body !== undefined ? "POST" : "GET"),
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    if (deadline.aborted) throw new Error("The database connection timed out. Try again.");
    throw new Error(reachError(error));
  }
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(plainServerError(data?.error, response.status));
  if (!data) throw new Error("Rent Right sent an empty response. Try again.");
  return data;
}
