import { afterEach, describe, expect, it, vi } from "vitest";
import { suggestPlace } from "@/lib/geo";
import { placeSummary } from "@/lib/rules/detect";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("address suggestions", () => {
  it("uses a Census match when one comes back", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      result: {
        addressMatches: [{
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
        }],
      },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const found = await suggestPlace("1842 echo park, los angeles, CA 90026");
    expect(found.suggestion?.street).toBe("1842 N Echo Park Ave");
    expect(found.suggestion?.city).toBe("Los Angeles");
    expect(found.suggestion?.postalCode).toBe("90026");
    expect(placeSummary(found.place)).toBe("California rules apply; Los Angeles rent control may also apply.");
  });

  it("keeps the typed address when the Census service is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const found = await suggestPlace("1842 N Echo Park Ave, Los Angeles, CA 90026");
    expect(found.suggestion).toBeNull();
    expect(placeSummary(found.place)).toBe("California rules apply; Los Angeles rent control may also apply.");
  });
});
