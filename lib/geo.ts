import { detectPlace, type PlaceDetection } from "@/lib/rules/detect";
import type { Jurisdiction } from "@/lib/rules/engine";

export type AddressFields = {
  street: string;
  unit?: string;
  city?: string;
  region?: string;
  postalCode?: string;
};

export type KeptAddress = {
  street: string;
  unit: string;
  city: string;
  region: string;
  postalCode: string;
};

export type AddressSuggestion = {
  label: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  unit: string;
};

export type AddressCheck = {
  place: PlaceDetection;
  suggestion: AddressSuggestion | null;
  differs: boolean;
  kept: KeptAddress;
};

type CensusMatch = {
  matchedAddress?: string;
  addressComponents?: {
    // fromAddress and toAddress are the TIGER block range, not the house number. They are intentionally unread.
    preDirection?: string;
    streetName?: string;
    suffixType?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  geographies?: Record<string, { NAME?: string; BASENAME?: string }[]>;
};

const DIRECTION = /^(n|s|e|w|ne|nw|se|sw|north|south|east|west)$/;
const SUFFIX = /^(ave|avenue|st|street|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|way|pl|place|ter|terrace|pkwy|parkway|cir|circle|hwy|highway|trl|trail)$/;

export function titleCase(value: string): string {
  return value.toLowerCase().replace(/[a-z]+/g, (word, offset: number, whole: string) => {
    const before = offset > 0 ? whole[offset - 1] : "";
    if (/\d/.test(before) && /^(st|nd|rd|th)$/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function tidyRegion(value: string): string {
  const trimmed = clean(value);
  return /^[a-z]{2}$/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}

export function isCaliforniaPostal(value: string): boolean {
  const zip = clean(value).match(/^(\d{5})(?:-\d{4})?$/)?.[1];
  if (!zip) return false;
  const prefix = Number(zip.slice(0, 3));
  return prefix >= 900 && prefix <= 961;
}

export function tidyAddress(input: AddressFields): KeptAddress {
  return {
    street: titleCase(clean(input.street)),
    unit: titleCase(clean(input.unit || "")),
    city: titleCase(clean(input.city || "")),
    region: tidyRegion(input.region || ""),
    postalCode: clean(input.postalCode || ""),
  };
}

function asFields(input: string | AddressFields): AddressFields {
  if (typeof input !== "string") return input;
  const postalCode = input.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] || "";
  const region = /\bca\b/i.test(input) ? "CA" : "";
  return { street: input, postalCode, region };
}

function unitFromLine(value: string): string {
  const match = value.match(/\b(?:apartment|apt|unit|suite|ste)\.?\s*#?\s*([a-z0-9-]+)/i);
  return match ? titleCase(match[1]) : "";
}

function streetCore(value: string): { number: string; name: string; unit: string } {
  let text = value.toLowerCase().replace(/[#.,]/g, " ").replace(/\s+/g, " ").trim();
  let unit = "";
  const unitMatch = text.match(/\b(?:apartment|apt|unit|suite|ste)\s+([a-z0-9-]+)\b/);
  if (unitMatch && unitMatch.index != null) {
    unit = unitMatch[1];
    text = `${text.slice(0, unitMatch.index)} ${text.slice(unitMatch.index + unitMatch[0].length)}`.replace(/\s+/g, " ").trim();
  }
  const tokens = text.split(" ").filter(Boolean);
  let number = "";
  if (tokens[0] && /^\d+[a-z]?(?:-\d+[a-z]?)?$/.test(tokens[0])) number = tokens.shift() || "";
  while (tokens[0] && DIRECTION.test(tokens[0])) tokens.shift();
  while (tokens.length && (DIRECTION.test(tokens[tokens.length - 1]) || SUFFIX.test(tokens[tokens.length - 1]))) tokens.pop();
  return { number, name: tokens.join(" "), unit };
}

function looseUnit(value: string): string {
  return value.toLowerCase().replace(/^(apartment|apt|unit|suite|ste)\.?\s*/i, "").replace(/\s+/g, "");
}

/** A Census line that changes the house number, street name, or unit is a suggestion. Suffix and direction alone are not. */
export function addressDiffers(typed: { street: string; unit?: string }, suggestion: { street: string; unit?: string }): boolean {
  const left = streetCore(typed.street);
  const right = streetCore(suggestion.street);
  const leftUnit = looseUnit(left.unit || typed.unit || "");
  const rightUnit = looseUnit(right.unit || suggestion.unit || "");
  if (left.number && right.number && left.number !== right.number) return true;
  if (left.name && right.name && left.name !== right.name) return true;
  if (rightUnit && leftUnit !== rightUnit) return true;
  return false;
}

function rejectPlace(place: PlaceDetection): PlaceDetection {
  return {
    ...place,
    jurisdiction: "unsure",
    area: null,
    inCalifornia: false,
    pack: null,
    localOrdinance: null,
    confidence: "low",
    notes: ["This does not look like a California address."],
  };
}

function localPlace(kept: KeptAddress): PlaceDetection {
  const region = kept.region || (isCaliforniaPostal(kept.postalCode) ? "CA" : "");
  return detectPlace({
    address: kept.street,
    city: kept.city,
    postalCode: kept.postalCode,
    region,
  });
}

function localCheck(kept: KeptAddress): AddressCheck {
  if (kept.postalCode && !isCaliforniaPostal(kept.postalCode)) {
    return { place: rejectPlace(localPlace(kept)), suggestion: null, differs: false, kept };
  }
  const place = localPlace(kept);
  if (!place.inCalifornia) return { place: rejectPlace(place), suggestion: null, differs: false, kept };
  return { place, suggestion: null, differs: false, kept };
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

function leadingNumber(value: string): string {
  const token = value.trim().split(/[\s,]+/)[0] || "";
  return /^\d+[a-z]?(?:-\d+[a-z]?)?$/i.test(token) ? token : "";
}

function censusStreet(match: CensusMatch, typedStreet: string): { street: string; unit: string } {
  const parts = match.addressComponents || {};
  const unit = unitFromLine(match.matchedAddress || "");
  const matchedLine = ((match.matchedAddress || "").split(",")[0] || "")
    .replace(/\b(?:apartment|apt|unit|suite|ste)\.?\s*#?\s*[a-z0-9-]+/i, "")
    .trim();
  const number = leadingNumber(matchedLine) || leadingNumber(typedStreet);
  const name = [parts.preDirection, parts.streetName, parts.suffixType].filter(Boolean).join(" ");
  if (number && name) return { street: titleCase(`${number} ${name}`), unit };
  if (matchedLine) return { street: titleCase(matchedLine), unit };
  return { street: titleCase(typedStreet), unit };
}

function censusCity(match: CensusMatch): string {
  const parts = match.addressComponents || {};
  const geo = match.geographies;
  const raw = geo?.["Incorporated Places"]?.[0]?.NAME || geo?.["Incorporated Places"]?.[0]?.BASENAME || parts.city || "";
  return titleCase(String(raw).replace(/\s+city$/i, ""));
}

function suggestionLabel(street: string, unit: string, city: string, postalCode: string): string {
  const line = unit ? `${street} Unit ${unit}` : street;
  return `${line}, ${city}, CA ${postalCode}`.replace(/\s+/g, " ").trim();
}

export async function suggestPlace(input: string | AddressFields): Promise<AddressCheck> {
  const kept = tidyAddress(asFields(input));
  if (kept.postalCode && !isCaliforniaPostal(kept.postalCode)) return localCheck(kept);
  const query = [kept.street, kept.city, kept.region || "CA", kept.postalCode].filter(Boolean).join(", ");
  try {
    const match = await censusMatch(query, 2500);
    if (!match) return localCheck(kept);
    const parts = match.addressComponents || {};
    const censusState = String(parts.state || "").trim().toUpperCase();
    if (censusState && censusState !== "CA") return { place: rejectPlace(localPlace(kept)), suggestion: null, differs: false, kept };
    const city = censusCity(match) || kept.city;
    const postalCode = String(parts.zip || kept.postalCode);
    const county = match.geographies?.Counties?.[0]?.NAME || "";
    const parsed = censusStreet(match, kept.street);
    const detected = detectPlace({
      address: kept.street,
      city: city || kept.city,
      postalCode: kept.postalCode || postalCode,
      region: county || kept.region || "CA",
    });
    const place = detected.inCalifornia ? detected : localPlace(kept);
    if (!place.inCalifornia) return { place: rejectPlace(place), suggestion: null, differs: false, kept };
    const candidate: AddressSuggestion | null = parsed.street && city && (postalCode || kept.postalCode)
      ? {
          label: suggestionLabel(parsed.street, parsed.unit, city, postalCode || kept.postalCode),
          street: parsed.street,
          city,
          region: "CA",
          postalCode: postalCode || kept.postalCode,
          unit: parsed.unit,
        }
      : null;
    const differs = candidate ? addressDiffers(kept, candidate) : false;
    return { place, suggestion: differs ? candidate : null, differs, kept };
  } catch {
    return localCheck(kept);
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
