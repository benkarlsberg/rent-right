import type { Locale } from "@/lib/disclaimer";
import { stateName } from "@/lib/us-address";

export const COVERAGE_NOTICE_EN =
  "Rent Right only covers California law right now. You can still log issues, keep photos, and email your landlord, but rules, legal deadlines, and law citations won't apply to your home.";

export const COVERAGE_NOTICE_ES =
  "Rent Right solo cubre la ley de California por ahora. Aún puede anotar problemas, guardar fotos y escribirle a su propietario, pero las reglas, los plazos legales y las citas de leyes no aplican a su vivienda.";

export function coverageNotice(locale: Locale | "en" | "es" = "en"): string {
  return locale === "es" ? COVERAGE_NOTICE_ES : COVERAGE_NOTICE_EN;
}

export function coversLaw(unit: { supported?: boolean; jurisdiction?: string } | null | undefined): boolean {
  if (!unit) return true;
  if (unit.supported === false) return false;
  if (unit.jurisdiction === "unsupported") return false;
  return true;
}

export function rulesUnavailable(locale: Locale | "en" | "es", region: string): string {
  const name = stateName(region) || region.trim() || (locale === "es" ? "ese estado" : "that state");
  const lead = locale === "es"
    ? `Rent Right todavía no puede dar reglas para ${name}.`
    : `Rent Right can't give rules for ${name} yet.`;
  return `${lead} ${coverageNotice(locale)}`;
}
