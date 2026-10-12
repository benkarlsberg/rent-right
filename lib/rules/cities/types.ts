import type { Rule } from "@/lib/rules/define";
import type { AreaKey } from "@/lib/rules/engine";
import type { LocalVerification } from "@/lib/rules/cities/verify";

export type CapStatus = "legacy" | "published" | "unsure" | "none";

/** One loaded city or county program. Hand-written files and catalog records both use this shape. */
export type CityPack = {
  id: string;
  jurisdiction: string;
  name: string;
  places: string[];
  zips: string[];
  area: AreaKey;
  housingName: string;
  housingUrl: string;
  rules: Rule[];
  /** City packs match a city name. Unincorporated packs match only when the address says unincorporated. */
  match: "city" | "unincorporated";
  county: string;
  capStatus: CapStatus;
  /** Primary-source check for catalog packs. Hand-written LA and San Diego packs omit it. */
  verification?: LocalVerification;
};
