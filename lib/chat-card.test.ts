import { describe, expect, it } from "vitest";
import { alignLoggedRepair, chatTurnShowsSteps, flagCard, parseCard, replyShowsNotice, serializeCard } from "@/lib/chat-card";

const base = {
  headline: "What's broken?",
  status: "",
  action: null,
  detail: "Pick one, or describe what needs repair.",
  ruleId: null,
};

describe("reply notice", () => {
  it("hides the disclaimer on prompts, including ones that mention a rule id", () => {
    const prompt = flagCard({ ...base, ruleId: "CA-CC-1950.5" }, "prompt");
    expect(replyShowsNotice(prompt)).toBe(false);
    expect(prompt.showSteps).toBe(false);
    const stored = parseCard(serializeCard(prompt));
    expect(stored?.legal).toBe(false);
    expect(stored?.status).toBe("");
  });

  it("shows the disclaimer when the reply cites a rule", () => {
    const cited = flagCard({ ...base, headline: "Repair logged", status: "Not sent", ruleId: "CA-CC-1941" }, "cited-issue");
    expect(replyShowsNotice(cited)).toBe(true);
    expect(cited.showSteps).toBe(true);
  });
});

describe("logged repair card", () => {
  const undo = { id: "repair-undo:log1", label: "Undo" };
  const logged = {
    headline: "Repair logged",
    status: "Not sent",
    action: { id: "add-landlord", label: "Add landlord" },
    actions: [{ id: "add-landlord", label: "Add landlord" }, undo],
    detail: "Add your landlord.",
    ruleId: "CA-CC-1942",
  };

  it("asks to review the draft once a landlord exists, and shows Sent after the request goes out", () => {
    const ready = alignLoggedRepair(logged, {
      locale: "en",
      landlordReady: true,
      mail: { logId: "log1", draftId: "msg-1", sent: false },
    });
    expect(ready.action).toEqual({ id: "review-send:msg-1", label: "Review & send" });
    expect(ready.actions?.map((action) => action.label)).toEqual(["Review & send", "Undo"]);
    expect(ready.status).toBe("Not sent");

    const sent = alignLoggedRepair(logged, {
      locale: "en",
      landlordReady: true,
      mail: { logId: "log1", draftId: null, sent: true },
    });
    expect(sent.status).toBe("Sent");
    expect(sent.action).toBeNull();
    expect(sent.actions).toEqual([undo]);
  });
});

describe("chat next steps", () => {
  it("keeps steps on the reply that logged the issue and drops them on the next unrelated prompt", () => {
    const logged = serializeCard(flagCard({ ...base, headline: "Repair logged", status: "Not sent" }, "cited-issue"));
    const rows = [
      { role: "user", content: "The sink is leaking" },
      { role: "assistant", content: logged },
    ];
    expect(chatTurnShowsSteps(rows, ["Sink is leaking"])).toBe(true);
    const prompt = serializeCard(flagCard(base, "prompt"));
    expect(chatTurnShowsSteps([...rows, { role: "user", content: "purple balloons" }, { role: "assistant", content: prompt }], ["Sink is leaking"])).toBe(false);
  });

  it("shows steps when a later question is about that issue", () => {
    const answer = serializeCard(flagCard({ ...base, headline: "Habitability", status: "CA-CC-1941", ruleId: "CA-CC-1941" }, "cited"));
    const rows = [
      { role: "user", content: "Does the landlord have to fix the sink?" },
      { role: "assistant", content: answer },
    ];
    expect(chatTurnShowsSteps(rows, ["Sink is leaking"])).toBe(true);
    expect(chatTurnShowsSteps([
      { role: "user", content: "Can my landlord enter without notice?" },
      { role: "assistant", content: answer },
    ], ["Sink is leaking"])).toBe(false);
  });
});
