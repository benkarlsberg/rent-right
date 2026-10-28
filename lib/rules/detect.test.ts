import { describe, expect, it } from "vitest";
import { LOCAL_ORDINANCES } from "@/lib/rules/cities/local-directory";
import { COVERAGE_NOTICE_EN } from "@/lib/coverage";
import { detectPlace, localProtectionNote, placeSummary } from "@/lib/rules/detect";

describe("California place detection", () => {
  it("keeps loaded Los Angeles and San Diego rules", () => {
    expect(detectPlace({ city: "Los Angeles", region: "CA", postalCode: "90026" }).jurisdiction).toBe("city_la");
    expect(detectPlace({ address: "1842 N Echo Park Ave, Los Angeles, CA 90026" }).jurisdiction).toBe("city_la");
    expect(detectPlace({ city: "San Diego", region: "CA", postalCode: "92101" }).jurisdiction).toBe("city_sd");
    expect(detectPlace({ address: "unincorporated Los Angeles County" }).jurisdiction).toBe("la_county_unincorporated");
  });

  it("loads a local pack by city and ZIP", () => {
    const oakland = detectPlace({ city: "Oakland", postalCode: "94612", region: "CA" });
    expect(oakland.jurisdiction).toBe("oakland");
    expect(oakland.area).toBe("san_francisco_bay");
    expect(oakland.pack?.id).toBe("oakland");
    expect(oakland.pack?.housingUrl.startsWith("https://")).toBe(true);
    expect(oakland.localOrdinance).toBeNull();

    expect(detectPlace({ postalCode: "94110" }).pack?.id).toBe("san-francisco");
    expect(detectPlace({ address: "1 Center St, Berkeley, CA" }).pack?.id).toBe("berkeley");
    expect(detectPlace({ city: "San Jose", region: "CA" }).area).toBe("other_ca");
    expect(detectPlace({ city: "San Jose", region: "CA" }).jurisdiction).toBe("san-jose");
    expect(detectPlace({ address: "1 Main St, Santa Monica, CA 90401" }).pack?.id).toBe("santa-monica");
    expect(detectPlace({ postalCode: "90069", region: "CA" }).pack?.id).toBe("west-hollywood");

    const fresno = detectPlace({ city: "Fresno", postalCode: "93721", region: "CA" });
    expect(fresno.jurisdiction).toBe("ca");
    expect(fresno.area).toBe("other_ca");
    expect(fresno.localOrdinance).toBeNull();
    expect(fresno.pack).toBeNull();

    const chula = detectPlace({ address: "100 Main, Chula Vista, San Diego County, CA" });
    expect(chula.jurisdiction).toBe("ca");
    expect(chula.area).toBe("san_diego");
    expect(chula.localOrdinance).toBeNull();
    expect(chula.pack).toBeNull();
  });

  it("matches an unincorporated county pack and not a city of the same name", () => {
    expect(detectPlace({ address: "unincorporated Alameda County, CA" }).pack?.id).toBe("alameda-county");
    expect(detectPlace({ city: "Alameda", region: "CA", postalCode: "94501" }).pack?.id).toBe("alameda");
    expect(detectPlace({ address: "unincorporated Marin County" }).pack?.id).toBe("marin-county");
    expect(detectPlace({ address: "unincorporated Sonoma County, CA" }).pack?.id).toBe("sonoma-county");
    expect(detectPlace({ address: "unincorporated Santa Cruz County, CA" }).pack?.id).toBe("santa-cruz-county");
  });

  it("does not treat a county name or a nearby city as the wrong pack", () => {
    const county = detectPlace({ address: "1 Broadway, Oakland, Alameda County, CA" });
    expect(county.pack?.id).toBe("oakland");
    expect(detectPlace({ address: "1 Fair Oaks, South Pasadena, CA" }).pack?.id).not.toBe("pasadena");
    expect(detectPlace({ address: "1 Fair Oaks, South Pasadena, CA" }).pack).toBeNull();
    expect(detectPlace({ city: "Los Angeles", address: "100 Commerce Ave" }).jurisdiction).toBe("city_la");
    expect(detectPlace({ address: "1 Main, Austin, TX 78701" }).jurisdiction).toBe("unsupported");
    expect(detectPlace({ address: "1 Main, Austin, TX 78701" }).state).toBe("TX");
    expect(detectPlace({}).jurisdiction).toBe("unsure");
  });

  it("summarizes which rules apply without claiming a unit is covered", () => {
    expect(placeSummary(detectPlace({ city: "Los Angeles", region: "CA", postalCode: "90026" }))).toBe(
      "California rules apply; Los Angeles rent control may also apply.",
    );
    expect(placeSummary(detectPlace({ city: "Oakland", postalCode: "94612", region: "CA" }))).toBe(
      "California rules apply; Oakland local rules may also apply.",
    );
    expect(placeSummary(detectPlace({ city: "San Diego", region: "CA", postalCode: "92101" }))).toBe(
      "California rules apply; San Diego local rules may also apply.",
    );
    expect(placeSummary(detectPlace({ address: "unincorporated Los Angeles County" }))).toBe(
      "California rules apply; Unincorporated Los Angeles County local rules may also apply.",
    );
    expect(placeSummary(detectPlace({ city: "Fresno", postalCode: "93721", region: "CA" }))).toBe("California rules apply.");
    expect(placeSummary(detectPlace({ address: "1 Main, Austin, TX 78701" }))).toBe(COVERAGE_NOTICE_EN);
    expect(placeSummary(detectPlace({}))).toBe("No address entered.");
    expect(placeSummary(detectPlace({ city: "Los Angeles", region: "CA", postalCode: "90026" }), "es")).toContain("Los Ángeles");
  });

  it("keeps unpacked directory notes empty until a city is left unloaded on purpose", () => {
    expect(LOCAL_ORDINANCES).toEqual([]);
    expect(localProtectionNote(null, "en")).toBeNull();
  });
});
