import type { Locale } from "@/lib/disclaimer";

export function tx(locale: Locale, en: string, es: string): string {
  return locale === "es" ? es : en;
}

export function appUrl(): string {
  const env = process.env as Record<string, string | undefined>;
  const value = env.APP_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return value.replace(/\/$/, "");
}

export function relayDomain(): string {
  return process.env.RELAY_DOMAIN || "relay.rentright.local";
}

export function relayAddress(local: string): string {
  return `${local}@${relayDomain()}`;
}

export const EMAIL_FOOTER = [
  "",
  "---",
  "Sent with Rent Right, free for renters.",
  "General information, not legal advice. Rent Right does not send legal demands.",
].join("\n");
