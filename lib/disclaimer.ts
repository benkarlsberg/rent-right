/** Exact English wording from the product liability plan. Do not paraphrase. */
export const DISCLAIMER_EN =
  "This is general legal information, not legal advice, and no attorney-client relationship is created. Laws change and depend on your facts. For advice, contact a licensed California attorney or legal aid.";

export const DISCLAIMER_ES =
  "Esta es información legal general, no es asesoramiento legal, y no se crea una relación abogado-cliente. Las leyes cambian y dependen de los hechos de su caso. Para asesoramiento, contacte a un abogado con licencia en California o a asistencia legal gratuita.";

/** The date on the rules catalog. User-facing text uses this, not an internal review flag. */
export const LIBRARY_CHECKED_EN = "Oct 12, 2026";
export const LIBRARY_CHECKED_ES = "12 de octubre de 2026";

export const CLINIC_REVIEW_BANNER_EN =
  `These notes cite public California statutes and official pages. They were checked ${LIBRARY_CHECKED_EN}. They are general information, not legal advice, and they are not a lawyer's review.`;

export const CLINIC_REVIEW_BANNER_ES =
  `Estas notas citan leyes públicas de California y páginas oficiales. Se revisaron el ${LIBRARY_CHECKED_ES}. Son información general, no asesoramiento legal, y no son la revisión de un abogado.`;

/** Always visible on a legal result. The full disclaimer opens from "Learn more". */
export const DISCLAIMER_SHORT_EN = "General information, not legal advice.";
export const DISCLAIMER_SHORT_ES = "Información general, no es asesoramiento legal.";

export const CLINIC_SHORT_EN = `General information based on California law, checked ${LIBRARY_CHECKED_EN}. Not legal advice.`;
export const CLINIC_SHORT_ES = `Información general basada en la ley de California, revisada el ${LIBRARY_CHECKED_ES}. No es asesoramiento legal.`;

export const LIBRARY_VERSION = "2026-10-12-draft1";

export type Locale = "en" | "es";

export function disclaimer(locale: Locale): string {
  return locale === "es" ? DISCLAIMER_ES : DISCLAIMER_EN;
}

export function clinicBanner(locale: Locale): string {
  return locale === "es" ? CLINIC_REVIEW_BANNER_ES : CLINIC_REVIEW_BANNER_EN;
}

export function disclaimerShort(locale: Locale): string {
  return locale === "es" ? DISCLAIMER_SHORT_ES : DISCLAIMER_SHORT_EN;
}

export function clinicShort(locale: Locale): string {
  return locale === "es" ? CLINIC_SHORT_ES : CLINIC_SHORT_EN;
}

export type LegalNotice = {
  short: string;
  full: string;
  clinicShort: string;
  clinicFull: string;
};

export function legalNotice(locale: Locale): LegalNotice {
  return {
    short: disclaimerShort(locale),
    full: disclaimer(locale),
    clinicShort: clinicShort(locale),
    clinicFull: clinicBanner(locale),
  };
}
