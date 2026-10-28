import { afterEach, describe, expect, it, vi } from "vitest";
import { COVERAGE_NOTICE_EN } from "@/lib/coverage";
import { addressDiffers, suggestPlace } from "@/lib/geo";
import { placeSummary } from "@/lib/rules/detect";

afterEach(() => {
  vi.unstubAllGlobals();
});

function census(match: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: { addressMatches: [match] } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })));
}

describe("address suggestions", () => {
  it("confirms the city without replacing a typed street that already matches", async () => {
    census({
      matchedAddress: "1842 N ECHO PARK AVE, LOS ANGELES, CA, 90026",
      addressComponents: {
        fromAddress: "1842",
        preDirection: "N",
        streetName: "ECHO PARK",
        suffixType: "AVE",
        city: "LOS ANGELES",
        state: "CA",
        zip: "90026",
      },
      geographies: {
        "Incorporated Places": [{ NAME: "Los Angeles city" }],
        Counties: [{ NAME: "Los Angeles County" }],
      },
    });
    const found = await suggestPlace({ street: "1842 echo park", city: "los angeles", region: "CA", postalCode: "90026" });
    expect(found.differs).toBe(false);
    expect(found.suggestion).toBeNull();
    expect(found.kept.street).toBe("1842 Echo Park");
    expect(found.kept.city).toBe("Los Angeles");
    expect(found.place.inCalifornia).toBe(true);
    expect(placeSummary(found.place)).toBe("California rules apply; Los Angeles rent control may also apply.");
  });

  it("does not suggest the start of a Census range when the matched house number agrees", async () => {
    census({
      matchedAddress: "1842 ECHO PARK AVE, LOS ANGELES, CA, 90026",
      addressComponents: {
        fromAddress: "1818",
        toAddress: "1844",
        streetName: "ECHO PARK",
        suffixType: "AVE",
        city: "LOS ANGELES",
        state: "CA",
        zip: "90026",
      },
      geographies: {
        "Incorporated Places": [{ NAME: "Los Angeles city" }],
        Counties: [{ NAME: "Los Angeles County" }],
      },
    });
    const found = await suggestPlace({ street: "1842 N Echo Park Ave", city: "Los Angeles", region: "CA", postalCode: "90026" });
    expect(found.differs).toBe(false);
    expect(found.suggestion).toBeNull();
    expect(found.kept.street).toBe("1842 N Echo Park Ave");
    expect(found.place.inCalifornia).toBe(true);
  });

  it("keeps a typed 1604 when the Census block starts at 1600", async () => {
    census({
      matchedAddress: "1604 DOVER AVE, THOUSAND OAKS, CA, 91360",
      addressComponents: {
        fromAddress: "1600",
        toAddress: "1698",
        streetName: "DOVER",
        suffixType: "AVE",
        city: "THOUSAND OAKS",
        state: "CA",
        zip: "91360",
      },
      geographies: {
        "Incorporated Places": [{ NAME: "Thousand Oaks city" }],
        Counties: [{ NAME: "Ventura County" }],
      },
    });
    const found = await suggestPlace({ street: "1604 Dover Ave", city: "Thousand Oaks", region: "CA", postalCode: "91360" });
    expect(found.place.inCalifornia).toBe(true);
    expect(found.place.jurisdiction).toBe("thousand-oaks");
    expect(found.differs).toBe(false);
    expect(found.suggestion).toBeNull();
    expect(found.kept.street).toBe("1604 Dover Ave");
    expect(found.kept.city).toBe("Thousand Oaks");
    expect(found.kept.postalCode).toBe("91360");
    expect(found.kept.street).not.toMatch(/^1600\b/);
    expect(JSON.stringify(found)).not.toContain("1600 Dover");
  });

  it("still accepts a California address when the census match is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: { addressMatches: [] } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    const found = await suggestPlace({ street: "1600 dover ave", city: "thousand oaks", region: "CA", postalCode: "91360" });
    expect(found.suggestion).toBeNull();
    expect(found.differs).toBe(false);
    expect(found.place.inCalifornia).toBe(true);
    expect(found.place.jurisdiction).toBe("thousand-oaks");
    expect(found.kept.street).toBe("1600 Dover Ave");
    expect(found.kept.city).toBe("Thousand Oaks");
  });

  it("still accepts a California address when the census lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const found = await suggestPlace({ street: "1600 Dover Ave", city: "Thousand Oaks", region: "CA", postalCode: "91360" });
    expect(found.suggestion).toBeNull();
    expect(found.place.inCalifornia).toBe(true);
    expect(found.place.jurisdiction).toBe("thousand-oaks");
    expect(found.kept.street).toBe("1600 Dover Ave");
    expect(placeSummary(found.place)).toMatch(/Thousand Oaks/);
  });

  it("keeps the unit the tenant typed when the match names a different one", async () => {
    census({
      matchedAddress: "1600 DOVER AVE APT 9, THOUSAND OAKS, CA, 91360",
      addressComponents: {
        fromAddress: "1600",
        streetName: "DOVER",
        suffixType: "AVE",
        city: "THOUSAND OAKS",
        state: "CA",
        zip: "91360",
      },
      geographies: {
        "Incorporated Places": [{ NAME: "Thousand Oaks city" }],
        Counties: [{ NAME: "Ventura County" }],
      },
    });
    const found = await suggestPlace({
      street: "1600 Dover Ave",
      unit: "apt 4",
      city: "Thousand Oaks",
      region: "CA",
      postalCode: "91360",
    });
    expect(found.differs).toBe(true);
    expect(found.suggestion?.unit).toBe("9");
    expect(found.suggestion?.street).toBe("1600 Dover Ave");
    expect(found.kept.street).toBe("1600 Dover Ave");
    expect(found.kept.unit).toBe("Apt 4");
    expect(found.place.inCalifornia).toBe(true);
  });

  it("rejects an address outside California", async () => {
    census({
      matchedAddress: "350 5TH AVE, NEW YORK, NY, 10001",
      addressComponents: {
        fromAddress: "350",
        streetName: "5TH",
        suffixType: "AVE",
        city: "NEW YORK",
        state: "NY",
        zip: "10001",
      },
    });
    const found = await suggestPlace({ street: "350 5th Ave", city: "New York", region: "CA", postalCode: "10001" });
    expect(found.place.inCalifornia).toBe(false);
    expect(found.place.jurisdiction).toBe("unsupported");
    expect(found.place.state).toBe("NY");
    expect(found.suggestion).toBeNull();
    expect(found.kept.street).toBe("350 5th Ave");
    expect(placeSummary(found.place)).toBe(COVERAGE_NOTICE_EN);
  });

  it("treats a different house number, street, or unit as a suggestion", () => {
    expect(addressDiffers({ street: "1600 Dover Ave" }, { street: "1604 Dover Ave" })).toBe(true);
    expect(addressDiffers({ street: "1600 Dover Ave" }, { street: "1600 Rancho Ave" })).toBe(true);
    expect(addressDiffers({ street: "1600 Dover Ave", unit: "4" }, { street: "1600 Dover Ave", unit: "9" })).toBe(true);
    expect(addressDiffers({ street: "1842 echo park" }, { street: "1842 N Echo Park Ave" })).toBe(false);
    expect(addressDiffers({ street: "1600 Dover Ave", unit: "4" }, { street: "1600 Dover Ave" })).toBe(false);
  });
});
