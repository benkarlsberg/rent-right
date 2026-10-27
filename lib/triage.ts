import type { Locale } from "@/lib/disclaimer";
import type { RepairSeverity } from "@/lib/rules/engine";
import { tx } from "@/lib/text";

export type IssueTier = "routine" | "urgent" | "possible_violation";

export const ISSUE_TIERS: IssueTier[] = ["routine", "urgent", "possible_violation"];

const URGENT_SEVERITIES = new Set<RepairSeverity>([
  "no_heat",
  "no_water",
  "no_electricity",
  "gas_leak",
  "sewage",
  "flood",
  "no_toilet",
  "door",
  "window",
  "co_alarm",
  "fire",
  "wiring",
]);

const HABITABILITY = new Set<RepairSeverity>([
  ...URGENT_SEVERITIES,
  "mold",
  "pests",
]);

export function isIssueTier(value: string): value is IssueTier {
  return (ISSUE_TIERS as string[]).includes(value);
}

const SEVERITIES: RepairSeverity[] = [
  "no_heat", "no_water", "no_electricity", "gas_leak", "sewage", "flood", "no_toilet", "door", "window", "co_alarm", "fire", "wiring", "leak", "mold", "pests", "other",
];

export function asRepairSeverity(value: string | null | undefined): RepairSeverity {
  return value && SEVERITIES.includes(value as RepairSeverity) ? value as RepairSeverity : "other";
}

export function tierForSeverity(severity: string | null | undefined): IssueTier {
  return severity && URGENT_SEVERITIES.has(severity as RepairSeverity) ? "urgent" : "routine";
}

/** Urgent uses the 3-day reminder. Routine and a rules flag use 30 days. A stored tier wins over the severity default. */
export function reminderPace(tier: string | null | undefined, severity: string | null | undefined): "routine" | "urgent" {
  if (tier === "urgent") return "urgent";
  if (tier === "routine" || tier === "possible_violation") return "routine";
  return tierForSeverity(severity) === "urgent" ? "urgent" : "routine";
}

export function isHabitability(severity: string | null | undefined): boolean {
  return Boolean(severity && HABITABILITY.has(severity as RepairSeverity));
}

export type SafetyKind = "gas" | "co" | "fire" | "none";

export function safetyKind(severity: string | null | undefined): SafetyKind {
  if (severity === "gas_leak") return "gas";
  if (severity === "co_alarm") return "co";
  if (severity === "fire" || severity === "wiring") return "fire";
  return "none";
}

/** What to do before anything else. Gas, carbon monoxide, and fire or exposed wiring say to leave and call. */
export function safetySteps(severity: string | null | undefined, locale: Locale): string | null {
  const kind = safetyKind(severity);
  if (kind === "gas") {
    return tx(
      locale,
      "Leave the home now. Call the gas company or 911 from outside. Do not stay inside to take a photo.",
      "Salga de la vivienda ahora. Llame a la compañía de gas o al 911 desde afuera. No se quede adentro para tomar una foto.",
    );
  }
  if (kind === "co") {
    return tx(
      locale,
      "Leave the home now and call 911 from outside. Do not stay inside to take a photo.",
      "Salga de la vivienda ahora y llame al 911 desde afuera. No se quede adentro para tomar una foto.",
    );
  }
  if (kind === "fire") {
    return tx(
      locale,
      "If you are in danger, leave and call 911. Do not stay inside to take a photo.",
      "Si está en peligro, salga y llame al 911. No se quede adentro para tomar una foto.",
    );
  }
  return null;
}

export function photoPrompt(severity: string | null | undefined, locale: Locale): string {
  if (safetyKind(severity) === "none") {
    return tx(
      locale,
      "Add a photo of the problem when you can. Use the + button and choose Issue photo.",
      "Agregue una foto del problema cuando pueda. Use el botón + y elija Foto del problema.",
    );
  }
  return tx(
    locale,
    "After you are outside and safe, add a photo if you still can. Use the + button and choose Issue photo.",
    "Cuando esté afuera y a salvo, agregue una foto si aún puede. Use el botón + y elija Foto del problema.",
    );
}

export function urgentLabel(locale: Locale): string {
  return tx(locale, "Urgent", "Urgente");
}

