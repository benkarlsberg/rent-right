import { DISCLAIMER_EN, LIBRARY_VERSION } from "@/lib/disclaimer";
import type { Jurisdiction } from "@/lib/rules/engine";
import { RULES, type FindingLabel, type Rule, getRule } from "@/lib/rules/library";

export type LeaseLabel = FindingLabel | "unsure";

export type LeaseFinding = {
  id: string;
  clauseIndex: number;
  quote: string;
  label: LeaseLabel;
  ruleId: string | null;
  citation: string | null;
  sourceUrl: string | null;
  confidence: "high" | "medium" | "low";
  reasonEn: string;
  reasonEs: string;
};

export type LeaseReview = {
  rulesVersion: string;
  clinicReview: "pending_clinic_review";
  model: string | null;
  findings: LeaseFinding[];
  disclaimer: string;
  extractedCharCount: number;
};

const BAD_IN_RENT = /waiv|non-?refundable|without notice|penalty|jury|just[\s-]?cause|attorney/i;

export function redactPii(text: string): string {
  return text
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, "[phone]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]");
}

export function segmentClauses(text: string): string[] {
  const cleaned = text.replace(/\r/g, "").trim();
  if (!cleaned) return [];
  let parts = cleaned.split(/\n\s*\n/);
  if (parts.length < 3) {
    parts = cleaned.split(/\n(?=\s*\d+[\.\)]\s)/);
  }
  const clauses: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length < 30) continue;
    if (trimmed.length > 900) {
      const sentences = trimmed.split(/(?<=\.)\s+(?=[A-Z])/);
      for (const sentence of sentences) {
        if (sentence.trim().length >= 30) clauses.push(sentence.trim());
      }
    } else {
      clauses.push(trimmed);
    }
  }
  return clauses.slice(0, 80);
}

function quoteOf(clause: string): string {
  const compact = clause.replace(/\s+/g, " ").trim();
  return compact.length > 700 ? `${compact.slice(0, 697)}...` : compact;
}

function findingFrom(rule: Rule, clause: string, index: number, n: number): LeaseFinding {
  return {
    id: `c${index}-${rule.id}-${n}`,
    clauseIndex: index,
    quote: quoteOf(clause),
    label: rule.findingLabel === "informational" ? "check_this" : rule.findingLabel,
    ruleId: rule.id,
    citation: rule.citation,
    sourceUrl: rule.sourceUrl,
    confidence: rule.confidence,
    reasonEn: rule.reasonEn,
    reasonEs: rule.reasonEs,
  };
}

function unsure(clause: string, index: number): LeaseFinding {
  return {
    id: `c${index}-unsure`,
    clauseIndex: index,
    quote: quoteOf(clause),
    label: "unsure",
    ruleId: null,
    citation: null,
    sourceUrl: null,
    confidence: "low",
    reasonEn: `Unsure. Rules library ${LIBRARY_VERSION} does not contain a rule that matches this clause closely enough to cite. This is not a statement that the clause is lawful.`,
    reasonEs: `No se puede precisar. La biblioteca ${LIBRARY_VERSION} no tiene una regla que coincida con esta cláusula lo bastante como para citarla. Esto no significa que la cláusula sea legal.`,
  };
}

function dollarsToCents(raw: string): number {
  return Math.round(Number(raw.replace(/,/g, "")) * 100);
}

