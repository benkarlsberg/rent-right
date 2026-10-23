import { detectPlace, type PlaceDetection } from "@/lib/rules/detect";
import type { Jurisdiction } from "@/lib/rules/engine";

export type AddressSuggestion = {
  label: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
};

type CensusMatch = {
  matchedAddress?: string;
  addressComponents?: {
    fromAddress?: string;
    preDirection?: string;
    streetName?: string;
    suffixType?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  geographies?: Record<string, { NAME?: string; BASENAME?: string }[]>;
};

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

async function censusMatch(address: string, timeoutMs: number): Promise<CensusMatch | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("format", "json");
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error("census");
  const body = (await response.json()) as { result?: { addressMatches?: CensusMatch[] } };
  return body.result?.addressMatches?.[0] ?? null;
}

export async function suggestPlace(address: string): Promise<{ place: PlaceDetection; suggestion: AddressSuggestion | null }> {
  const local = detectPlace({ address });
  try {
    const match = await censusMatch(address, 2500);
    if (!match) return { place: local, suggestion: null };
    const parts = match.addressComponents || {};
    const city = String(parts.city || "").replace(/\s+city$/i, "");
    const postalCode = String(parts.zip || "");
    const region = String(parts.state || "CA").toUpperCase();
    const street = [parts.fromAddress, parts.preDirection, parts.streetName, parts.suffixType].filter(Boolean).join(" ");
    const geo = match.geographies;
    const placeName = String(geo?.["Incorporated Places"]?.[0]?.NAME || geo?.["Incorporated Places"]?.[0]?.BASENAME || city).replace(/\s+city$/i, "");
    const county = geo?.Counties?.[0]?.NAME || "";
    const detected = detectPlace({
      address: match.matchedAddress || address,
      city: titleCase(placeName || city),
      postalCode,
      region: county || region,
    });
    const suggestion = street && city && postalCode
      ? {
          label: match.matchedAddress || `${street}, ${city}, ${region} ${postalCode}`,
          street: titleCase(street),
          city: titleCase(placeName || city),
          region,
          postalCode,
        }
      : null;
    return { place: detected.inCalifornia ? detected : local, suggestion: detected.inCalifornia ? suggestion : null };
  } catch {
    return { place: local, suggestion: null };
  }
}

export async function lookupJurisdiction(address: string): Promise<{ suggestion: Jurisdiction; note: string; place: PlaceDetection }> {
  const local = detectPlace({ address });
  try {
    const match = await censusMatch(address, 5000);
    const geo = match?.geographies;
    if (!geo) {
      return { suggestion: local.jurisdiction, place: local, note: local.notes.join(" ") || "No Census match. Statewide rules apply when the address is in California." };
    }
    const placeName = (geo["Incorporated Places"]?.[0]?.NAME || geo["Incorporated Places"]?.[0]?.BASENAME || "").replace(/\s+city$/i, "");
    const county = geo.Counties?.[0]?.NAME || "";
    const detected = detectPlace({ address, city: placeName, region: county });
    const ordinance = detected.localOrdinance ? ` Local rules in ${detected.localOrdinance.name} may add protections: ${detected.localOrdinance.housingUrl}` : "";
    const note = `Census place: ${placeName || "none"}. County: ${county || "none"}.${ordinance} Confirm before you rely on a cap.`;
    return { suggestion: detected.jurisdiction, place: detected, note };
  } catch {
    return {
      suggestion: local.jurisdiction,
      place: local,
      note: `${local.notes.join(" ")} The Census geocoder was not reached.`.trim(),
    };
  }
}
