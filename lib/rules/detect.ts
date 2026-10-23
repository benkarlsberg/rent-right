import { CITY_PACKS } from "@/lib/rules/cities";
import { LOCAL_ORDINANCES, type LocalOrdinance } from "@/lib/rules/cities/local-directory";
import type { CityPack } from "@/lib/rules/cities/types";
import type { AreaKey, Jurisdiction } from "@/lib/rules/engine";

export type PlaceQuery = {
  address?: string;
  city?: string;
  postalCode?: string;
  region?: string;
};

export type PlaceDetection = {
  jurisdiction: Jurisdiction;
  area: AreaKey | null;
  inCalifornia: boolean;
  pack: CityPack | null;
  localOrdinance: LocalOrdinance | null;
  confidence: "low" | "medium";
  notes: string[];
};

const COUNTY_AREAS: { area: AreaKey; name: string }[] = [
  { area: "los_angeles_orange", name: "los angeles county" },
  { area: "los_angeles_orange", name: "orange county" },
  { area: "riverside_san_bernardino", name: "riverside county" },
  { area: "riverside_san_bernardino", name: "san bernardino county" },
  { area: "san_diego", name: "san diego county" },
  { area: "san_francisco_bay", name: "alameda county" },
  { area: "san_francisco_bay", name: "contra costa county" },
  { area: "san_francisco_bay", name: "marin county" },
  { area: "san_francisco_bay", name: "san francisco county" },
  { area: "san_francisco_bay", name: "san mateo county" },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function zipsIn(value: string): string[] {
  return [...value.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)].map((match) => match[1]);
}

function isCaliforniaZip(zip: string): boolean {
  const prefix = Number(zip.slice(0, 3));
  return prefix >= 900 && prefix <= 961;
}

function areaFromZip(zip: string): AreaKey {
  const prefix = Number(zip.slice(0, 3));
  if ((prefix >= 900 && prefix <= 908) || (prefix >= 910 && prefix <= 916) || prefix === 918 || (prefix >= 926 && prefix <= 928)) {
    return "los_angeles_orange";
  }
  if (prefix >= 922 && prefix <= 925) return "riverside_san_bernardino";
  if (prefix >= 919 && prefix <= 921) return "san_diego";
  if ([940, 941, 944, 945, 946, 947, 948].includes(prefix)) return "san_francisco_bay";
  return "other_ca";
}

function areaFromText(text: string, zips: string[]): AreaKey {
  for (const county of COUNTY_AREAS) {
    if (text.includes(county.name)) return county.area;
  }
  const zip = zips.find(isCaliforniaZip);
  return zip ? areaFromZip(zip) : "other_ca";
}

function named(city: string, places: string[]): boolean {
  const normalized = normalize(city).replace(/^city of /, "");
  return places.some((place) => normalized === place);
}

function mentionedPlace(text: string, place: string): boolean {
  const re = new RegExp(`\\b${escapeRegExp(place)}\\b`, "ig");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const before = text.slice(Math.max(0, match.index - 8), match.index);
    const after = text.slice(match.index + place.length, match.index + place.length + 8);
    const directional = /^(south|north|east|west)\b/.test(place);
    if (!directional && /\b(south|north|east|west)\s$/.test(before)) continue;
    if (/^\s+county\b/.test(after)) continue;
    return true;
  }
  return false;
}

function bestPlace<T extends { places: string[] }>(text: string, items: T[]): T | null {
  let best: { item: T; length: number } | null = null;
  for (const item of items) {
    for (const place of item.places) {
      if (!mentionedPlace(text, place)) continue;
      if (!best || place.length > best.length) best = { item, length: place.length };
    }
  }
  return best?.item ?? null;
}

function zipHit<T extends { zips: string[] }>(items: T[], zips: string[]): T | null {
  return items.find((item) => item.zips.some((zip) => zips.includes(zip))) ?? null;
}

function unincorporatedPack(text: string, city: string): CityPack | null {
  const blob = normalize(`${city} ${text}`);
  if (!blob.includes("unincorporated")) return null;
  return bestPlace(blob, CITY_PACKS.filter((pack) => pack.match === "unincorporated"));
}

