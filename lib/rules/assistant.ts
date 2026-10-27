import { DISCLAIMER_EN, DISCLAIMER_ES, LIBRARY_VERSION, type Locale } from "@/lib/disclaimer";
import { RULES, type Rule } from "@/lib/rules/library";

export type AssistantAnswer = {
  locale: Locale;
  unsure: boolean;
  handoff: boolean;
  text: string;
  ruleIds: string[];
  disclaimer: string;
  rulesVersion: string;
  clinicReview: "pending_clinic_review";
  spanishReview: "pending_volunteer_review";
};

const STOP = new Set(
  `a an the of to and or for my your is are was were on in it this that with how what when does do did can not no landlord tenant i me we our us
  el la los las de del y o para mi su es son en un una que cómo como cuando cual cuál mi su no inquilino propietario`.split(/\s+/),
);

const HANDOFF =
  /\b(how do i|what should i do|beat the|win my|fight this eviction|stop the eviction|withhold rent|court tomorrow|qu[eé] debo hacer|c[oó]mo gano|c[oó]mo detengo el desalojo)\b/i;

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9%]+/)
    .filter((token) => token.length > 2 && !STOP.has(token));
}

function score(rule: Rule, queryTokens: string[], raw: string): number {
  const anchor = tokens([rule.titleEn, rule.titleEs, rule.topic, rule.topics.join(" "), rule.citation].join(" "));
  const set = new Set(anchor);
  let total = 0;
  for (const token of queryTokens) {
    if (set.has(token)) total += token.length >= 6 ? 2 : 1;
  }
  if (total === 0) return 0;
  const lower = raw.toLowerCase();
  if (/san diego/.test(lower) && rule.jurisdiction === "CITY_SD") total += 3;
  if ((/los angeles|rso/.test(lower)) && rule.jurisdiction === "CITY_LA") total += 3;
  if (/unincorporated|rstpo|no incorpor/.test(lower) && rule.jurisdiction === "LA_COUNTY") total += 3;
  if (/\b(deposit|deposito|depósito)\b/i.test(raw) && rule.topic === "deposit") total += 3;
  if (/\b21\b/.test(raw) && rule.id === "CA-CC-1950.5") total += 2;
  if (/1482|rent cap|tope/.test(lower) && rule.id === "CA-CC-1947.12") total += 3;
  if (/\b(notice|aviso)\b/.test(lower) && /\b(rent increase|aumento de renta)\b/.test(lower) && rule.id === "CA-CC-827") total += 6;
  if (rule.id === "CA-GUIDE-ORDINARY-RENT") {
    if (!/\b(clause|lease|monthly|renta mensual)\b/i.test(raw)) return 0;
    total += 4;
  }
  if (/just cause|causa justa/.test(lower) && rule.topic === "just-cause") total += 2;
  return total;
}

export function selectRules(question: string): { rules: Rule[]; handoff: boolean } {
  const handoff = HANDOFF.test(question);
  const queryTokens = tokens(question);
  const ranked = RULES.map((rule) => ({ rule, score: score(rule, queryTokens, question) }))
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score);
  return { rules: ranked.slice(0, 3).map((item) => item.rule), handoff };
}

export function renderAnswer(question: string, locale: Locale, rules: Rule[], handoff: boolean): AssistantAnswer {
  const disclaimer = locale === "es" ? DISCLAIMER_ES : DISCLAIMER_EN;
  const reviewNote =
    locale === "es"
      ? "El texto en español de la biblioteca está pendiente de revisión por voluntarios."
      : "Spanish library text is pending volunteer review.";
  if (rules.length === 0) {
    const handoffLead = handoff
      ? locale === "es"
        ? "Rent Right no puede decirle qué hacer en un caso, ni cómo responder a un aviso de desalojo. Contacte a asistencia legal o a un abogado con licencia. "
        : "Rent Right cannot tell you what to do in a case, or how to respond to an eviction notice. Contact legal aid or a licensed attorney. "
      : "";
    const text =
      locale === "es"
        ? `${handoffLead}No se puede precisar. La biblioteca ${LIBRARY_VERSION} no tiene una regla que coincida con esta pregunta lo bastante como para citarla. Si se trata de un aviso de desalojo, papeles de la corte o plazos de su caso, contacte a asistencia legal. ${reviewNote}`
        : `${handoffLead}Unsure. Rules library ${LIBRARY_VERSION} does not contain a rule that matches this question closely enough to cite. If this is about an eviction notice, court papers, or a deadline in your case, contact legal aid. ${reviewNote}`;
    return {
      locale,
      unsure: true,
      handoff,
      text,
      ruleIds: [],
      disclaimer,
      rulesVersion: LIBRARY_VERSION,
      clinicReview: "pending_clinic_review",
      spanishReview: "pending_volunteer_review",
    };
  }

  const blocks = rules.map((rule) => {
    const title = locale === "es" ? rule.titleEs : rule.titleEn;
    const summary = locale === "es" ? rule.summaryEs : rule.summaryEn;
    return `${title}\nRule ID: ${rule.id}\nCitation: ${rule.citation}\nSource: ${rule.sourceUrl}\n\n"${summary}"`;
  });
  const lead = handoff
    ? locale === "es"
      ? "Rent Right no puede decirle qué hacer en un caso, ni cómo responder a un aviso de desalojo. Contacte a asistencia legal o a un abogado con licencia. Lo que sigue es solo el texto de la biblioteca.\n\n"
      : "Rent Right cannot tell you what to do in a case, or how to respond to an eviction notice. Contact legal aid or a licensed attorney. What follows is only the library text.\n\n"
    : "";
  const tail =
    locale === "es"
      ? `\n\nBiblioteca ${LIBRARY_VERSION}. Cada ficha es un borrador pendiente de revisión clínica. ${reviewNote}`
      : `\n\nLibrary ${LIBRARY_VERSION}. Each entry is a draft pending clinic review. ${reviewNote}`;
  return {
    locale,
    unsure: false,
    handoff,
    text: `${lead}${blocks.join("\n\n")}${tail}`,
    ruleIds: rules.map((rule) => rule.id),
    disclaimer,
    rulesVersion: LIBRARY_VERSION,
    clinicReview: "pending_clinic_review",
    spanishReview: "pending_volunteer_review",
  };
}

export function answerQuestion(question: string, locale: Locale): AssistantAnswer {
  const selected = selectRules(question);
  return renderAnswer(question, locale, selected.rules, selected.handoff);
}

/** Model output may only name rule ids that were retrieved. The words shown to the tenant still come from the library. */
export function answerFromModelIds(question: string, locale: Locale, retrieved: Rule[], modelIds: string[]): AssistantAnswer {
  const allowed = new Set(retrieved.map((rule) => rule.id));
  const picked = modelIds.filter((id) => allowed.has(id)).map((id) => retrieved.find((rule) => rule.id === id)!);
  const handoff = HANDOFF.test(question);
  if (picked.length === 0) return renderAnswer(question, locale, [], handoff);
  return renderAnswer(question, locale, picked.slice(0, 3), handoff);
}
