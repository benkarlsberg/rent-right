import type { Locale } from "@/lib/disclaimer";
import { aiConfigured, completeJson } from "@/lib/ai";
import { detectIntent, fold } from "@/lib/chat-intent";
import { rulesPrompt } from "@/lib/chat-text";
import { answerFromModelIds, answerQuestion, selectRules, type AssistantAnswer } from "@/lib/rules/assistant";
import type { LawState } from "@/lib/rules/states";

const FOLLOW_UP = /\b(?:what about|how about|and (?:the|that)|the (?:first|second|other|same|last) (?:one|item)|y (?:el|la|lo) (?:primero|segundo|otro)|que hay con|que pasa con)\b/;

/** A short reference can use the rules already in the conversation. A new question cannot. */
export function inheritsPriorRules(question: string): boolean {
  const value = fold(question);
  if (!value || value.length > 160 || !FOLLOW_UP.test(value)) return false;
  const intent = detectIntent(question, null);
  return intent === "rights" || intent === "unclear";
}

/** Library text only. A short follow-up can cite rules matched in the recent conversation. Model ids are kept only when they are in that set. */
export function citeFromConversation(question: string, locale: Locale, retrieval: string, modelIds: string[] | null, state: LawState = "CA", local?: string | null): AssistantAnswer {
  const alone = selectRules(question, state, local);
  const followUp = inheritsPriorRules(question);
  const retrieved = selectRules(followUp ? (retrieval || question) : question, state, local);
  const pool = followUp ? retrieved.rules : alone.rules;
  const allowed = new Set(pool.map((rule) => rule.id));
  const picked = (modelIds ?? []).filter((id) => allowed.has(id));
  if (picked.length > 0) return answerFromModelIds(question, locale, pool, picked);
  if (followUp && alone.rules.length === 0 && retrieved.rules.length > 0) {
    return answerFromModelIds(question, locale, retrieved.rules, retrieved.rules.map((rule) => rule.id));
  }
  return answerQuestion(question, locale, state, local);
}

export async function answerFromConversation(question: string, locale: Locale, history: string, retrieval: string, state: LawState = "CA", local?: string | null): Promise<AssistantAnswer> {
  const followUp = inheritsPriorRules(question);
  const source = followUp && retrieval ? retrieval : question;
  const retrieved = selectRules(source, state, local);
  let modelIds: string[] | null = null;
  if (retrieved.rules.length > 0 && aiConfigured()) {
    const completed = await completeJson("lite", rulesPrompt(followUp ? history : "", question, retrieved.rules));
    const ids = (completed?.json as { ruleIds?: string[] } | undefined)?.ruleIds;
    if (completed && Array.isArray(ids)) modelIds = ids;
  }
  return citeFromConversation(question, locale, followUp ? retrieval : "", modelIds, state, local);
}
