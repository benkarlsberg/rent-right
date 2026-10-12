import type { CityPack } from "@/lib/rules/cities/types";
import { CATALOG_PACKS } from "@/lib/rules/cities/build-pack";
import { pack as laCounty } from "@/lib/rules/cities/la-county";
import { pack as losAngeles } from "@/lib/rules/cities/los-angeles";
import { pack as sanDiego } from "@/lib/rules/cities/san-diego";

/** Loaded local programs. Catalog records are built into packs; LA, LA County, and San Diego stay hand-written. */
export const CITY_PACKS: CityPack[] = [losAngeles, laCounty, sanDiego, ...CATALOG_PACKS];

export function packByJurisdiction(jurisdiction: string): CityPack | undefined {
  return CITY_PACKS.find((pack) => pack.jurisdiction === jurisdiction);
}

export function isAllowedJurisdiction(value: string): boolean {
  return value === "ca" || value === "other_ca" || value === "unsure" || CITY_PACKS.some((pack) => pack.jurisdiction === value);
}
