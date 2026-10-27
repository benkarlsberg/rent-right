import { randomUUID } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { citeFromConversation } from "@/lib/chat-answer";
import { privacyDocument } from "@/lib/legal-html";
import { auditChat, backfillChat } from "@/lib/chat-backfill";
import { CHAT_HISTORY_CHARS, formatChatHistory, isCiphertext, readChatText } from "@/lib/chat-text";
import { ChatTurnDone, runChatTurn } from "@/lib/chat-turn";
import {
  addAssistantMessage,
  archiveChat,
  assistantMessageContent,
  countAssistantThisMonth,
  createChatDraft,
  createNamedUser,
  createUnit,
  listAssistant,
  openChatDraft,
  type UnitInput,
} from "@/lib/db";
import { getSql } from "@/lib/pg";

const prompts = vi.hoisted(() => ({ all: [] as string[] }));

vi.mock("@/lib/ai", () => ({
  aiConfigured: () => true,
  completeJson: async (_kind: string, prompt: string) => {
    prompts.all.push(prompt);
    if (prompt.startsWith("Choose one intent")) return { model: "test", json: { intent: "rights" } };
    const id = prompt.match(/\bCA-CC-1950\.5\b/)?.[0];
    return { model: "test", json: { ruleIds: id ? [id] : [] } };
  },
  extractImageText: async () => null,
}));

function unitInput(street: string): UnitInput {
  return {
    street,
    unitNumber: "3",
    city: "Los Angeles",
    postalCode: "90026",
    region: "Los Angeles County",
    jurisdiction: "city_la",
    jurisdictionConfirmed: true,
    rsoStatus: "unsure",
    rstpoTier: "unsure",
    landlordName: "Elena Vasquez",
    landlordEmail: "elena.vasquez@example.com",
    landlordPhone: "",
    rentCents: 215_000,
    depositCents: null,
    moveInDate: "2024-05-01",
    leaseEndDate: null,
  };
}

function historyBlock(prompt: string): string {
  const marker = "Recent conversation:\n";
  const start = prompt.indexOf(marker);
  if (start < 0) return "";
  const from = start + marker.length;
  const ends = ["\nMessage:", "\nQuestion:"].map((token) => prompt.indexOf(token, from)).filter((index) => index >= 0);
  const end = ends.length ? Math.min(...ends) : prompt.length;
  return prompt.slice(from, end);
}

