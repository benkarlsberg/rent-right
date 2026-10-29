export const PRODUCTION_API_URL = "https://api.rentrightportal.com";

export function resolveApiBase(input: {
  configured?: string;
  dev: boolean;
  host?: string;
  android?: boolean;
}): string {
  const configured = input.configured?.replace(/\/$/, "");
  if (configured) return configured;
  if (!input.dev) return PRODUCTION_API_URL;
  if (input.host && input.host !== "localhost" && input.host !== "127.0.0.1") return `http://${input.host}:3000`;
  if (input.android) return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

/** Production builds turn Apple and Google on. `0` keeps a flag off. Dev stays off until set to `1`. */
export function authFlagEnabled(value: string | undefined, dev: boolean): boolean {
  if (value === "1") return true;
  if (value === "0") return false;
  return !dev;
}

export function isDevBuild(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__;
}
