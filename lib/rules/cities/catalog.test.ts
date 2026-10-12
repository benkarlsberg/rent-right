import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CITY_PACKS } from "@/lib/rules/cities";
import { ORDINANCES } from "@/lib/rules/cities/catalog";
import { effectiveSentence } from "@/lib/rules/cities/build-pack";
import { COUNTIES, COUNTY_NAMES } from "@/lib/rules/cities/counties";
import { renderCoverageMarkdown } from "@/lib/rules/cities/coverage";
import { checkRentIncrease } from "@/lib/rules/engine";

const PERCENT = /\d+(?:\.\d+)?\s*%/;

describe("local ordinance packs", () => {
  it("registers every catalog record once, with a clinic placeholder and an official URL", () => {
    expect(new Set(ORDINANCES.map((record) => record.id)).size).toBe(ORDINANCES.length);
    for (const record of ORDINANCES) {
      const pack = CITY_PACKS.find((item) => item.id === record.id);
      expect(pack?.jurisdiction).toBe(record.id);
      expect(pack?.capStatus).toBe(record.capStatus);
      expect(pack?.rules).toHaveLength(1);
      const rule = pack!.rules[0];
      expect(rule.placeholder).toBe(true);
      expect(rule.clinicReview).toBe("pending_clinic_review");
      expect(rule.jurisdiction).toBe("LOCAL");
      expect(rule.sourceUrl.startsWith("https://")).toBe(true);
      expect(rule.summaryEn).toContain(record.sourceUrl);
      expect(rule.summaryEn.toLowerCase()).toMatch(/pending clinic review/);
      const dated = record.effectiveDate ? rule.summaryEn.includes(record.effectiveDate) : /effective date is unsure/i.test(rule.summaryEn);
      expect(dated, record.id).toBe(true);
      expect(effectiveSentence(record).length).toBeGreaterThan(10);
      if (record.capStatus === "published") {
        expect(record.figure).toMatch(PERCENT);
        expect(record.window).toBeTruthy();
        expect(rule.summaryEn).toContain(record.figure!);
        expect(rule.summaryEn).toContain(record.window!);
        expect(rule.summaryEn).toContain("https://oag.ca.gov/rentcaps");
        expect(rule.summaryEn).toContain("2026-10-12");
        expect(rule.summaryEn.toLowerCase()).toMatch(/not apply that figure/);
      }
      if (record.capStatus === "unsure" && record.id !== "los-gatos") {
        expect(rule.summaryEn.toLowerCase()).toContain("unsure");
        expect(rule.summaryEn).not.toMatch(PERCENT);
        expect(record.figure).toBeNull();
      }
      if (record.capStatus === "none") {
        expect(rule.summaryEn).not.toMatch(PERCENT);
        expect(rule.summaryEn.toLowerCase()).toMatch(/did not find a local percentage/);
      }
    }
  });

  it("does not assign one ZIP to two city packs", () => {
    const seen = new Map<string, string>();
    for (const pack of CITY_PACKS.filter((item) => item.match === "city")) {
      for (const zip of pack.zips) {
        expect(seen.get(zip), `${zip} is on ${seen.get(zip)} and ${pack.id}`).toBeUndefined();
        seen.set(zip, pack.id);
      }
    }
  });

  it("quotes the Los Gatos formula and still marks the current figure unsure", () => {
    const rule = CITY_PACKS.find((pack) => pack.id === "los-gatos")!.rules[0];
    expect(rule.summaryEn).toContain("70% of CPI or 5%");
    expect(rule.summaryEn.toLowerCase()).toContain("unsure");
    expect(rule.summaryEn.toLowerCase()).not.toMatch(/the cap this year is/);
  });

  it("does not apply a published or unsure local figure as the allowed rent", () => {
    for (const record of ORDINANCES.filter((item) => item.capStatus === "published" || item.capStatus === "unsure")) {
      const result = checkRentIncrease({
        jurisdiction: record.id,
        rsoStatus: "unsure",
        rstpoTier: "unsure",
        lowestRentCents: 200_000,
        proposedRentCents: 210_000,
        noticeDate: "2026-08-01",
        effectiveDate: "2026-10-01",
        lastIncreaseDate: null,
        claimsExemption: false,
      });
      expect(result.applicable.status, record.id).toBe("unsure");
      expect(result.applicable.maxRentCents, record.id).toBeNull();
      expect(result.local, record.id).toBeNull();
      expect(result.ab1482, record.id).not.toBeNull();
      expect(result.jurisdictionNote.toLowerCase(), record.id).toMatch(/no single allowed rent/);
    }
  });

  it("uses the statewide chart for a just-cause or tenant-protection pack with no local percentage", () => {
    const result = checkRentIncrease({
      jurisdiction: "long-beach",
      rsoStatus: "unsure",
      rstpoTier: "unsure",
      lowestRentCents: 200_000,
      proposedRentCents: 210_000,
      noticeDate: "2026-08-01",
      effectiveDate: "2026-10-01",
      lastIncreaseDate: null,
      claimsExemption: false,
    });
    expect(result.applicable.status).toBe("within_cap");
    expect(result.applicable.ppm).toBe(87_000);
    expect(result.local).toBeNull();
    expect(result.jurisdictionNote.toLowerCase()).toMatch(/without a local percentage/);
  });
});

describe("county coverage", () => {
  it("lists all 58 counties and marks the ones without a pack as state law only", () => {
    expect(COUNTY_NAMES).toHaveLength(58);
    expect(new Set(COUNTY_NAMES).size).toBe(58);
    expect(COUNTIES).toHaveLength(58);
    const packed = COUNTIES.filter((county) => county.status === "local-pack");
    expect(packed.map((county) => county.name).sort()).toEqual(["Alameda", "Los Angeles", "Marin", "Santa Cruz", "Sonoma"]);
    for (const county of packed) {
      expect(CITY_PACKS.some((pack) => pack.id === county.packId && pack.match === "unincorporated")).toBe(true);
    }
    const stateOnly = COUNTIES.filter((county) => county.status === "state-law-only");
    expect(stateOnly).toHaveLength(52);
    for (const county of stateOnly) {
      expect(county.packId).toBeNull();
      expect(county.note.toLowerCase()).toMatch(/state law only/);
      expect(county.sourceUrl.startsWith("https://")).toBe(true);
    }
    const sanFrancisco = COUNTIES.find((county) => county.name === "San Francisco");
    expect(sanFrancisco?.status).toBe("city-county");
    expect(sanFrancisco?.packId).toBe("san-francisco");
  });

  it("keeps the generated coverage doc in lockstep with the catalog", () => {
    const doc = readFileSync("docs/COVERAGE.md", "utf8");
    expect(doc).toBe(renderCoverageMarkdown());
    expect(doc).toContain("| Alpine | state-law-only |");
    expect(doc).toContain("| San Francisco | city-county | san-francisco |");
    expect(doc).toContain("| Oakland |");
    expect(doc).toContain("Fairfax");
  });
});