describe("chat text at rest", () => {
  it("round-trips encrypted chat and still reads a legacy plaintext row", async () => {
    const user = await createNamedUser(`chat-enc-${Date.now()}@example.com`, "Maya Chen");
    const unit = await createUnit(user.id, unitInput(`${Date.now()} Echo Park Ave`));
    const plain = "The sink is leaking under the cabinet.";
    const id = await addAssistantMessage(user.id, unit.id, "user", {
      locale: "en",
      content: plain,
      ruleIds: [],
      unsure: false,
    });
    const stored = await getSql()<{ content: string }[]>`select content from assistant_messages where id = ${id}`;
    expect(stored[0]?.content).not.toBe(plain);
    expect(isCiphertext(stored[0]?.content || "")).toBe(true);
    expect(await assistantMessageContent(user.id, id)).toBe(plain);
    expect((await listAssistant(user.id)).find((row) => row.id === id)?.content).toBe(plain);

    const legacyId = randomUUID();
    const legacy = "hello from before encryption";
    await getSql()`insert into assistant_messages (id, user_id, role, locale, content, created_at) values (${legacyId}, ${user.id}, 'user', 'en', ${legacy}, now())`;
    expect(await assistantMessageContent(user.id, legacyId)).toBe(legacy);
    expect((await listAssistant(user.id)).find((row) => row.id === legacyId)?.content).toBe(legacy);

    const draft = await createChatDraft(user.id, unit.id, "letter", { text: "Please return the deposit. Email ada@example.com" });
    const rawDraft = await getSql()<{ payload: unknown }[]>`select payload from chat_drafts where id = ${draft.id}`;
    const rawPayload = rawDraft[0]?.payload;
    expect(typeof rawPayload).toBe("string");
    expect(String(rawPayload)).not.toContain("ada@example.com");
    expect(isCiphertext(String(rawPayload))).toBe(true);
    expect((await openChatDraft(user.id))?.payload.text).toBe("Please return the deposit. Email ada@example.com");

    const legacyDraftId = randomUUID();
    await getSql()`
      insert into chat_drafts (id, user_id, unit_id, kind, payload, status, created_at)
      values (${legacyDraftId}, ${user.id}, ${unit.id}, 'repair', ${getSql().json({ text: "Leaky pipe under the sink" })}, 'open', now())
    `;
    await getSql()`update chat_drafts set status = 'cancelled' where id = ${draft.id}`;
    expect((await openChatDraft(user.id))?.payload.text).toBe("Leaky pipe under the sink");

    expect(await countAssistantThisMonth(user.id, "2026-10-01")).toBe(2);
  });

  it("encrypts existing plaintext rows once and links them inside each cleared chat", async () => {
    const user = await createNamedUser(`chat-link-${Date.now()}@example.com`, "Maya Chen");
    const unit = await createUnit(user.id, unitInput(`${Date.now()} Sunset Blvd`));
    const start = Date.parse("2026-10-02T00:00:00.000Z");
    const at = (step: number) => new Date(start + step * 1000).toISOString();
    const answer = { locale: "en", ruleIds: [] as string[], unsure: false };
    const firstUser = await addAssistantMessage(user.id, unit.id, "user", { ...answer, content: "first question", createdAt: at(1) });
    const firstAssistant = await addAssistantMessage(user.id, unit.id, "assistant", { ...answer, content: "first answer", createdAt: at(2) });
    const secondAssistant = await addAssistantMessage(user.id, unit.id, "assistant", { ...answer, content: "second card", createdAt: at(3) });
    const secondUser = await addAssistantMessage(user.id, unit.id, "user", { ...answer, content: "follow up", createdAt: at(4) });
    await runChatTurn(user, unit, { action: "clear" });
    const nextUser = await addAssistantMessage(user.id, unit.id, "user", { ...answer, content: "new thread", createdAt: at(5) });

    const rows = await getSql()<{ id: string; conversation_id: string | null; reply_to_id: string | null; archived_at: string | null }[]>`
      select id, conversation_id, reply_to_id, archived_at
      from assistant_messages
      where user_id = ${user.id}
      order by created_at
    `;
    const byId = new Map(rows.map((row) => [row.id, row]));
    const firstConversation = byId.get(firstUser)?.conversation_id;
    expect(firstConversation).toBeTruthy();
    expect(byId.get(firstAssistant)?.conversation_id).toBe(firstConversation);
    expect(byId.get(secondAssistant)?.conversation_id).toBe(firstConversation);
    expect(byId.get(secondUser)?.conversation_id).toBe(firstConversation);
    expect(byId.get(firstUser)?.reply_to_id).toBeNull();
    expect(byId.get(firstAssistant)?.reply_to_id).toBe(firstUser);
    expect(byId.get(secondAssistant)?.reply_to_id).toBe(firstUser);
    expect(byId.get(secondUser)?.reply_to_id).toBe(secondAssistant);
    expect(byId.get(firstUser)?.archived_at).toBeTruthy();
    expect(byId.get(nextUser)?.archived_at).toBeNull();
    expect(byId.get(nextUser)?.conversation_id).toBeTruthy();
    expect(byId.get(nextUser)?.conversation_id).not.toBe(firstConversation);
    expect(byId.get(nextUser)?.reply_to_id).toBeNull();

    const plainId = randomUUID();
    await getSql()`insert into assistant_messages (id, user_id, role, locale, content, created_at) values (${plainId}, ${user.id}, 'assistant', 'en', ${"plain legacy note"}, now())`;
    const legacyDraft = randomUUID();
    await getSql()`
      insert into chat_drafts (id, user_id, unit_id, kind, payload, status, created_at)
      values (${legacyDraft}, ${user.id}, ${unit.id}, 'letter', ${getSql().json({ text: "Draft letter about the leak" })}, 'cancelled', now())
    `;
    const first = await backfillChat();
    expect(first.messagesEncrypted).toBeGreaterThanOrEqual(1);
    expect(first.draftsEncrypted).toBeGreaterThanOrEqual(1);
    const cipher = await getSql()<{ content: string; conversation_id: string | null }[]>`select content, conversation_id from assistant_messages where id = ${plainId}`;
    expect(isCiphertext(cipher[0]?.content || "")).toBe(true);
    expect(readChatText(cipher[0]?.content || "")).toBe("plain legacy note");
    expect(cipher[0]?.conversation_id).toBeTruthy();
    const sealed = await getSql()<{ payload: unknown }[]>`select payload from chat_drafts where id = ${legacyDraft}`;
    expect(isCiphertext(String(sealed[0]?.payload))).toBe(true);
    const again = await backfillChat();
    expect(again.messagesEncrypted).toBe(0);
    expect(again.draftsEncrypted).toBe(0);
    const still = await getSql()<{ content: string }[]>`select content from assistant_messages where id = ${plainId}`;
    expect(still[0]?.content).toBe(cipher[0]?.content);
    expect(await countAssistantThisMonth(user.id, "2026-10-01")).toBe(3);
    const audit = await auditChat();
    expect(audit.migration011).toBe(true);
    expect(audit.plaintextMessages).toBe(0);
    expect(audit.plaintextDrafts).toBe(0);
    expect(audit.missingConversation).toBe(0);
  });
});

