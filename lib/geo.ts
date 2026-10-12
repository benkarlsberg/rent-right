import { inferJurisdiction, type Jurisdiction } from "@/lib/rules/engine";

export async function lookupJurisdiction(address: string): Promise<{ suggestion: Jurisdiction; note: string }> {
  const local = inferJurisdiction(address);
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
      return { suggestion: local.suggestion, note: local.notes.join(" ") || "No Census match. Choose the jurisdiction yourself." };
    }
    const place = geo["Incorporated Places"]?.[0]?.NAME || geo["Incorporated Places"]?.[0]?.BASENAME || "";
    const county = geo.Counties?.[0]?.NAME || "";
    let suggestion: Jurisdiction = "unsure";
    if (/los angeles/i.test(place)) suggestion = "city_la";
    else if (/san diego/i.test(place)) suggestion = "city_sd";
    else if (!place && /los angeles/i.test(county)) suggestion = "la_county_unincorporated";
    else if (place || county) suggestion = "other_ca";
    const note = `Census place: ${place || "none"}. County: ${county || "none"}. Confirm before you rely on a cap. ZIMAS: https://zimas.lacity.org/`;
    return { suggestion, note };
  } catch {
    return {
      suggestion: local.suggestion,
      note: `${local.notes.join(" ")} The Census geocoder was not reached. Choose the jurisdiction yourself.`.trim(),
    };
  }
}
