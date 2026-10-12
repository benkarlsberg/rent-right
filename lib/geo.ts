import { detectPlace, type PlaceDetection } from "@/lib/rules/detect";
import type { Jurisdiction } from "@/lib/rules/engine";

export async function lookupJurisdiction(address: string): Promise<{ suggestion: Jurisdiction; note: string; place: PlaceDetection }> {
  const local = detectPlace({ address });
  try {
    const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress");
    url.searchParams.set("address", address);
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("vintage", "Current_Current");
    url.searchParams.set("format", "json");
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("census");
    const body = (await response.json()) as {
      result?: { addressMatches?: { geographies?: Record<string, { NAME?: string; BASENAME?: string }[]> }[] };
    };
    const geo = body.result?.addressMatches?.[0]?.geographies;
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
