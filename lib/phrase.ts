import type { Locale } from "@/lib/disclaimer";
import { tx } from "@/lib/text";

/** A word that should keep its capital when a title is placed inside a sentence. */
export function keepsCapital(word: string): boolean {
  const token = word.replace(/[^A-Za-z0-9']/g, "");
  if (!token) return false;
  if (token === "I" || token.startsWith("I'")) return true;
  return /^[A-Z0-9]{2,}$/.test(token);
}

/** Lowercase the first letter of an issue title that continues a sentence. */
export function lowerLead(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return text;
  const first = text.split(/\s+/)[0] || "";
  if (keepsCapital(first)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function followUpTitle(issue: string, locale: Locale): string {
  const name = issue.replace(/\s+/g, " ").trim();
  if (!name) return tx(locale, "Follow up", "Seguimiento");
  return tx(locale, `Follow up: ${name}`, `Seguimiento: ${name}`);
}

/** Short mail subject. Cuts on a word, with no trailing fragment. */
export function repairSubject(description: string, locale: Locale): string {
  const prefix = tx(locale, "Repair request", "Solicitud de reparación");
  const clean = description.replace(/\s+/g, " ").trim();
  const sentence = ((clean.split(/(?<=[.!?])\s/)[0] || clean).replace(/[.!?]+$/, "")).trim();
  const clause = (sentence.split(/\s+(?:and|but|please|por favor|y|pero)\s+/i)[0] || sentence).trim();
  let words = clause.replace(/^(the|a|an|my|el|la|los|las|mi)\s+/i, "").replace(/[.!?]+$/, "").trim();
  const budget = Math.max(12, 60 - prefix.length - 2);
  if (words.length > budget) {
    const cut = words.slice(0, budget);
    const space = cut.lastIndexOf(" ");
    words = (space > 8 ? cut.slice(0, space) : cut).trim();
  }
  if (!words) words = tx(locale, "repair", "reparación");
  return `${prefix}: ${words}`;
}
