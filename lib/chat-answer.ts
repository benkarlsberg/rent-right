import type { Locale } from "@/lib/disclaimer";
import { aiConfigured, completeJson } from "@/lib/ai";
import { rulesPrompt } from "@/lib/chat-text";
import { answerFromModelIds, answerQuestion, selectRules, type AssistantAnswer } from "@/lib/rules/assistant";

/** Library text only. A short follow-up can cite rules matched in the recent conversation. Model ids are kept only when they are in that set. */
export function citeFromConversation(question: string, locale: Locale, retrieval: string, modelIds: string[] | null): AssistantAnswer {
  const alone = selectRules(question);
  const retrieved = selectRules(retrieval || question);
  const allowed = new Set(retrieved.rules.map((rule) => rule.id));
  const picked = (modelIds ?? []).filter((id) => allowed.has(id));
  if (picked.length > 0) return answerFromModelIds(question, locale, retrieved.rules, picked);
  if (alone.rules.length === 0 && retrieved.rules.length > 0) {
    return answerFromModelIds(question, locale, retrieved.rules, retrieved.rules.map((rule) => rule.id));
  }
  return answerQuestion(question, locale);
}

export async function answerFromConversation(question: string, locale: Locale, history: string, retrieval: string): Promise<AssistantAnswer> {
  const retrieved = selectRules(retrieval || question);
  let modelIds: string[] | null = null;
  if (retrieved.rules.length > 0 && aiConfigured()) {
    const completed = await completeJson("lite", rulesPrompt(history, question, retrieved.rules));
    const ids = (completed?.json as { ruleIds?: string[] } | undefined)?.ruleIds;
    if (completed && Array.isArray(ids)) modelIds = ids;
  }
  return citeFromConversation(question, locale, retrieval, modelIds);
}
