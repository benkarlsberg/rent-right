import { describe, expect, it } from "vitest";
import { CITY_PACKS } from "@/lib/rules/cities";
import { checkRentIncrease, type RentIncreaseInput } from "@/lib/rules/engine";
import { evaluateLocalCap, parseLocalFacts, verificationFor } from "@/lib/rules/cities/verify";
import { ORDINANCES } from "@/lib/rules/cities/catalog";

const baseFacts = { builtYear: 1990, housingType: "multi" as const, unitCount: 4, subsidized: false };

function check(id: string, extra: Partial<RentIncreaseInput> = {}) {
  return checkRentIncrease({
    jurisdiction: id,
    rsoStatus: "unsure",
    rstpoTier: "unsure",
    lowestRentCents: 200_000,
    proposedRentCents: 210_000,
    noticeDate: "2026-08-01",
    effectiveDate: "2026-10-01",
    lastIncreaseDate: null,
    claimsExemption: false,
    ...extra,
  });
}

describe("local coverage facts", () => {
  it("applies Culver City 3.25% only when the unit matches the city page", () => {
    const covered = check("culver-city", { localFacts: baseFacts });
    expect(covered.local?.ppm).toBe(32_500);
    expect(covered.local?.maxRentCents).toBe(206_500);
    expect(covered.applicable.status).toBe("over_cap");
    expect(covered.applicable.ppm).toBe(32_500);
    expect(covered.applicable.ruleId).toBe("LOCAL-CULVER_CITY");
    expect(covered.ab1482?.ppm).toBe(87_000);

    const tooNew = check("culver-city", { localFacts: { ...baseFacts, builtYear: 2000 } });
    expect(tooNew.local).toBeNull();
    expect(tooNew.applicable.status).toBe("within_cap");
    expect(tooNew.applicable.ppm).toBe(87_000);
    expect(tooNew.jurisdictionNote.toLowerCase()).toMatch(/outside the covered class/);

    const condo = check("culver-city", { localFacts: { ...baseFacts, housingType: "condo" } });
    expect(condo.local).toBeNull();
    expect(condo.applicable.ppm).toBe(87_000);
    expect(condo.jurisdictionNote.toLowerCase()).toMatch(/not clearly covered/);

    const missing = check("culver-city");
    expect(missing.local).toBeNull();
    expect(missing.applicable.ppm).toBe(87_000);
    expect(missing.jurisdictionNote).toContain("3.25%");
    expect(missing.jurisdictionNote.toLowerCase()).toMatch(/statewide/);
  });

  it("applies the Pasadena adjustment for the window that contains the effective date", () => {
    const current = check("pasadena", { effectiveDate: "2026-10-12", localFacts: baseFacts });
    expect(current.local?.ppm).toBe(25_000);
    expect(current.local?.maxRentCents).toBe(205_000);
    expect(current.applicable.status).toBe("over_cap");

    const prior = check("pasadena", { effectiveDate: "2026-08-01", localFacts: baseFacts });
    expect(prior.local?.ppm).toBe(22_500);
    expect(prior.applicable.maxRentCents).toBe(204_500);

    const townhome = check("pasadena", { effectiveDate: "2026-10-12", localFacts: { ...baseFacts, housingType: "townhome" } });
    expect(townhome.local).toBeNull();
    expect(townhome.applicable.ppm).toBe(87_000);

    const before = check("pasadena", { effectiveDate: "2023-01-01", noticeDate: "2022-12-01", localFacts: baseFacts });
    expect(before.local).toBeNull();
    expect(before.jurisdictionNote.toLowerCase()).toMatch(/no local percentage/);
  });

  it("applies Baldwin Park 3.7% to a non-subsidized multi-unit building and not to a subsidized one", () => {
    const covered = check("baldwin-park", { localFacts: baseFacts });
    expect(covered.local?.ppm).toBe(37_000);
    expect(covered.local?.maxRentCents).toBe(207_400);
    expect(covered.applicable.status).toBe("over_cap");

    const subsidized = check("baldwin-park", { localFacts: { ...baseFacts, subsidized: true } });
    expect(subsidized.local).toBeNull();
    expect(subsidized.applicable.ppm).toBe(87_000);
    expect(subsidized.jurisdictionNote.toLowerCase()).toMatch(/outside the covered class/);

    const duplex = check("baldwin-park", { localFacts: { ...baseFacts, unitCount: 2 } });
    expect(duplex.local).toBeNull();
    expect(duplex.applicable.ruleId).toBe("CA-CC-1947.12");
  });

  it("quotes verified figures that the checker cannot apply", () => {
    const inglewood = check("inglewood", { localFacts: { ...baseFacts, unitCount: 6 } });
    expect(inglewood.local).toBeNull();
    expect(inglewood.applicable.ppm).toBe(87_000);
    expect(inglewood.jurisdictionNote).toContain("3.7%");
    expect(inglewood.jurisdictionNote).toContain("8.7%");

    const antioch = check("antioch");
    expect(antioch.local).toBeNull();
    expect(antioch.applicable.ppm).toBe(88_000);
    expect(antioch.jurisdictionNote).toContain("2.04%");
    expect(antioch.jurisdictionNote).toContain("2026-09-14 through 2026-11-10");

    const weho = check("west-hollywood", { effectiveDate: "2026-10-12", localFacts: baseFacts });
    expect(weho.local).toBeNull();
    expect(weho.applicable.ppm).toBe(87_000);
    expect(weho.jurisdictionNote).toContain("2.75%");

    const wehoPrior = check("west-hollywood", { effectiveDate: "2026-08-01" });
    expect(wehoPrior.local).toBeNull();
    expect(wehoPrior.jurisdictionNote).toContain("2.25%");
    expect(wehoPrior.jurisdictionNote).toContain("2.75%");
  });

  it("leaves an unconfirmed current percentage unsure and does not apply a chart or example figure", () => {
    const sanLeandro = check("san-leandro", { effectiveDate: "2027-01-15", localFacts: baseFacts });
    expect(sanLeandro.local).toBeNull();
    expect(sanLeandro.applicable.ppm).toBe(88_000);
    expect(sanLeandro.jurisdictionNote).toContain("3.3%");
    expect(sanLeandro.jurisdictionNote.toLowerCase()).toMatch(/not applied/);

    const commerce = check("commerce", { localFacts: baseFacts });
    expect(commerce.local).toBeNull();
    expect(commerce.applicable.ppm).toBe(87_000);
    expect(commerce.jurisdictionNote.toLowerCase()).toMatch(/unsure/);
    expect(commerce.applicable.ppm).not.toBe(37_000);

    const huntington = check("huntington-park");
    expect(huntington.local).toBeNull();
    expect(huntington.jurisdictionNote.toLowerCase()).toMatch(/current percentage is unsure/);

    const larkspur = check("larkspur");
    expect(larkspur.local).toBeNull();
    expect(larkspur.jurisdictionNote).toContain("5% plus CPI or 7%");
    expect(larkspur.jurisdictionNote.toLowerCase()).toMatch(/unsure/);

    const salinas = check("salinas");
    expect(salinas.local).toBeNull();
    expect(salinas.applicable.ppm).toBe(86_000);
    expect(salinas.jurisdictionNote).toContain("2.4%");
    expect(salinas.jurisdictionNote.toLowerCase()).toMatch(/not stated as the current allowable increase/);

    const palms = check("palm-springs");
    expect(palms.local).toBeNull();
    expect(palms.jurisdictionNote.toLowerCase()).toMatch(/does not state a current annual percentage/);

    const oaks = check("thousand-oaks");
    expect(oaks.local).toBeNull();
    expect(oaks.jurisdictionNote.toLowerCase()).toMatch(/does not state a percentage/);

    const gatos = check("los-gatos", { localFacts: baseFacts });
    expect(gatos.local).toBeNull();
    expect(gatos.applicable.ppm).toBe(86_000);
    expect(gatos.jurisdictionNote).toContain("70% of CPI or 5%");
    expect(gatos.jurisdictionNote.toLowerCase()).toMatch(/current percentage is unsure/);
  });

  it("parses optional facts and rejects a value that is not a known fact", () => {
    expect(parseLocalFacts({})).toBeUndefined();
    expect(parseLocalFacts({ builtYear: "1990", housingType: "multi", unitCount: "4", subsidized: "no" })).toEqual(baseFacts);
    expect(() => parseLocalFacts({ housingType: "house" })).toThrow(/Kind must be/);
    expect(() => parseLocalFacts({ builtYear: "19" })).toThrow(/four-digit/);
  });

  it("keeps Attorney General chart coverage from being applied", () => {
    for (const record of ORDINANCES.filter((item) => item.capStatus === "published" && item.id !== "pasadena")) {
      const verification = verificationFor(record);
      expect(verification.coverage.apply, record.id).toBe(false);
      expect(verification.coverage.source, record.id).toBe("ag-chart");
      const decision = evaluateLocalCap(verification, baseFacts, "2026-10-12");
      expect(decision.outcome, record.id).toBe("fallback");
      expect(decision.ppm, record.id).toBeNull();
    }
    expect(CITY_PACKS.find((pack) => pack.id === "pasadena")?.verification?.coverage.apply).toBe(true);
    expect(CITY_PACKS.find((pack) => pack.id === "culver-city")?.verification?.coverage.apply).toBe(true);
    expect(CITY_PACKS.find((pack) => pack.id === "baldwin-park")?.verification?.coverage.apply).toBe(true);
  });
});
