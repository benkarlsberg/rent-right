export type LawChoice = "yes" | "no" | "unsure";

export type SpecialKind = "tn" | "ky" | "nyc";

export function specialKind(jurisdiction: string | null | undefined): SpecialKind | null {
  if (jurisdiction === "tn") return "tn";
  if (jurisdiction === "ky") return "ky";
  if (jurisdiction === "city_nyc") return "nyc";
  return null;
}

export function lawChoiceOf(value: string | null | undefined): LawChoice {
  return value === "yes" || value === "no" ? value : "unsure";
}