export function detectPlace(input: PlaceQuery): PlaceDetection {
  const address = normalize(input.address || "");
  const city = normalize(input.city || "");
  const region = normalize(input.region || "");
  const text = normalize(`${address} ${region}`);
  const zips = [...new Set([...zipsIn(input.postalCode || ""), ...zipsIn(address)])];
  const loaded = CITY_PACKS.filter((pack) => pack.match === "city");

  let pack: CityPack | null = null;
  let localOrdinance: LocalOrdinance | null = null;

  const countyPack = unincorporatedPack(text, city);
  if (countyPack) {
    pack = countyPack;
  } else if (city) {
    pack = loaded.find((item) => named(city, item.places)) ?? null;
    if (!pack) localOrdinance = LOCAL_ORDINANCES.find((item) => named(city, item.places)) ?? null;
    if (!pack && !localOrdinance) {
      pack = zipHit(loaded, zips);
      if (!pack) localOrdinance = zipHit(LOCAL_ORDINANCES, zips);
    }
  } else {
    pack = bestPlace(text, loaded);
    if (!pack) localOrdinance = bestPlace(text, LOCAL_ORDINANCES);
    if (!pack && !localOrdinance) {
      pack = zipHit(loaded, zips);
      if (!pack) localOrdinance = zipHit(LOCAL_ORDINANCES, zips);
    }
  }

  const stateNamed = /\b(california|calif)\b/.test(`${text} ${city}`) || /\bca\b/.test(region) || /\bca\b/.test(address);
  const zipIsCa = zips.some(isCaliforniaZip);
  const inCalifornia = Boolean(pack || localOrdinance || stateNamed || zipIsCa);

  if (pack) {
    const notes = [
      pack.jurisdiction === "city_la"
        ? "This looks like the City of Los Angeles. RSO coverage is still a ZIMAS question."
        : pack.jurisdiction === "city_sd"
          ? "This looks like the City of San Diego. Confirm the city limits."
          : pack.jurisdiction === "la_county_unincorporated"
            ? "This looks like unincorporated Los Angeles County. Confirm on the county map."
            : `This looks like ${pack.name}. Whether a particular unit is covered still has to be confirmed.`,
    ];
    return { jurisdiction: pack.jurisdiction, area: pack.area, inCalifornia: true, pack, localOrdinance: null, confidence: "low", notes };
  }

  if (!inCalifornia) {
    return {
      jurisdiction: "unsure",
      area: null,
      inCalifornia: false,
      pack: null,
      localOrdinance: null,
      confidence: "low",
      notes: [address || city || zips.length ? "This does not look like a California address." : "No address entered."],
    };
  }

  const area = localOrdinance?.area ?? areaFromText(`${text} ${city}`, zips);
  const notes = localOrdinance
    ? [`Statewide rules apply. Local rules in ${localOrdinance.name} may add protections.`]
    : ["Statewide California rules apply. No loaded local ordinance matched this address."];
  return {
    jurisdiction: "ca",
    area,
    inCalifornia: true,
    pack: null,
    localOrdinance,
    confidence: "low",
    notes,
  };
}

export function inferJurisdiction(address: string): {
  suggestion: Jurisdiction;
  confidence: "low" | "medium";
  notes: string[];
} {
  const place = detectPlace({ address });
  return { suggestion: place.jurisdiction, confidence: place.confidence, notes: place.notes };
}

export function placeSummary(place: PlaceDetection, locale: "en" | "es" = "en"): string {
  if (!place.inCalifornia) {
    const empty = place.notes.some((note) => note === "No address entered.");
    if (locale === "es") return empty ? "No hay dirección." : "Esa dirección no parece de California.";
    return empty ? "No address entered." : "That address does not look like California.";
  }
  const local = place.pack?.name || place.localOrdinance?.name || "";
  if (!local) return locale === "es" ? "Aplican las reglas de California." : "California rules apply.";
  if (place.pack?.jurisdiction === "city_la") {
    return locale === "es"
      ? "Aplican las reglas de California; el control de renta de Los Ángeles también puede aplicar."
      : "California rules apply; Los Angeles rent control may also apply.";
  }
  return locale === "es"
    ? `Aplican las reglas de California; las reglas locales de ${local} también pueden aplicar.`
    : `California rules apply; ${local} local rules may also apply.`;
}

export function localProtectionNote(ordinance: LocalOrdinance | null, locale: "en" | "es"): { text: string; url: string } | null {
  if (!ordinance) return null;
  return {
    text:
      locale === "es"
        ? `Las reglas locales de ${ordinance.name} pueden añadir protecciones.`
        : `Local rules in ${ordinance.name} may add protections.`,
    url: ordinance.housingUrl,
  };
}
