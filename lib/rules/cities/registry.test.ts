import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CITY_PACKS } from "@/lib/rules/cities";
import { pack as laCounty } from "@/lib/rules/cities/la-county";
import { pack as losAngeles } from "@/lib/rules/cities/los-angeles";
import { pack as sanDiego } from "@/lib/rules/cities/san-diego";

const SKIP = new Set(["index.ts", "types.ts", "statewide.ts", "local-directory.ts"]);
const imported = [laCounty, losAngeles, sanDiego];

describe("city pack files", () => {
  it("registers every pack file and keeps its rules as clinic placeholders", () => {
    const files = readdirSync("lib/rules/cities").filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !SKIP.has(file)).sort();
    expect(files).toEqual(["la-county.ts", "los-angeles.ts", "san-diego.ts"]);
    expect(CITY_PACKS.map((pack) => pack.id).sort()).toEqual(imported.map((pack) => pack.id).sort());
    for (const pack of imported) {
      expect(CITY_PACKS.some((item) => item.id === pack.id)).toBe(true);
      expect(pack.rules.length).toBeGreaterThan(0);
      for (const rule of pack.rules) {
        expect(rule.placeholder).toBe(true);
        expect(rule.clinicReview).toBe("pending_clinic_review");
        expect(rule.spanishReview).toBe("pending_volunteer_review");
        expect(rule.sourceUrl.startsWith("https://")).toBe(true);
      }
    }
  });
});
