export type ChatAction = { id: string; label: string };

export type ChatCard = {
  headline: string;
  status: string;
  action: ChatAction | null;
  actions?: ChatAction[];
  detail: string;
  ruleId: string | null;
};

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
    return {
      headline: value.headline,
      status: value.status,
      action,
      actions: actions.length ? actions : undefined,
      detail: value.detail,
      ruleId: typeof value.ruleId === "string" ? value.ruleId : null,
    };
  } catch {
    return null;
  }
}
