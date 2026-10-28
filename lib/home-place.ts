import type { Jurisdiction } from "@/lib/rules/engine";
import { isAllowedJurisdiction } from "@/lib/rules/cities";
import { detectPlace } from "@/lib/rules/detect";

export function storedHome(input: {
  street: string;
  city: string;
  postalCode: string;
  region: string;
  requested?: string;
}): { jurisdiction: Jurisdiction; region: string; supported: boolean } {
  const postal = input.postalCode.trim();
  if (postal && !/^\d{5}(?:-\d{4})?$/.test(postal)) throw new Error("Enter a 5-digit US ZIP.");
  const detected = detectPlace({
    address: input.street,
    city: input.city,
    postalCode: postal,
    region: input.region,
  });
  if (detected.jurisdiction === "unsupported") {
    return { jurisdiction: "unsupported", region: detected.state || input.region, supported: false };
  }
  if (!detected.inCalifornia) {
    const empty = detected.notes.some((note) => note === "No address entered.");
    throw new Error(empty ? "Add the address." : "That address does not look like California.");
  }
  const requested = input.requested || "";
  const jurisdiction = requested && requested !== "unsure" && requested !== "unsupported" && isAllowedJurisdiction(requested)
    ? requested
    : detected.jurisdiction;
  if (!isAllowedJurisdiction(jurisdiction)) throw new Error("Choose a jurisdiction.");
  return { jurisdiction, region: input.region || "CA", supported: true };
}
