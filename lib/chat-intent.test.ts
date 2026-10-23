import { describe, expect, it } from "vitest";
import { depositReturnDeadline, checkRentIncrease } from "@/lib/rules/engine";
import { cardAfterSend, parseCard, serializeCard } from "@/lib/chat-card";
import { detectIntent, isConfirm, moneyCents, planTurn, repairFacts } from "@/lib/chat-intent";

describe("chat intent", () => {
  it("logs a leak as a repair and does not treat it as permission to email", () => {
    const plan = planTurn("my sink is leaking", null);
    expect(plan).toMatchObject({ type: "repair", severity: "leak" });
    expect(plan.type === "repair" && plan.summary).toBe("my sink is leaking");
    expect(isConfirm("my sink is leaking")).toBe(false);
  });

  it("sends only after an explicit confirmation while a repair draft is open", () => {
    expect(planTurn("yes, send it", null).type).toBe("unclear");
    expect(planTurn("send someone to fix the sink", "repair").type).toBe("repair");
    expect(planTurn("yes, send it", "repair").type).toBe("confirm_send");
    expect(planTurn("envíalo", "repair").type).toBe("confirm_send");
  });

  it("does not invent a rent cap when the start date is missing", () => {
    const plan = planTurn("my landlord raised rent to $2,100", null);
    expect(plan).toMatchObject({ type: "rent", proposedCents: 210_000, lowestCents: null, effectiveDate: null });
  });

  it("passes a stated amount and date through to the rules engine", () => {
    const plan = planTurn("my landlord raised rent from $2,150 to $2,257.50 starting 2026-11-01", null);
    expect(plan).toMatchObject({
      type: "rent",
      lowestCents: 215_000,
      proposedCents: 225_750,
      effectiveDate: "2026-11-01",
    });
    if (plan.type !== "rent" || plan.lowestCents == null || plan.proposedCents == null || plan.effectiveDate == null) return;
    const result = checkRentIncrease({
      jurisdiction: "city_la",
      rsoStatus: "covered",
      rstpoTier: "unsure",
      lowestRentCents: plan.lowestCents,
      proposedRentCents: plan.proposedCents,
      noticeDate: "2026-10-01",
      effectiveDate: plan.effectiveDate,
      lastIncreaseDate: null,
      claimsExemption: false,
    });
    expect(result.applicable.ruleId).toBeTruthy();
    expect(result.local?.ppm ?? result.ab1482?.ppm).not.toBeNull();
  });

  it("counts 21 days from the move-out date the tenant states", () => {
    const plan = planTurn("I moved out on 2026-09-01, where's my deposit?", null);
    expect(plan).toMatchObject({ type: "deposit", moveOutDate: "2026-09-01" });
    expect(depositReturnDeadline("2026-09-01").dueDate).toBe("2026-09-22");
    expect(depositReturnDeadline("2026-09-01").ruleId).toBe("CA-CC-1950.5");
  });

  it("asks for a lease file instead of reviewing words alone", () => {
    expect(planTurn("check my lease", null).type).toBe("lease");
    expect(planTurn("Revisar mi contrato", null).type).toBe("lease");
  });

  it("routes the empty-chat chips", () => {
    expect(detectIntent("My sink is leaking", null)).toBe("repair");
    expect(detectIntent("Se filtra el fregadero", null)).toBe("repair");
    expect(detectIntent("My landlord raised rent to $2,100", null)).toBe("rent");
    expect(detectIntent("Mi casero subio la renta a $2,100", null)).toBe("rent");
    expect(detectIntent("I moved out, where's my deposit?", null)).toBe("deposit");
    expect(detectIntent("Me mude, donde esta mi deposito?", null)).toBe("deposit");
    expect(moneyCents("$2,257.50")).toEqual([225_750]);
  });

  it("offers to resolve a request when the tenant says it is fixed", () => {
    expect(planTurn("the sink is fixed", null)).toEqual({ type: "resolve_issue", summary: "the sink is fixed" });
    expect(planTurn("el fregadero ya está arreglado", null).type).toBe("resolve_issue");
    expect(planTurn("my sink is leaking", null).type).toBe("repair");
    expect(planTurn("yes, send it", "repair").type).toBe("confirm_send");
    expect(planTurn("the sink is fixed", "repair").type).toBe("resolve_issue");
  });

  it("keeps a gas leak separate from a water leak", () => {
    expect(repairFacts("I smell a gas leak in the kitchen").severity).toBe("gas_leak");
    expect(repairFacts("the bathroom faucet is dripping").room).toBe("Bathroom");
  });

  it("continues a rent date only when the tenant supplies one", () => {
    expect(planTurn("2026-11-01", "rent_date")).toEqual({ type: "continue_date", date: "2026-11-01" });
    expect(planTurn("the bathroom faucet is dripping", "rent_date").type).toBe("repair");
  });

  it("drops the current flow when the tenant changes topic", () => {
    const repair = planTurn("Nevermind, I'd like to request a fix", "rent_date");
    expect(repair).toMatchObject({ type: "repair" });
    expect(repair.type === "repair" && repair.summary).toBe("I'd like to request a fix");
    expect(planTurn("Nevermind, I'd like to request a fix", "letter").type).toBe("repair");
    expect(planTurn("Nevermind", "deposit_date").type).toBe("unclear");
    expect(planTurn("Check my lease", "letter").type).toBe("lease");
    expect(planTurn("instead check a rent increase to $2,100", "repair")).toMatchObject({ type: "rent", proposedCents: 210_000 });
  });
});

describe("chat card after send", () => {
  const confirmed = {
    headline: "Landlord email",
    status: "Saved",
    action: { id: "open-landlord", label: "Open landlord" },
    detail: "You confirmed this send.",
    ruleId: null,
  };

  it("replaces the waiting send card and leaves other cards alone", () => {
    const waiting = serializeCard({
      headline: "Repair logged",
      status: "Not sent",
      action: { id: "send:draft-1", label: "Send to landlord" },
      detail: "Nothing was emailed.",
      ruleId: "CA-CC-1942",
    });
    const next = parseCard(cardAfterSend(waiting, confirmed));
    expect(next).toMatchObject({ headline: "Landlord email", status: "Saved", action: { id: "open-landlord" } });
    expect(next?.action?.id.startsWith("send:")).toBe(false);

    const already = serializeCard({ ...confirmed, status: "Sent" });
    expect(cardAfterSend(already, confirmed)).toBe(already);
  });
});
