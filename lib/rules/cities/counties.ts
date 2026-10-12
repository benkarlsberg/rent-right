export type CountyStatus = "local-pack" | "state-law-only" | "city-county";

export type CountyCoverage = {
  name: string;
  status: CountyStatus;
  packId: string | null;
  note: string;
  sourceUrl: string;
};

const AG = "https://oag.ca.gov/rentcaps";

const NAMES = [
  "Alameda",
  "Alpine",
  "Amador",
  "Butte",
  "Calaveras",
  "Colusa",
  "Contra Costa",
  "Del Norte",
  "El Dorado",
  "Fresno",
  "Glenn",
  "Humboldt",
  "Imperial",
  "Inyo",
  "Kern",
  "Kings",
  "Lake",
  "Lassen",
  "Los Angeles",
  "Madera",
  "Marin",
  "Mariposa",
  "Mendocino",
  "Merced",
  "Modoc",
  "Mono",
  "Monterey",
  "Napa",
  "Nevada",
  "Orange",
  "Placer",
  "Plumas",
  "Riverside",
  "Sacramento",
  "San Benito",
  "San Bernardino",
  "San Diego",
  "San Francisco",
  "San Joaquin",
  "San Luis Obispo",
  "San Mateo",
  "Santa Barbara",
  "Santa Clara",
  "Santa Cruz",
  "Shasta",
  "Sierra",
  "Siskiyou",
  "Solano",
  "Sonoma",
  "Stanislaus",
  "Sutter",
  "Tehama",
  "Trinity",
  "Tulare",
  "Tuolumne",
  "Ventura",
  "Yolo",
  "Yuba",
] as const;

const STATE_NOTE =
  "Unincorporated residential tenancies: state law only in this review. No unincorporated rent-stabilization, just-cause, relocation, or tenant-protection ordinance was found on the Attorney General chart retrieved 2026-10-12 or in the targeted county search. This is not a page-by-page reading of the county code.";

const OVERRIDES: Record<string, Pick<CountyCoverage, "status" | "packId" | "note" | "sourceUrl">> = {
  Alameda: {
    status: "local-pack",
    packId: "alameda-county",
    note: "Unincorporated Alameda County has a just-cause ordinance (O-2025-9). It does not adopt a local rent-cap percentage. The effective date is unsure.",
    sourceUrl: "https://www.acgov.org/board/bos_calendar/documents/DocsAgendaReg_02_04_25/GENERAL%20ADMINISTRATION/Set%20Matter%20Calendar/CDA_381856.pdf",
  },
  Humboldt: {
    status: "state-law-only",
    packId: null,
    note: `${STATE_NOTE} A COVID-era urgency eviction ordinance is expired emergency law and is not packed.`,
    sourceUrl: AG,
  },
  "Los Angeles": {
    status: "local-pack",
    packId: "la-county-unincorporated",
    note: "Unincorporated Los Angeles County has the Rent Stabilization and Tenant Protections Ordinance. Cities in the county are separate.",
    sourceUrl: "https://dcba.lacounty.gov/rentstabilizationprogram/",
  },
  Marin: {
    status: "local-pack",
    packId: "marin-county",
    note: "Unincorporated Marin County has a just-cause ordinance (County Code ch. 5.100). No local percentage cap was found. The operative effective date is unsure.",
    sourceUrl: "https://www.marincounty.gov/departments/cda/housing-and-grants/renting-marin/just-cause-eviction",
  },
  Sacramento: {
    status: "state-law-only",
    packId: null,
    note: "The Attorney General chart lists the City of Sacramento, which has its own pack. Unincorporated Sacramento County is state law only in this review.",
    sourceUrl: AG,
  },
  "San Diego": {
    status: "state-law-only",
    packId: null,
    note: "The City of San Diego has a just-cause pack. Unincorporated San Diego County is state law only in this review.",
    sourceUrl: AG,
  },
  "San Francisco": {
    status: "city-county",
    packId: "san-francisco",
    note: "San Francisco is a consolidated city-county. There is no separate unincorporated area. The city pack covers it.",
    sourceUrl: "https://www.sf.gov/reports/march-2023/learn-about-rent-increases-san-francisco",
  },
  "Santa Cruz": {
    status: "local-pack",
    packId: "santa-cruz-county",
    note: "Unincorporated Santa Cruz County Code ch. 8.43 addresses retaliation and harassment. It is not a rent cap or a just-cause ordinance. The effective date is unsure.",
    sourceUrl: "https://www.codepublishing.com/CA/SantaCruzCounty/html/SantaCruzCounty08/SantaCruzCounty0843.html",
  },
  Sonoma: {
    status: "local-pack",
    packId: "sonoma-county",
    note: "Unincorporated Sonoma County adopted residential tenancy protections on 2024-09-17, including just cause and relocation augmentation. No local percentage cap was found. The operative effective date is unsure.",
    sourceUrl: "https://sonomacounty.gov/tenantprotections",
  },
};

export const COUNTIES: CountyCoverage[] = NAMES.map((name) => {
  const override = OVERRIDES[name];
  if (override) return { name, ...override };
  return {
    name,
    status: "state-law-only" as const,
    packId: null,
    note: STATE_NOTE,
    sourceUrl: AG,
  };
});

export const COUNTY_NAMES: readonly string[] = NAMES;