export function reviewClause(
  clause: string,
  index: number,
  context: { monthlyRentCents?: number | null; jurisdiction?: Jurisdiction | null },
): LeaseFinding[] {
  const hits: LeaseFinding[] = [];
  for (const rule of RULES) {
    if (rule.patterns.length === 0) continue;
    if (rule.id === "LA-JUST-CAUSE" && context.jurisdiction !== "city_la") continue;
    if (rule.id === "SD-TPG-JUST-CAUSE" && context.jurisdiction !== "city_sd") continue;
    if (!rule.patterns.some((pattern) => pattern.test(clause))) continue;
    if (rule.id === "CA-GUIDE-ORDINARY-RENT" && BAD_IN_RENT.test(clause)) continue;
    hits.push(findingFrom(rule, clause, index, hits.length));
  }

  if (context.monthlyRentCents && context.monthlyRentCents > 0 && /deposit|dep[oó]sito/i.test(clause)) {
    const amounts = [...clause.matchAll(/\$\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.(\d{2}))?/g)].map((match) =>
      dollarsToCents(match[2] ? `${match[1]}.${match[2]}` : match[1]),
    );
    const largest = amounts.sort((a, b) => b - a)[0];
    const cap = getRule("CA-CC-1950.5-CAP");
    if (largest && cap && largest > context.monthlyRentCents) {
      const overTwo = largest > context.monthlyRentCents * 2;
      hits.push({
        ...findingFrom(cap, clause, index, hits.length),
        label: overTwo ? "likely_unenforceable" : "check_this",
        confidence: overTwo ? "high" : "medium",
        reasonEn: overTwo
          ? `${cap.reasonEn} The amount in the clause is more than two months of the rent on the profile, which is above both the general cap and the small-landlord ceiling described in the library.`
          : cap.reasonEn,
        reasonEs: overTwo
          ? `${cap.reasonEs} El monto de la cláusula es más de dos meses de la renta del perfil, por encima del tope general y del techo de pequeño propietario descrito en la biblioteca.`
          : cap.reasonEs,
      });
    }
  }

  const meaningful = hits.filter((hit) => hit.label !== "looks_standard");
  const kept = meaningful.length > 0 ? meaningful : hits;
  if (kept.length === 0) return [unsure(clause, index)];
  return kept.slice(0, 4);
}

export function reviewLease(
  text: string,
  context: { monthlyRentCents?: number | null; jurisdiction?: Jurisdiction | null } = {},
): LeaseReview {
  const clauses = segmentClauses(text);
  const findings = clauses.flatMap((clause, index) => reviewClause(clause, index, context));
  return {
    rulesVersion: LIBRARY_VERSION,
    clinicReview: "pending_clinic_review",
    model: null,
    findings: findings.length > 0 ? findings : [unsure(text || "(empty upload)", 0)],
    disclaimer: DISCLAIMER_EN,
    extractedCharCount: text.length,
  };
}

export type ModelFinding = {
  quote?: string;
  ruleId?: string;
  label?: string;
};

function normalized(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** A model may only fill clauses the library left as unsure, and only with a real rule id and a real quote. */
export function mergeModelFindings(review: LeaseReview, sourceText: string, modelFindings: ModelFinding[], modelName: string): LeaseReview {
  const clauses = segmentClauses(sourceText);
  const allowed = new Set(RULES.map((item) => item.id));
  const next = review.findings.map((finding) => ({ ...finding }));
  for (const proposed of modelFindings) {
    if (!proposed.quote || !proposed.ruleId || !allowed.has(proposed.ruleId)) continue;
    const rule = getRule(proposed.ruleId);
    if (!rule || rule.findingLabel === "informational") continue;
    const clauseIndex = clauses.findIndex((clause) => normalized(clause).includes(normalized(proposed.quote!).slice(0, 80)));
    if (clauseIndex < 0) continue;
    const existing = next.filter((item) => item.clauseIndex === clauseIndex);
    if (existing.some((item) => item.label !== "unsure")) continue;
    const quote = proposed.quote.replace(/\s+/g, " ").trim();
    if (!normalized(clauses[clauseIndex]).includes(normalized(quote).slice(0, 40))) continue;
    const replacement: LeaseFinding = {
      id: `c${clauseIndex}-${rule.id}-model`,
      clauseIndex,
      quote: quoteOf(clauses[clauseIndex]),
      label: rule.findingLabel,
      ruleId: rule.id,
      citation: rule.citation,
      sourceUrl: rule.sourceUrl,
      confidence: "low",
      reasonEn: rule.reasonEn,
      reasonEs: rule.reasonEs,
    };
    const without = next.filter((item) => item.clauseIndex !== clauseIndex);
    without.push(replacement);
    next.length = 0;
    next.push(...without);
  }
  next.sort((a, b) => a.clauseIndex - b.clauseIndex);
  return { ...review, findings: next, model: modelName };
}

export const LEASE_REVIEW_MONTHLY_CAP = 3;
