import type { Rule } from "@/lib/rules/define";
import type { AreaKey, Jurisdiction } from "@/lib/rules/engine";

/** One loaded city or county program. A new file exports `pack` in this shape. */
export type CityPack = {
  id: string;
  jurisdiction: Exclude<Jurisdiction, "ca" | "other_ca" | "unsure">;
  name: string;
  places: string[];
  zips: string[];
  area: AreaKey;
  housingName: string;
  housingUrl: string;
  rules: Rule[];
};