describe("short chat context", () => {
  it("cites the earlier deposit rule when the model returns no ids", () => {
    const retrieval = "The first item was a rent note. The second item is my security deposit.";
    const followUp = "what about the second one?";
    const abstained = citeFromConversation(followUp, "en", `${retrieval}\n${followUp}`, []);
    expect(abstained.unsure).toBe(false);
    expect(abstained.ruleIds).toContain("CA-CC-1950.5");
    expect(abstained.text).toContain("CA-CC-1950.5");
    const missed = citeFromConversation(followUp, "en", `${retrieval}\n${followUp}`, ["NOT-A-RULE"]);
    expect(missed.ruleIds).toContain("CA-CC-1950.5");
    const narrowed = citeFromConversation(followUp, "en", `${retrieval}\n${followUp}`, ["CA-CC-1950.5", "NOT-A-RULE"]);
    expect(narrowed.ruleIds).toEqual(["CA-CC-1950.5"]);
  });

  it("keeps the last turns under the cap and removes contact numbers", () => {
    const turns = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `TURN-${index} ${"zzzzpad ".repeat(80)}${index === 0 ? "OLDEST-MARKER" : ""}${index === 7 ? " ada@example.com 213-555-0199 123-45-6789" : ""}`,
    }));
    const history = formatChatHistory(turns);
    expect(history.length).toBeLessThanOrEqual(CHAT_HISTORY_CHARS);
    expect(history.split("\n").length).toBeLessThanOrEqual(6);
    expect(history).not.toContain("OLDEST-MARKER");
    expect(history).not.toContain("TURN-0");
    expect(history).toContain("[email]");
    expect(history).toContain("[phone]");
    expect(history).toContain("[ssn]");
    expect(history).not.toContain("ada@example.com");
    expect(history).not.toContain("213-555-0199");
    expect(history).not.toContain("123-45-6789");
    const huge = formatChatHistory([{ role: "user", content: `${"y".repeat(5000)} ada@example.com` }]);
    expect(huge.length).toBeLessThanOrEqual(CHAT_HISTORY_CHARS);
    expect(huge).toContain("[email]");
    expect(huge).not.toContain("ada@example.com");
  });

  it("sends the earlier redacted turn with a follow-up and drops it after Clear chat", async () => {
    prompts.all.length = 0;
    const user = await createNamedUser(`chat-ctx-${Date.now()}@example.com`, "Maya Chen");
    const unit = await createUnit(user.id, unitInput(`${Date.now()} Echo Park Ave`));
    const start = Date.parse("2026-10-03T00:00:00.000Z");
    const at = (step: number) => new Date(start + step * 1000).toISOString();
    const answer = { locale: "en" as const, ruleIds: [] as string[], unsure: false };
    await addAssistantMessage(user.id, unit.id, "user", {
      ...answer,
      content: `OLDEST-MARKER ${"zzzzpad ".repeat(80)}`,
      createdAt: at(1),
    });
    for (let step = 2; step <= 4; step += 1) {
      await addAssistantMessage(user.id, unit.id, step % 2 === 0 ? "assistant" : "user", {
        ...answer,
        content: `TURN-${step} ${"zzzzpad ".repeat(80)}`,
        createdAt: at(step),
      });
    }
    await addAssistantMessage(user.id, unit.id, "user", {
      ...answer,
      content: "The first item was a rent note. The second item is my security deposit. Email ada@example.com or call 213-555-0199.",
      createdAt: at(5),
    });
    await addAssistantMessage(user.id, unit.id, "assistant", {
      ...answer,
      content: "The second item is the security deposit.",
      createdAt: at(6),
    });
    await runChatTurn(user, unit, { text: "what about the second one?" });
    expect(prompts.all.length).toBeGreaterThan(0);
    const joined = prompts.all.join("\n");
    expect(joined).not.toContain("OLDEST-MARKER");
    expect(joined).not.toContain("ada@example.com");
    expect(joined).not.toContain("213-555-0199");
    expect(joined).toContain("[email]");
    expect(joined).toContain("[phone]");
    expect(joined).toContain("security deposit");
    for (const prompt of prompts.all) expect(historyBlock(prompt).length).toBeLessThanOrEqual(CHAT_HISTORY_CHARS);
    const rulesPrompt = prompts.all.find((prompt) => prompt.startsWith("Pick up to 3"));
    expect(rulesPrompt).toContain("CA-CC-1950.5");
    const cited = (await listAssistant(user.id, "visible")).filter((row) => row.role === "assistant").at(-1);
    expect(cited?.content).toContain("CA-CC-1950.5");

    prompts.all.length = 0;
    await archiveChat(user.id);
    await runChatTurn(user, unit, { text: "what about the second one?" });
    expect(prompts.all.join("\n")).not.toContain("security deposit");
    expect(prompts.all.join("\n")).not.toContain("OLDEST-MARKER");
    expect(privacyDocument).toContain("chat messages");
    expect(privacyDocument).toContain("encrypted before they are stored");
  });

  it("stores one user message when the same send is retried", async () => {
    const user = await createNamedUser(`chat-retry-${Date.now()}@example.com`, "Maya Chen");
    const unit = await createUnit(user.id, unitInput(`${Date.now()} Echo Park Ave`));
    const clientId = randomUUID();
    await runChatTurn(user, unit, { text: "The kitchen tap is dripping.", clientId });
    await expect(runChatTurn(user, unit, { text: "The kitchen tap is dripping.", clientId })).rejects.toBeInstanceOf(ChatTurnDone);
    const rows = await listAssistant(user.id, "visible");
    const mine = rows.filter((row) => row.role === "user" && row.content === "The kitchen tap is dripping.");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.id).toBe(clientId);
    expect(rows.filter((row) => row.role === "assistant" && row.reply_to_id === clientId)).toHaveLength(1);
  });
});
