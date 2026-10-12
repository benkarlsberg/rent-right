import type { CityPack } from "@/lib/rules/cities/types";
import { pack as laCounty } from "@/lib/rules/cities/la-county";
import { pack as losAngeles } from "@/lib/rules/cities/los-angeles";
import { pack as sanDiego } from "@/lib/rules/cities/san-diego";

/** Loaded local programs. Register a new city by adding its pack here. */
export const CITY_PACKS: CityPack[] = [losAngeles, laCounty, sanDiego];
