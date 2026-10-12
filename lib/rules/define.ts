import { LIBRARY_VERSION } from "@/lib/disclaimer";

export type RuleJurisdiction = "CA" | "CITY_LA" | "LA_COUNTY" | "CITY_SD" | "LOCAL";
export type FindingLabel = "likely_unenforceable" | "check_this" | "looks_standard" | "informational";

export type Rule = {
  id: string;
  version: string;
  jurisdiction: RuleJurisdiction;
  topic: string;
  topics: string[];
  titleEn: string;
  titleEs: string;
  summaryEn: string;
  summaryEs: string;
  citation: string;
  sourceName: string;
  sourceUrl: string;
  clinicReview: "pending_clinic_review";
  spanishReview: "pending_volunteer_review";
  placeholder: true;
  findingLabel: FindingLabel;
  confidence: "high" | "medium" | "low";
  reasonEn: string;
  reasonEs: string;
  patterns: RegExp[];
};

export function rule(partial: Omit<Rule, "version" | "clinicReview" | "spanishReview" | "placeholder">): Rule {
  return {
    ...partial,
    version: LIBRARY_VERSION,
    clinicReview: "pending_clinic_review",
    spanishReview: "pending_volunteer_review",
    placeholder: true,
  };
}
