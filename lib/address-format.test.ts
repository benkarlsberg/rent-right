import { describe, expect, it } from "vitest";
import { formatAddressHtml, formatAddressLines, formatAddressPlain } from "@/lib/address-format";

describe("formatAddressLines", () => {
  it("puts the unit on the street line and title-cases Census capitals", () => {
    expect(formatAddressLines({
      street: "1604 DOVER AVE",
      unit: "apt 2",
      city: "THOUSAND OAKS",
      region: "ca",
      postalCode: "91360",
    })).toEqual(["1604 Dover Ave, Apt 2", "Thousand Oaks, CA 91360"]);
    expect(formatAddressPlain({
      street: "1604 DOVER AVE",
      unit: "2",
      city: "THOUSAND OAKS",
      postalCode: "91360",
    })).toBe("1604 Dover Ave, Unit 2\nThousand Oaks, CA 91360");
  });

  it("omits the unit and a missing ZIP", () => {
    expect(formatAddressLines({
      street: "1604 dover ave",
      city: "thousand oaks",
      postalCode: "",
    })).toEqual(["1604 Dover Ave", "Thousand Oaks, CA"]);
    expect(formatAddressLines({
      street: "10 main st",
      unit: "   ",
      city: "los angeles",
      region: "Los Angeles County",
      postalCode: "90026",
    })).toEqual(["10 Main St", "Los Angeles, CA 90026"]);
  });

  it("prints a unit once when the street already ends with it", () => {
    expect(formatAddressLines({
      street: "12588 Carmel Creek Rd, Unit 25",
      unit: "Unit 25",
      city: "San Diego",
      region: "CA",
      postalCode: "92130",
    })).toEqual(["12588 Carmel Creek Rd, Unit 25", "San Diego, CA 92130"]);
    expect(formatAddressLines({
      street: "12588 Carmel Creek Rd, Unit 25, Unit 25",
      unit: "",
      city: "San Diego",
      postalCode: "92130",
    })).toEqual(["12588 Carmel Creek Rd, Unit 25", "San Diego, CA 92130"]);
    expect(formatAddressPlain({
      street: "12588 carmel creek rd, unit 25",
      unit: "25",
      city: "san diego",
      postalCode: "92130",
    })).toBe("12588 Carmel Creek Rd, Unit 25\nSan Diego, CA 92130");
  });

  it("keeps ordinals and escapes the HTML form", () => {
    expect(formatAddressLines({ street: "350 5th Ave", city: "Los Angeles", postalCode: "90012" })[0]).toBe("350 5th Ave");
    expect(formatAddressHtml({ street: "1 <Main>", city: "Oak", postalCode: "90026" })).toBe("1 &lt;Main&gt;<br>Oak, CA 90026");
  });
});
