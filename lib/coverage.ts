import type { Locale } from "@/lib/disclaimer";
import { lawStateOf, type LawState } from "@/lib/rules/states";
import { stateName } from "@/lib/us-address";

export const COVERAGE_NOTICE_EN =
  "Rent Right has statewide rules for California, Arizona, Nevada, Oregon, Washington, Texas, Florida, New York, Illinois, Massachusetts, North Carolina, Pennsylvania, Ohio, the District of Columbia, Michigan, Virginia, Maryland, Minnesota, Wisconsin, Indiana, South Carolina, Connecticut, and Iowa. It does not cover this state's law. You can still log issues, keep photos, and email your landlord, but rules, legal deadlines, and law citations won't apply to your home.";

export const COVERAGE_NOTICE_ES =
  "Rent Right tiene reglas estatales para California, Arizona, Nevada, Oregón, Washington, Texas, Florida, Nueva York, Illinois, Massachusetts, Carolina del Norte, Pensilvania, Ohio, el Distrito de Columbia, Michigan, Virginia, Maryland, Minnesota, Wisconsin, Indiana, Carolina del Sur, Connecticut e Iowa. No cubre la ley de este estado. Aún puede anotar problemas, guardar fotos y escribirle a su propietario, pero las reglas, los plazos legales y las citas de leyes no aplican a su vivienda.";

export function coverageNotice(locale: Locale | "en" | "es" = "en"): string {
  return locale === "es" ? COVERAGE_NOTICE_ES : COVERAGE_NOTICE_EN;
}

export function coversLaw(unit: { supported?: boolean; jurisdiction?: string } | null | undefined): boolean {
  if (!unit) return true;
  if (unit.supported === false) return false;
  if (unit.jurisdiction === "unsupported") return false;
  return true;
}

export function coverageBounds(unit: { jurisdiction?: string; supported?: boolean } | null | undefined, locale: Locale | "en" | "es" = "en"): string | null {
  if (unit?.jurisdiction === "city_nyc") {
    return locale === "es"
      ? "Hay reglas del estado de Nueva York y de la ciudad de Nueva York para reparaciones, depósitos, calefacción, avisos de renta y buena causa. La estabilización de renta no se supone. Si faltan hechos o una exención, Rent Right no decide si algo es legal. Revisado el 13 de noviembre de 2026."
      : "New York statewide rules and New York City rules are loaded for repairs, deposits, heat, rent notices, and good cause. Rent stabilization is not assumed. If facts or an exemption are missing, Rent Right does not decide that something is legal. Checked Nov 13, 2026.";
  }
  const state = lawStateOf(unit);
  if (!state || state === "CA") return null;
  const name = stateName(state) || state;
  return locale === "es"
    ? `Hay reglas estatales de ${name} para reparaciones, depósitos, avisos de renta y represalias. No se investigaron las ordenanzas de la ciudad. Si faltan hechos o una exención, Rent Right no decide si algo es legal. Revisado el 8 de noviembre de 2026.`
    : `Statewide ${name} rules are loaded for repairs, deposits, rent notices, and retaliation. City ordinances were not researched. If facts or an exemption are missing, Rent Right does not decide that something is legal. Checked Nov 8, 2026.`;
}

export function rulesUnavailable(locale: Locale | "en" | "es", region: string): string {
  const name = stateName(region) || region.trim() || (locale === "es" ? "ese estado" : "that state");
  const lead = locale === "es"
    ? `Rent Right todavía no puede dar reglas para ${name}.`
    : `Rent Right can't give rules for ${name} yet.`;
  return `${lead} ${coverageNotice(locale)}`;
}
