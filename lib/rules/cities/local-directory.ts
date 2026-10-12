import type { AreaKey } from "@/lib/rules/engine";

/**
 * Ordinances that are known but not loaded as packs yet.
 * Loaded programs live in the catalog and in the hand-written LA and San Diego files.
 * Kept so a future unpacked city can still show the one-line phone note.
 */
export type LocalOrdinance = {
  id: string;
  name: string;
  places: string[];
  zips: string[];
  area: AreaKey;
  housingName: string;
  housingUrl: string;
};

export const LOCAL_ORDINANCES: LocalOrdinance[] = [];
