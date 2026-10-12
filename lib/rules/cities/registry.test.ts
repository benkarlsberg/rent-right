import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CITY_PACKS } from "@/lib/rules/cities";
import { pack as laCounty } from "@/lib/rules/cities/la-county";
import { pack as losAngeles } from "@/lib/rules/cities/los-angeles";
import { pack as sanDiego } from "@/lib/rules/cities/san-diego";

const DATA = new Set(["build-pack.ts", "catalog.ts", "counties.ts", "coverage.ts", "index.ts", "types.ts", "statewide.ts", "local-directory.ts"]);

describe("city pack files", () => {
  it("keeps hand-written packs registered and treats every loaded rule as a clinic placeholder", () => {
    const files = readdirSync("lib/rules/cities")
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !DATA.has(file))
      .sort();
    expect(files).toEqual(["la-county.ts", "los-angeles.ts", "san-diego.ts"]);
    for (const pack of [laCounty, losAngeles, sanDiego]) {
      expect(CITY_PACKS.some((item) => item.id === pack.id)).toBe(true);
    }
    const ids = new Set<string>();
    for (const pack of CITY_PACKS) {
      expect(ids.has(pack.id)).toBe(false);
      ids.add(pack.id);
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
