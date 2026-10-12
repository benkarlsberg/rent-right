import { LIBRARY_VERSION } from "@/lib/disclaimer";
import { CITY_PACKS } from "@/lib/rules/cities";
import { rules as statewideRules } from "@/lib/rules/cities/statewide";
import { rule, type FindingLabel, type Rule, type RuleJurisdiction } from "@/lib/rules/define";

export { rule };
export type { FindingLabel, Rule, RuleJurisdiction };

export const RULES: Rule[] = [...statewideRules, ...CITY_PACKS.flatMap((pack) => pack.rules)];

const byId = new Map(RULES.map((item) => [item.id, item]));

export function getRule(id: string): Rule | undefined {
  return byId.get(id);
}

export function libraryIntegrityErrors(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of RULES) {
    if (ids.has(item.id)) errors.push(`duplicate ${item.id}`);
    ids.add(item.id);
    if (!item.placeholder) errors.push(`${item.id} placeholder`);
    if (item.clinicReview !== "pending_clinic_review") errors.push(`${item.id} clinic`);
    if (item.spanishReview !== "pending_volunteer_review") errors.push(`${item.id} spanish`);
    if (item.version !== LIBRARY_VERSION) errors.push(`${item.id} version`);
    if (!item.sourceUrl.startsWith("https://")) errors.push(`${item.id} url`);
    if (item.summaryEn.length < 40 || item.summaryEs.length < 40) errors.push(`${item.id} summary`);
    if (!item.citation || !item.titleEn || !item.titleEs) errors.push(`${item.id} labels`);
    if (item.findingLabel === "informational" && item.patterns.length > 0) {
      errors.push(`${item.id} informational pattern`);
    }
    if (item.findingLabel === "looks_standard" && item.patterns.length === 0) {
      errors.push(`${item.id} standard pattern`);
    }
  }
  return errors;
}
