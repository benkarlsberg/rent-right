import { describe, expect, it } from "vitest";
import { LOCAL_ORDINANCES } from "@/lib/rules/cities/local-directory";
import { detectPlace, localProtectionNote } from "@/lib/rules/detect";

describe("California place detection", () => {
  it("keeps loaded Los Angeles and San Diego rules", () => {
    expect(detectPlace({ city: "Los Angeles", region: "CA", postalCode: "90026" }).jurisdiction).toBe("city_la");
    expect(detectPlace({ address: "1842 N Echo Park Ave, Los Angeles, CA 90026" }).jurisdiction).toBe("city_la");
    expect(detectPlace({ city: "San Diego", region: "CA", postalCode: "92101" }).jurisdiction).toBe("city_sd");
    expect(detectPlace({ address: "unincorporated Los Angeles County" }).jurisdiction).toBe("la_county_unincorporated");
  });

  it("matches local ordinances by city and ZIP, then falls back to statewide", () => {
    const oakland = detectPlace({ city: "Oakland", postalCode: "94612", region: "CA" });
    expect(oakland.jurisdiction).toBe("ca");
    expect(oakland.area).toBe("san_francisco_bay");
    expect(oakland.localOrdinance?.id).toBe("oakland");
    expect(oakland.localOrdinance?.housingUrl.startsWith("https://")).toBe(true);

    expect(detectPlace({ postalCode: "94110" }).localOrdinance?.id).toBe("san-francisco");
    expect(detectPlace({ address: "1 Center St, Berkeley, CA" }).localOrdinance?.id).toBe("berkeley");
    expect(detectPlace({ city: "San Jose", region: "CA" }).area).toBe("other_ca");
    expect(detectPlace({ address: "1 Main St, Santa Monica, CA 90401" }).localOrdinance?.id).toBe("santa-monica");
    expect(detectPlace({ postalCode: "90069", region: "CA" }).localOrdinance?.id).toBe("west-hollywood");

    const fresno = detectPlace({ city: "Fresno", postalCode: "93721", region: "CA" });
    expect(fresno.jurisdiction).toBe("ca");
    expect(fresno.area).toBe("other_ca");
    expect(fresno.localOrdinance).toBeNull();

    const chula = detectPlace({ address: "100 Main, Chula Vista, San Diego County, CA" });
    expect(chula.jurisdiction).toBe("ca");
    expect(chula.area).toBe("san_diego");
    expect(chula.localOrdinance).toBeNull();
    expect(chula.pack).toBeNull();
  });

  it("does not treat a county name or a nearby city as a loaded city", () => {
    const county = detectPlace({ address: "1 Broadway, Oakland, Alameda County, CA" });
    expect(county.localOrdinance?.id).toBe("oakland");
    expect(detectPlace({ address: "1 Fair Oaks, South Pasadena, CA" }).localOrdinance?.id).not.toBe("pasadena");
    expect(detectPlace({ city: "Los Angeles", address: "100 Commerce Ave" }).jurisdiction).toBe("city_la");
    expect(detectPlace({ address: "1 Main, Austin, TX 78701" }).jurisdiction).toBe("unsure");
    expect(detectPlace({}).jurisdiction).toBe("unsure");
  });

  it("keeps the phone note to one line and an official link", () => {
    const note = localProtectionNote(LOCAL_ORDINANCES.find((item) => item.id === "san-francisco") ?? null, "en");
    expect(note?.text).toBe("Local rules in San Francisco may add protections.");
    expect(note?.url).toMatch(/^https:\/\/www\.sf\.gov\//);
    for (const item of LOCAL_ORDINANCES) {
      expect(item.housingUrl.startsWith("https://") || item.housingUrl.startsWith("http://")).toBe(true);
      expect(item.places.length).toBeGreaterThan(0);
    }
  });
});