export function violationFlag(locale: Locale): string {
  return tx(
    locale,
    "This may not follow California rules",
    "Esto puede no seguir las reglas de California",
  );
}

export function tierLabel(tier: IssueTier, locale: Locale): string {
  if (tier === "urgent") return urgentLabel(locale);
  if (tier === "possible_violation") return violationFlag(locale);
  return tx(locale, "Routine", "Rutina");
}

/** Short name for a timeline line. Rules stays one word, not the long violation sentence. */
export function tierShort(tier: IssueTier, locale: Locale): string {
  if (tier === "urgent") return urgentLabel(locale);
  if (tier === "possible_violation") return tx(locale, "Rules", "Reglas");
  return tx(locale, "Routine", "Rutina");
}

export type AidLink = { name: string; url: string };

export const STATEWIDE_AID: AidLink[] = [
  { name: "LawHelp California", url: "https://www.lawhelpca.org/" },
  { name: "California Courts self-help: housing", url: "https://selfhelp.courts.ca.gov/housing" },
];

/** City housing office when the coverage data has one, then the free statewide pages. No paid referral. */
export function aidLinks(local: { name: string; url: string } | null): AidLink[] {
  const city = local?.url ? [{ name: local.name || "City housing office", url: local.url }] : [];
  return [...city, ...STATEWIDE_AID];
}

export function aidText(links: AidLink[], locale: Locale): string {
  const lines = links.map((link) => `${link.name}\n${link.url}`);
  return [
    tx(
      locale,
      "Free help. These are legal aid and government pages. Rent Right does not charge a fee and does not refer you to a paid attorney.",
      "Ayuda gratuita. Son páginas de asistencia legal y del gobierno. Rent Right no cobra y no lo refiere a un abogado de pago.",
    ),
    ...lines,
  ].join("\n\n");
}

export function timelinePointer(locale: Locale): string {
  return tx(
    locale,
    "The evidence timeline is on this request in Records, under History, and in the evidence packet.",
    "La línea de tiempo está en esta solicitud en Registros, en Historial, y en el paquete de evidencia.",
  );
}

export function violationDetail(input: {
  locale: Locale;
  citation: string;
  reason: string;
  unsure: boolean;
  links: AidLink[];
}): string {
  return [
    violationFlag(input.locale),
    input.citation,
    input.reason,
    input.unsure ? tx(input.locale, "Unsure.", "No se puede precisar.") : "",
    timelinePointer(input.locale),
    aidText(input.links, input.locale),
  ].filter(Boolean).join("\n\n");
}

export function escalationNote(locale: Locale, due: string, habitability: boolean): string {
  const basis = habitability
    ? tx(
        locale,
        `No landlord reply was logged by the reminder date (${due}). This is a habitability or urgent repair, so the request is now flagged. Civil Code §1942. Unsure whether a reply was made outside Rent Right.`,
        `No hay una respuesta del propietario registrada para la fecha del recordatorio (${due}). Es una reparación urgente o de habitabilidad, así que la solicitud quedó marcada. Código Civil §1942. No se puede precisar si hubo una respuesta fuera de Rent Right.`,
      )
    : tx(
        locale,
        `No landlord reply was logged by the reminder date (${due}). The request is now flagged. Civil Code §1942. Unsure whether a reply was made outside Rent Right.`,
        `No hay una respuesta del propietario registrada para la fecha del recordatorio (${due}). La solicitud quedó marcada. Código Civil §1942. No se puede precisar si hubo una respuesta fuera de Rent Right.`,
      );
  return `${violationFlag(locale)}. ${basis}`;
}

export function shouldEscalate(input: {
  tier: IssueTier | null;
  manual: boolean;
  open: boolean;
  due: string | null;
  today: string;
  replied: boolean;
}): boolean {
  if (input.manual || !input.open || input.replied || !input.due) return false;
  if (input.tier !== "routine" && input.tier !== "urgent") return false;
  return input.today > input.due;
}

export function urgentLetterLead(locale: Locale): string {
  return tx(
    locale,
    "Please repair this within a short reasonable time.",
    "Repare esto dentro de un plazo breve y razonable.",
  );
}
