/** Exact English wording from the product liability plan. Do not paraphrase. */
export const DISCLAIMER_EN =
  "This is general legal information, not legal advice, and no attorney-client relationship is created. Laws change and depend on your facts. For advice, contact a licensed California attorney or legal aid.";

export const DISCLAIMER_ES =
  "Esta es información legal general, no es asesoramiento legal, y no se crea una relación abogado-cliente. Las leyes cambian y dependen de los hechos de su caso. Para asesoramiento, contacte a un abogado con licencia en California o a asistencia legal gratuita.";

export const CLINIC_REVIEW_BANNER_EN =
  "Rules library placeholder. Entries cite official government sources and are flagged for review by a law-school clinic or legal aid partner. They have not been approved for launch.";

export const CLINIC_REVIEW_BANNER_ES =
  "Biblioteca de reglas provisional. Las fichas citan fuentes oficiales del gobierno y están marcadas para revisión por una clínica de una facultad de derecho o por asistencia legal. Aún no están aprobadas para el lanzamiento.";

export const LIBRARY_VERSION = "2026-10-12-draft1";

export type Locale = "en" | "es";

export function disclaimer(locale: Locale): string {
  return locale === "es" ? DISCLAIMER_ES : DISCLAIMER_EN;
}

export function clinicBanner(locale: Locale): string {
  return locale === "es" ? CLINIC_REVIEW_BANNER_ES : CLINIC_REVIEW_BANNER_EN;
}
