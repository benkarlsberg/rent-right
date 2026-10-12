import type { Locale } from "@/lib/disclaimer";

export function tx(locale: Locale, en: string, es: string): string {
  return locale === "es" ? es : en;
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
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
  "The tenant wrote this message. Rent Right only provides the mailbox.",
  "General information, not legal advice. Rent Right does not send legal demands.",
].join("\n");
