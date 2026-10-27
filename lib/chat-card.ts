import type { AddressParts } from "@/lib/address-format";

export type ChatAction = { id: string; label: string };

export type ChatCard = {
  headline: string;
  status: string;
  action: ChatAction | null;
  actions?: ChatAction[];
  detail: string;
  ruleId: string | null;
  address?: AddressParts | null;
  /** True only when this reply states a rule, citation, review, or deadline. */
  legal?: boolean;
  /** True when the open-issue next step belongs under this reply. */
  showSteps?: boolean;
  /** Urgent is a red label. A possible violation uses the neutral rules flag. */
  badge?: "urgent" | "violation";
};

export type CardKind = "prompt" | "cited" | "cited-quiet" | "cited-issue" | "issue";

/** One place decides whether a reply carries the legal-information flag and the chat next-step flag. */
export function flagCard(card: ChatCard, kind: CardKind = "prompt"): ChatCard {
  if (kind === "cited") return { ...card, legal: true };
  if (kind === "cited-quiet") return { ...card, legal: true, showSteps: false };
  if (kind === "cited-issue") return { ...card, legal: true, showSteps: true };
  if (kind === "issue") return { ...card, legal: false, showSteps: true };
  return { ...card, legal: false, showSteps: false };
}

/** Stored cards from before the flag fall back to a cited rule. A set flag always wins. */
export function replyShowsNotice(card: { legal?: boolean; ruleId?: string | null }): boolean {
  if (typeof card.legal === "boolean") return card.legal;
  return Boolean(card.ruleId);
}

const STEP_STOP = new Set(["this", "that", "with", "from", "your", "have", "been", "repair", "request", "about", "solicitud", "reparacion"]);

function issueWords(title: string): string[] {
  return title.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !STEP_STOP.has(word));
}

/** Chat shows next steps on the reply that logged or sent the issue, or when the tenant asked about that issue. */
export function chatTurnShowsSteps(rows: { role: string; content: string }[], issueTitles: string[]): boolean {
  const last = [...rows].reverse().find((row) => row.role !== "user");
  if (!last) return false;
  const card = parseCard(last.content);
  if (!card) return false;
  if (card.showSteps === true) return true;
  if (card.showSteps === false) return false;
  const user = [...rows].reverse().find((row) => row.role === "user");
  const text = (user?.content || "").toLowerCase();
  if (!text) return false;
  return issueTitles.some((title) => issueWords(title).some((word) => text.includes(word)));
}

export function serializeCard(card: ChatCard): string {
  return JSON.stringify({ v: 1, ...card });
}

/** A confirmed send replaces the waiting card. Any other stored card stays as it is. */
export function cardAfterSend(stored: string, confirmed: ChatCard): string {
  const card = parseCard(stored);
  if (!card?.action?.id.startsWith("send:")) return stored;
  return serializeCard(confirmed);
}

export function parseCard(content: string): ChatCard | null {
  if (!content.startsWith("{")) return null;
  try {
    const value = JSON.parse(content) as Partial<ChatCard> & { v?: number };
    if (value.v !== 1 || typeof value.headline !== "string" || typeof value.status !== "string" || typeof value.detail !== "string") return null;
    const action = value.action && typeof value.action.id === "string" && typeof value.action.label === "string" ? value.action : null;
    const actions = Array.isArray(value.actions)
      ? value.actions.filter((item): item is ChatAction => Boolean(item) && typeof item.id === "string" && typeof item.label === "string")
      : [];
    const address = readAddress(value.address);
    return {
      headline: value.headline,
      status: value.status,
      action,
      actions: actions.length ? actions : undefined,
      detail: value.detail,
      ruleId: typeof value.ruleId === "string" ? value.ruleId : null,
      ...(address ? { address } : {}),
      ...(typeof value.legal === "boolean" ? { legal: value.legal } : {}),
      ...(typeof value.showSteps === "boolean" ? { showSteps: value.showSteps } : {}),
      ...(value.badge === "urgent" || value.badge === "violation" ? { badge: value.badge } : {}),
    };
  } catch {
    return null;
  }
}

function readAddress(value: unknown): AddressParts | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.street !== "string" || typeof row.city !== "string") return null;
  return {
    street: row.street,
    unit: typeof row.unit === "string" ? row.unit : "",
    city: row.city,
    region: typeof row.region === "string" ? row.region : "",
    postalCode: typeof row.postalCode === "string" ? row.postalCode : "",
  };
}
