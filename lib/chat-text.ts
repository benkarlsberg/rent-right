import { decryptString, encryptString } from "@/lib/crypto";
import { redactPii } from "@/lib/lease/review";

export const CHAT_HISTORY_TURNS = 6;
export const CHAT_HISTORY_CHARS = 2000;

const CIPHER_PART = /^[A-Za-z0-9_-]+$/;

export type ChatTurn = { role: string; content: string };

export function looksLikeCiphertext(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0 && CIPHER_PART.test(part));
}

export function readChatText(value: string): string {
  if (!looksLikeCiphertext(value)) return value;
  try {
    return decryptString(value);
  } catch {
    return value;
  }
}

export function isCiphertext(value: string): boolean {
  if (!looksLikeCiphertext(value)) return false;
  try {
    decryptString(value);
    return true;
  } catch {
    return false;
  }
}

export function encryptChatText(plain: string): string {
  return encryptString(plain);
}

export function sealDraftPayload(payload: Record<string, unknown>): string {
  return encryptChatText(JSON.stringify(payload));
}

export function openDraftPayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value) return {};
  const text = readChatText(value);
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function label(role: string): string {
  return role === "user" ? "Tenant" : "Assistant";
}

function cleanTurn(turn: ChatTurn): ChatTurn | null {
  const content = redactPii(turn.content).replace(/\s+/g, " ").trim();
  if (!content) return null;
  return { role: turn.role, content };
}

/** Last 6 turns, redacted, dropped from the oldest until the block fits in about 2,000 characters. */
export function cappedTurns(turns: ChatTurn[]): ChatTurn[] {
  let kept = turns.slice(-CHAT_HISTORY_TURNS).map(cleanTurn).filter((turn): turn is ChatTurn => turn != null);
  while (kept.length > 1 && kept.map((turn) => `${label(turn.role)}: ${turn.content}`).join("\n").length > CHAT_HISTORY_CHARS) {
    kept = kept.slice(1);
  }
  if (kept.length === 1) {
    const line = `${label(kept[0].role)}: ${kept[0].content}`;
    if (line.length > CHAT_HISTORY_CHARS) {
      const room = Math.max(0, CHAT_HISTORY_CHARS - label(kept[0].role).length - 2);
      kept = [{ role: kept[0].role, content: kept[0].content.slice(kept[0].content.length - room) }];
    }
  }
  return kept;
}

export function chatContext(turns: ChatTurn[]): { history: string; retrieval: string } {
  const kept = cappedTurns(turns);
  return {
    history: kept.map((turn) => `${label(turn.role)}: ${turn.content}`).join("\n"),
    retrieval: kept.map((turn) => turn.content).join("\n"),
  };
}

export function formatChatHistory(turns: ChatTurn[]): string {
  return chatContext(turns).history;
}

export function historyPrompt(history: string): string {
  const trimmed = history.trim();
  if (!trimmed) return "";
  return `Recent conversation:\n${trimmed}\n`;
}

export function intentPrompt(history: string, message: string): string {
  return `Choose one intent for this tenant message. Reply JSON {"intent":"repair"} or lease, rent, deposit, packet, deadlines, rights, or unclear. Do not include numbers, dates, or advice.\n${historyPrompt(history)}Message: ${message.slice(0, 500)}`;
}

export function rulesPrompt(history: string, question: string, rules: { id: string; titleEn: string }[]): string {
  const list = rules.map((rule) => `${rule.id}: ${rule.titleEn}`).join("\n");
  return `Pick up to 3 rule IDs from this list that answer the tenant. If none fit, return {"ruleIds":[]}. JSON only. Do not add advice.\n${historyPrompt(history)}Question: ${question.slice(0, 500)}\n${list}`;
}
