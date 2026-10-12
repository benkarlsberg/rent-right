import type { OrdinanceRecord } from "@/lib/rules/cities/catalog";

export const RETRIEVED = "2026-10-12";

export type HousingType = "multi" | "sfh" | "condo" | "townhome";

export type LocalPeriod = {
  start: string;
  end: string;
  ppm: number;
  label: string;
  minUnits?: number;
  maxUnits?: number;
};

export type CoverageSource = "city-page" | "ordinance" | "ag-chart" | "unsure";

export type CoverageRule = {
  source: CoverageSource;
  sourceUrl: string;
  summary: string;
  /** True only when a city or ordinance page states a covered class this checker can test. */
  apply: boolean;
  /** Housing types the page treats as covered. Other non-exempt types stay on the statewide chart. */
  coveredTypes?: HousingType[];
  builtYearMax?: number;
  minUnits?: number;
  exemptTypes?: HousingType[];
  requireNotSubsidized?: boolean;
};

export type LocalVerification = {
  retrieved: typeof RETRIEVED;
  cap: "verified" | "unsure" | "none";
  /** Quoted formula text may contain a percent even when the current computed cap is unsure. */
  formulaPercent: boolean;
  capDetail: string;
  periods: LocalPeriod[];
  figure: string | null;
  window: string | null;
  coverage: CoverageRule;
  effectiveDate: string | null;
  effectiveNote: string;
};

export type LocalFacts = {
  builtYear: number | null;
  housingType: HousingType | null;
  unitCount: number | null;
  subsidized: boolean | null;
};

export type LocalDecision = {
  outcome: "applied" | "not_covered" | "fallback";
  ppm: number | null;
  label: string | null;
  ruleWindow: string | null;
  note: string;
  noteEs: string;
};

const AG = "https://oag.ca.gov/rentcaps";

function dateNote(record: OrdinanceRecord): string {
  if (record.effectiveDate) return `The official source dates this ordinance ${record.effectiveDate}.`;
  if (record.adoptedNote) return record.adoptedNote;
  return "The effective date is unsure.";
}

/** Notable limitations copied from the Attorney General chart retrieved 2026-10-12. Ordinance text was not retrieved for these. */
const AG_COVERAGE: Record<string, string> = {
  alameda: "Attorney General chart: one increase in 12 months of 70% of CPI, up to 5%, with a 1% floor if CPI change is below 1%. Not applicable to Section 8 voucher holders. Banking is limited. Ordinance text was not retrieved, so a unit is not treated as covered.",
  berkeley: "Attorney General chart: certificates of occupancy before 6/30/80; 65% of CPI up to 7%; no increase in the first 2 years. Ordinance text was not retrieved, so a unit is not treated as covered.",
  hayward: "Attorney General chart: certificates of occupancy before 7/1/79; up to 5% in 12 months; banking up to a 10% total. Ordinance text was not retrieved, so a unit is not treated as covered.",
  oakland: "Attorney General chart: certificate of occupancy before 1/1/83; 60% of CPI up to 3%. Ordinance text was not retrieved, so a unit is not treated as covered.",
  concord: "Attorney General chart: up to 5% in a 12-month period (chapter 19.40). Ordinance text was not retrieved, so a unit is not treated as covered.",
  richmond: "Attorney General chart: 60% of CPI up to 3%; banking up to 5% (chapter 11.100). Ordinance text was not retrieved, so a unit is not treated as covered.",
  "bell-gardens": "Attorney General chart: 50% of CPI up to 4%; units below 80% of fair market value may get an extra 3% (chapter 5.62). Ordinance text was not retrieved, so a unit is not treated as covered.",
  "beverly-hills": "Attorney General chart: 3% or 100% of CPI if CPI is higher. A different formula applies to some pre-9/20/78 tenancies that started at $600 or less. Ordinance text was not retrieved, so a unit is not treated as covered.",
  cudahy: "Attorney General chart: 100% of CPI up to 3% (chapter 5.13). Ordinance text was not retrieved, so a unit is not treated as covered.",
  maywood: "Attorney General chart: 100% of CPI up to 4%. Ordinance text was not retrieved, so a unit is not treated as covered.",
  pomona: "Attorney General chart: 1% to 5% in a 12-month period; not applicable to Section 8. The chart says the ordinance remains in effect only through 2026-12-31 unless reauthorized. Ordinance text was not retrieved, so a unit is not treated as covered.",
  "santa-monica": "Attorney General chart: certificates of occupancy before 4/10/79; 75% of CPI up to 3%. Not applicable to buildings of 1-3 units where the owner lives in one unit for the whole tenancy. Ordinance text was not retrieved, so a unit is not treated as covered.",
  "santa-ana": "Attorney General chart: 80% of CPI up to 3%. Ordinance text was not retrieved, so a unit is not treated as covered.",
  sacramento: "Attorney General chart: 5% plus CPI up to 10% (chapter 5.156). Ordinance text was not retrieved, so a unit is not treated as covered.",
  "san-francisco": "Attorney General chart: certificates of occupancy before 6/13/79; up to 60% of CPI. Ordinance text was not retrieved, so a unit is not treated as covered.",
  "mountain-view": "Attorney General chart: 100% of CPI up to 5%, with a 2% floor; banking up to 10%. Ordinance text was not retrieved, so a unit is not treated as covered.",
  "san-jose": "Attorney General chart: buildings with 3 or more units and certificates of occupancy on or before 9/7/79; up to 5%. Ordinance text was not retrieved, so a unit is not treated as covered.",
  "east-palo-alto": "Attorney General chart: certificates of occupancy on or before 1/1/88; 80% of CPI up to 10%. Not applicable to Section 8, or to buildings of 3 or fewer units where the owner has lived in one unit for at least a year. Ordinance text was not retrieved, so a unit is not treated as covered.",
  ojai: "Attorney General chart: up to 4% every 12 months. Not applicable to Section 8. Ordinance text was not retrieved, so a unit is not treated as covered.",
  oxnard: "Attorney General chart: up to 4% every 12 months. Not applicable to a 2-unit building where the owner lives in one unit for the whole tenancy. Ordinance text was not retrieved, so a unit is not treated as covered.",
};

const SPECIAL: Record<string, LocalVerification> = {
  "san-leandro": {
    retrieved: RETRIEVED,
    cap: "unsure",
    formulaPercent: true,
    periods: [],
    figure: null,
    window: null,
    capDetail:
      "The city rent program page says Ordinance 2026-001 was adopted on 2026-02-02 and the local cap takes effect on 2027-01-01. Until then, the page says increases are governed by the lease and state law. The page states the later cap as the lower of 3% or 65% of CPI, based on the rent in effect on 2025-07-01. It does not publish a computed percentage. The current percentage is unsure. The Attorney General chart publishes 3.3% of the rent in effect on 2025-07-01 for 2027-01-01 through 2027-06-30. That chart figure is not on the city page and is not a percentage of current rent, so it is not applied.",
    coverage: {
      source: "city-page",
      sourceUrl: "https://www.sanleandro.org/1483/Rent-Program",
      apply: false,
      summary: "The city page says some housing types are exempt and does not list them on the page retrieved. A unit is not treated as covered.",
    },
    effectiveDate: "2027-01-01",
    effectiveNote: "The city page dates the rent-stabilization ordinance as effective 2027-01-01. Ordinance 2026-001 was adopted on 2026-02-02.",
  },
  antioch: {
    retrieved: RETRIEVED,
    cap: "verified",
    formulaPercent: false,
    periods: [{ start: "2026-09-14", end: "2026-11-10", ppm: 20_400, label: "2.04%" }],
    figure: "2.04%",
    window: "2026-09-14 through 2026-11-10",
    capDetail:
      "The city rent program page publishes 2.04% for a rent increase effective 2026-09-14 through 2026-11-10 (60% of a 3.4% CPI change, under the 3% cap in section 11-1.04). The page says the ordinance became effective on 2022-11-11. Exemptions are in section 11-1.08, which was not retrieved, so the percentage is not applied.",
    coverage: {
      source: "city-page",
      sourceUrl: "https://www.antiochca.gov/1056/Rent-Program",
      apply: false,
      summary: "The city page points to section 11-1.08 for exemptions. That section was not retrieved, so no unit is treated as covered.",
    },
    effectiveDate: "2022-11-11",
    effectiveNote: "The city page says the rent stabilization ordinance became effective on 2022-11-11.",
  },
  "baldwin-park": {
    retrieved: RETRIEVED,
    cap: "verified",
    formulaPercent: false,
    periods: [{ start: "2026-08-01", end: "2027-07-31", ppm: 37_000, label: "3.7%" }],
    figure: "3.7%",
    window: "2026-08-01 through 2027-07-31",
    capDetail:
      "The city rent stabilization page says that effective 2026-08-01 the maximum allowable increase is 3.7%. The Attorney General chart dates that same 3.7% figure to 2026-08-01 through 2027-07-31. The city page does not itself state the end date.",
    coverage: {
      source: "city-page",
      sourceUrl: "https://www.baldwinpark.com/399/Rent-Stabilization-Ordinance",
      apply: true,
      coveredTypes: ["multi"],
      builtYearMax: 1994,
      minUnits: 3,
      exemptTypes: ["sfh", "condo", "townhome"],
      requireNotSubsidized: true,
      summary:
        "City page: residential rentals built prior to 1995-01-01, except single-family homes, condominiums, and townhomes that can be sold separately; owner-occupied duplexes; Section 8 and other government-subsidized tenants; and other listed categories. A 2-unit building is not treated as covered here because the page exempts owner-occupied duplexes and owner occupancy was not a fact. Ordinance numbers 1447 and 1522 are named. Their adoption dates were not on the page.",
    },
    effectiveDate: null,
    effectiveNote: "The adoption date of Ordinance 1447 is unsure. The page does not state it. The 3.7% figure is effective 2026-08-01.",
  },
  commerce: {
    retrieved: RETRIEVED,
    cap: "unsure",
    formulaPercent: false,
    periods: [],
    figure: null,
    window: null,
    capDetail:
      "The city housing page returned an access error on retrieval. The Attorney General chart says Commerce uses the same formula as the Tenant Protection Act and also says the applicable increase is 3.7% for 2026-07-01 through 2027-06-30. The same chart's Los Angeles Area row for 2026-08-01 through 2027-07-31 is 8.7%. Because those figures conflict and the city page was not retrieved, the current percentage is unsure.",
    coverage: {
      source: "unsure",
      sourceUrl: AG,
      apply: false,
      summary: "Ordinance text was not retrieved. The chart names chapter 9.95 and a Tenant Protection Act formula. A unit is not treated as covered.",
    },
    effectiveDate: null,
    effectiveNote: "The effective date is unsure. The city page was not retrieved.",
  },
  "culver-city": {
    retrieved: RETRIEVED,
    cap: "verified",
    formulaPercent: false,
    periods: [{ start: "2026-01-01", end: "2027-06-30", ppm: 32_500, label: "3.25%" }],
    figure: "3.25%",
    window: "2026-06-01 through 2027-06-30, and the same 3.25% on the city table for 2026-01-01 through 2026-05-31",
    capDetail:
      "The city rent stabilization page says the maximum permissible annual rent increase is 3.25% for increases effective on or after 2026-06-01 through 2027-06-30. The same page's table also lists 3.25% for each month from 2026-01-01 through 2026-05-31.",
    coverage: {
      source: "city-page",
      sourceUrl: "https://www.culvercity.org/Services/Housing-Homeless-Human-Services/Rent-Control-Tenant-Protection-Measures",
      apply: true,
      coveredTypes: ["multi"],
      builtYearMax: 1994,
      minUnits: 2,
      summary:
        "City page: rent stabilization applies to parcels with two or more rental units built on or before 1995-02-01. Units built after 1995-02-01 are exempt. Single-family homes, townhomes, and condos are described as exempt except in certain circumstances, so those types are not treated as clearly covered or clearly exempt. The permanent ordinances went into effect on 2020-10-30. Clarifying amendments adopted 2026-01-12 went into effect on 2026-02-11.",
    },
    effectiveDate: "2020-10-30",
    effectiveNote: "The city page says the permanent rent ordinances went into effect on 2020-10-30. Amendments adopted on 2026-01-12 went into effect on 2026-02-11.",
  },
  "huntington-park": {
    retrieved: RETRIEVED,
    cap: "unsure",
    formulaPercent: true,
    periods: [],
    figure: null,
    window: null,
    capDetail:
      "The city page says the ordinance was adopted on 2024-11-18 and in effect on 2024-12-19. It limits increases to 3% a year or 100% of CPI for the Los Angeles-Long Beach-Anaheim region, whichever is lower. It does not publish the current CPI result, so the current percentage is unsure.",
    coverage: {
      source: "city-page",
      sourceUrl: "https://hpca.gov/849/Learn-about-Rent-Stabilization",
      apply: false,
      summary: "The city page says owners must register or claim an exemption. The exemption list was not on the page retrieved, so a unit is not treated as covered.",
    },
    effectiveDate: "2024-12-19",
    effectiveNote: "The city page says the ordinance was adopted on 2024-11-18 and in effect as of 2024-12-19.",
  },
  inglewood: {
    retrieved: RETRIEVED,
    cap: "verified",
    formulaPercent: false,
    periods: [
      { start: "2026-07-01", end: "2027-06-30", ppm: 37_000, label: "3.7%", minUnits: 5 },
      { start: "2026-07-01", end: "2027-06-30", ppm: 87_000, label: "8.7%", minUnits: 1, maxUnits: 4 },
    ],
    figure: "3.7% for 5 or more units; 8.7% for 4 or fewer units",
    window: "2026-07-01 through 2027-06-30",
    capDetail:
      "The city allowable-increases page, retrieved 2026-10-12, states CPI of 3.7% published 2026-05-12. For 4 or fewer units the page states 8.7% (5% plus CPI). For 5 or more units it states 3.7% (3% or CPI, whichever is greater). No increase may exceed 10%. The Attorney General chart dates that split to 2026-07-01 through 2027-06-30. The city page also says the table applies to rent increases after 2025-06-30. The checker uses the chart window because that is the window both sources state for these two figures. The page's 15-year certificate-of-occupancy exemption is not the same fact as a build year, so the figures are not applied.",
    coverage: {
      source: "city-page",
      sourceUrl: "https://www.cityofinglewood.org/1594/Allowable-Rent-Increases",
      apply: false,
      summary:
        "City page exemptions include a certificate of occupancy within the last 15 years, an owner-occupied duplex, stated institutional and deed-restricted housing, and single-family homes and condominiums only when both the ownership test and the state notice are met. Certificate date was not collected, so a unit is not treated as covered.",
    },
    effectiveDate: null,
    effectiveNote: "The ordinance effective date is unsure. It was not on the allowable-increases page.",
  },
  larkspur: {
    retrieved: RETRIEVED,
    cap: "unsure",
    formulaPercent: true,
    periods: [],
    figure: null,
    window: null,
    capDetail:
      "The city page says Ordinances 1067 and 1068 limit a 12-month increase to 5% plus CPI or 7%, whichever is lower. It tells the reader to add the latest CPI and does not state the resulting percentage. The current percentage is unsure.",
    coverage: {
      source: "city-page",
      sourceUrl: "https://www.ci.larkspur.ca.us/878/Eviction-Protections-and-Rent-Regulation",
      apply: false,
      summary: "The city page describes Costa-Hawkins limits and does not list a city covered class that this review could apply. A unit is not treated as covered.",
    },
    effectiveDate: null,
    effectiveNote: "The effective date is unsure. Ordinances 1067 and 1068 are named. Their dates were not on the page.",
  },
  salinas: {
    retrieved: RETRIEVED,
    cap: "unsure",
    formulaPercent: true,
    periods: [],
    figure: null,
    window: null,
    capDetail:
      "The city page says the allowable increase is the lesser of 2.75% or 75% of the most recent 12-month CPI-U change, and that CPI-U is published monthly. An August 2025 example on the page comes out to 2.4%. That example is not stated as the current allowable increase, so the current percentage is unsure. The page says the rental ordinances remain in effect until the 2026-11-03 repeal vote.",
    coverage: {
      source: "city-page",
      sourceUrl: "https://www.salinas.gov/Residents/Community/Housing-Community-Development/Rental-Registration-Rent-Stabilization",
      apply: false,
      summary:
        "The city fee schedule says multi-family dwellings built before 1995-02-01 are subject to rent stabilization, and single-family homes, condominiums, and multi-family dwellings built after 1995-02-01 are not. The current percentage is unsure, so the local cap is not applied.",
    },
    effectiveDate: "2025-01-01",
    effectiveNote: "The city page says the rental ordinances were put in place beginning 2025-01-01.",
  },
  "palm-springs": {
    retrieved: RETRIEVED,
    cap: "unsure",
    formulaPercent: false,
    periods: [],
    figure: null,
    window: null,
    capDetail:
      "The city rent control page describes a 1980 ordinance that limits rents to 75% of the CPI increase from a 1979 base year, plus later amendments including Measure KK on 1994-12-17. It does not state a current annual percentage. The current percentage is unsure.",
    coverage: {
      source: "city-page",
      sourceUrl: "https://www.palmspringsca.gov/government/departments/housing-community-development/rent-control",
      apply: false,
      summary:
        "City page exemptions: units built after April 1979; units that rented for more than $450 in 1979; government-owned or subsidized units; hotels; buildings of four or fewer units with an owner occupant; and certain rents on Indian land. No current annual percentage was stated, so the local cap is not applied.",
    },
    effectiveDate: null,
    effectiveNote: "The page says the ordinance was a voter initiative first adopted in 1980. Measure KK passed on 1994-12-17. A single operative effective date for the current text is unsure.",
  },
  "thousand-oaks": {
    retrieved: RETRIEVED,
    cap: "unsure",
    formulaPercent: false,
    periods: [],
    figure: null,
    window: null,
    capDetail:
      "The city housing page says apartment rent control does not apply to a tenant who moved in after 1987, and that only tenants who have lived in the same eligible unit since 1987 are eligible. It does not state a percentage. The current percentage is unsure. The page also says the city has a program for mobile homes and does not state that percentage.",
    coverage: {
      source: "city-page",
      sourceUrl: "https://toaks.gov/housing",
      apply: false,
      summary: "City page: apartment rent control is limited to tenants in the same eligible unit since 1987. No percentage was stated, so the local cap is not applied.",
    },
    effectiveDate: null,
    effectiveNote: "The effective date is unsure. It was not on the housing page.",
  },
  "los-gatos": {
    retrieved: RETRIEVED,
    cap: "unsure",
    formulaPercent: true,
    periods: [],
    figure: null,
    window: null,
    capDetail:
      "Municode section 14.80.015, retrieved 2026-10-12, says an annual increase shall not exceed 70% of CPI or 5%, whichever is greater, unless an arbitrator allows more. CPI is the San Francisco-Oakland All Urban Consumers index. The code does not publish the current computed percentage. The current percentage is unsure. The section shows Ordinance 1803 dated 1989-11-20, Ordinance 2044 dated 1998-05-04, and Ordinance 2128 dated 2004-03-15.",
    coverage: {
      source: "ordinance",
      sourceUrl: "https://library.municode.com/ca/los_gatos/codes/code_of_ordinances?nodeId=CO_CH14LIMIBURE_ARTVIIIREOTLATEDI",
      apply: false,
      summary:
        "The ordinance exempts the first increase after new construction, a voluntary vacancy, a court eviction for nonpayment or a written-lease violation, and a 10% or smaller increase when the last increase was at least two years earlier. It does not state a build-year covered class this checker can apply, and the current percentage is unsure.",
    },
    effectiveDate: "1989-11-20",
    effectiveNote: "Municode dates Ordinance 1803 to 1989-11-20, with later amendments dated 1998-05-04 and 2004-03-15. Whether 1989-11-20 is the operative date of the current section is the ordinance date printed on that section.",
  },
  pasadena: {
    retrieved: RETRIEVED,
    cap: "verified",
    formulaPercent: false,
    periods: [
      { start: "2024-10-01", end: "2025-09-30", ppm: 30_000, label: "3%" },
      { start: "2025-10-01", end: "2026-09-30", ppm: 22_500, label: "2.25%" },
      { start: "2026-10-01", end: "2027-09-30", ppm: 25_000, label: "2.5%" },
    ],
    figure: "2.5%",
    window: "2026-10-01 through 2027-09-30",
    capDetail:
      "The city rent-levels page states an annual general adjustment of 3% for 2024-10-01 through 2025-09-30 and 2.25% for 2025-10-01 through 2026-09-30. The Rent Stabilization Department news page dated 2026-08-31 says the Rental Housing Board adopted 2.5% on 2026-06-18 for 2026-10-01 through 2027-09-30: https://www.cityofpasadena.net/rent-stabilization/news-announcements/pasadena-rental-housing-board-approves-2-5-annual-general-adjustment-for-2026-2027/.",
    coverage: {
      source: "city-page",
      sourceUrl: "https://www.cityofpasadena.net/rent-stabilization/info-sheets/rent-levels-and-rent-increases/",
      apply: true,
      coveredTypes: ["multi"],
      builtYearMax: 1995,
      minUnits: 2,
      exemptTypes: ["sfh", "condo"],
      summary:
        "City page: the annual general adjustment applies except to multifamily units constructed after 1995, single-family homes or condominiums that can be sold separately, inclusionary or density-bonus units, a unit where the tenant shares a bathroom or kitchen with an owner occupant, specified tax-credit units, specified government units, and a short temporary rental of an owner-occupied house. Inclusionary, shared-kitchen, tax-credit, and government status were not separate facts. A multi-unit building with a build year of 1995 or earlier is treated as covered. The charter adoption date was not on the pages retrieved.",
    },
    effectiveDate: null,
    effectiveNote: "The charter adoption date is unsure. It was not on the rent-levels page or the 2026-08-31 adjustment announcement.",
  },
  "west-hollywood": {
    retrieved: RETRIEVED,
    cap: "verified",
    formulaPercent: false,
    periods: [
      { start: "2025-09-01", end: "2026-08-31", ppm: 22_500, label: "2.25%" },
      { start: "2026-09-01", end: "2027-08-31", ppm: 27_500, label: "2.75%" },
    ],
    figure: "2.75%",
    window: "2026-09-01 through 2027-08-31",
    capDetail:
      "The city rent stabilization page states 2.25% as the maximum increase effective 2025-09-01 through 2026-08-31. The Rent Stabilization Commission staff report for 2026-06-25 states that beginning 2026-09-01 the annual general adjustment will be 2.75% through 2027-08-31, and that the adjustment may not exceed 3%.",
    coverage: {
      source: "ag-chart",
      sourceUrl: "https://weho.granicus.com/MetaViewer.php?clip_id=4378&meta_id=322079&view_id=23",
      apply: false,
      summary:
        "The Attorney General chart says the local cap is for certificates of occupancy issued before 1979-07-01. That cutoff was not restated on the commission report or the rent stabilization homepage retrieved here, and a certificate date is not a build year. A unit is not treated as covered.",
    },
    effectiveDate: null,
    effectiveNote: "The ordinance effective date is unsure. It was not on the pages retrieved. The commission report cites Municipal Code sections 17.36.020 and 17.36.030 for the adjustment formula.",
  },
};

export function verificationFor(record: OrdinanceRecord): LocalVerification {
  const special = SPECIAL[record.id];
  if (special) return special;
  if (record.capStatus === "none") {
    return {
      retrieved: RETRIEVED,
      cap: "none",
      formulaPercent: false,
      periods: [],
      figure: null,
      window: null,
      capDetail: record.detail || "No local percentage was found in the official source.",
      coverage: {
        source: "city-page",
        sourceUrl: record.sourceUrl,
        apply: false,
        summary: "This ordinance is not a local percentage cap. The checker uses the statewide chart.",
      },
      effectiveDate: record.effectiveDate,
      effectiveNote: dateNote(record),
    };
  }
  if (record.capStatus === "published" && record.figure && record.window) {
    return {
      retrieved: RETRIEVED,
      cap: "verified",
      formulaPercent: false,
      periods: [],
      figure: record.figure,
      window: record.window,
      capDetail: `The Attorney General chart, retrieved ${RETRIEVED}, publishes ${record.figure} for ${record.window}. The ordinance text was not retrieved, so that figure is not applied.`,
      coverage: {
        source: "ag-chart",
        sourceUrl: AG,
        apply: false,
        summary: AG_COVERAGE[record.id] ?? "The Attorney General chart lists this ordinance. Ordinance text was not retrieved, so a unit is not treated as covered.",
      },
      effectiveDate: record.effectiveDate,
      effectiveNote: dateNote(record),
    };
  }
  return {
    retrieved: RETRIEVED,
    cap: "unsure",
    formulaPercent: false,
    periods: [],
    figure: null,
    window: null,
    capDetail: record.detail || "The current percentage is unsure.",
    coverage: {
      source: "unsure",
      sourceUrl: record.sourceUrl,
      apply: false,
      summary: "Coverage criteria were not confirmed from an official page in this review.",
    },
    effectiveDate: record.effectiveDate,
    effectiveNote: dateNote(record),
  };
}

function periodFor(periods: LocalPeriod[], effectiveDate: string, unitCount: number | null): LocalPeriod | null {
  return (
    periods.find((period) => {
      if (effectiveDate < period.start || effectiveDate > period.end) return false;
      if (period.minUnits != null && (unitCount == null || unitCount < period.minUnits)) return false;
      if (period.maxUnits != null && (unitCount == null || unitCount > period.maxUnits)) return false;
      return true;
    }) ?? null
  );
}

export function evaluateLocalCap(verification: LocalVerification, facts: LocalFacts, effectiveDate: string): LocalDecision {
  const figure = verification.figure && verification.window ? `${verification.figure} for ${verification.window}` : null;
  const quoted = figure ? ` The official figure on file is ${figure}.` : "";
  const fallbackNote = `The statewide AB 1482 chart is the cap used here.${quoted} ${verification.capDetail} ${verification.coverage.summary}`;
  const fallbackNoteEs = `La tabla estatal de AB 1482 es el tope usado aquí.${quoted} La cobertura local no quedó confirmada con estos datos.`;

  if (!verification.coverage.apply || verification.periods.length === 0) {
    return { outcome: "fallback", ppm: null, label: null, ruleWindow: null, note: fallbackNote, noteEs: fallbackNoteEs };
  }

  const rule = verification.coverage;
  const exempt = facts.housingType != null && rule.exemptTypes?.includes(facts.housingType);
  const tooNew = facts.builtYear != null && rule.builtYearMax != null && facts.builtYear > rule.builtYearMax;
  const tooSmall = facts.unitCount != null && rule.minUnits != null && facts.unitCount < rule.minUnits;
  const subsidized = rule.requireNotSubsidized === true && facts.subsidized === true;
  if (exempt || tooNew || tooSmall || subsidized) {
    return {
      outcome: "not_covered",
      ppm: null,
      label: null,
      ruleWindow: null,
      note: `These facts fall outside the covered class on the official page. The checker uses the statewide chart. ${rule.summary}`,
      noteEs: "Estos datos quedan fuera de la clase cubierta en la página oficial. La herramienta usa la tabla estatal.",
    };
  }

  const unclearType =
    facts.housingType != null && rule.coveredTypes != null && !rule.coveredTypes.includes(facts.housingType);
  if (unclearType) {
    return {
      outcome: "fallback",
      ppm: null,
      label: null,
      ruleWindow: null,
      note: `This housing type is not clearly covered or clearly exempt on the official page. The checker uses the statewide chart. ${rule.summary}`,
      noteEs: "Este tipo de vivienda no está claramente cubierto ni claramente exento en la página oficial. La herramienta usa la tabla estatal.",
    };
  }

  const missing =
    facts.housingType == null ||
    (rule.builtYearMax != null && facts.builtYear == null) ||
    (rule.minUnits != null && facts.unitCount == null) ||
    (rule.requireNotSubsidized === true && facts.subsidized == null);
  if (missing) {
    return { outcome: "fallback", ppm: null, label: null, ruleWindow: null, note: fallbackNote, noteEs: fallbackNoteEs };
  }

  const period = periodFor(verification.periods, effectiveDate, facts.unitCount);
  if (!period) {
    return {
      outcome: "fallback",
      ppm: null,
      label: null,
      ruleWindow: null,
      note: `The facts match the covered class, and no local percentage in this library covers ${effectiveDate}. The checker uses the statewide chart. ${verification.capDetail}`,
      noteEs: `Los datos coinciden con la clase cubierta, y esta biblioteca no tiene un porcentaje local para ${effectiveDate}. La herramienta usa la tabla estatal.`,
    };
  }

  return {
    outcome: "applied",
    ppm: period.ppm,
    label: period.label,
    ruleWindow: `${period.start} through ${period.end}`,
    note: `The facts match the covered class on the official page, so the local figure ${period.label} for ${period.start} through ${period.end} is applied. ${rule.summary} Other exemptions that were not asked about are not verified.`,
    noteEs: `Los datos coinciden con la clase cubierta en la página oficial, así que se aplica la cifra local de ${period.label} para ${period.start} a ${period.end}. Otras exenciones que no se preguntaron no están verificadas.`,
  };
}

const HOUSING_TYPES: HousingType[] = ["multi", "sfh", "condo", "townhome"];

/** Reads optional coverage facts. Blank input returns undefined. A filled invalid value throws. */
export function parseLocalFacts(raw: {
  builtYear?: unknown;
  housingType?: unknown;
  unitCount?: unknown;
  subsidized?: unknown;
}): LocalFacts | undefined {
  const yearText = raw.builtYear == null ? "" : String(raw.builtYear).trim();
  const unitsText = raw.unitCount == null ? "" : String(raw.unitCount).trim();
  const typeText = raw.housingType == null ? "" : String(raw.housingType).trim().toLowerCase();
  const subsidyText = raw.subsidized == null ? "" : String(raw.subsidized).trim().toLowerCase();
  if (!yearText && !unitsText && !typeText && !subsidyText) return undefined;

  const housingType = HOUSING_TYPES.find((item) => item === typeText) ?? null;
  if (typeText && !housingType) throw new Error("Kind must be multi, sfh, condo, or townhome.");

  const builtYear = yearText ? Number(yearText) : null;
  if (yearText && (!Number.isInteger(builtYear) || builtYear! < 1800 || builtYear! > 2100)) {
    throw new Error("Enter a four-digit build year.");
  }

  const unitCount = unitsText ? Number(unitsText) : null;
  if (unitsText && (!Number.isInteger(unitCount) || unitCount! < 1 || unitCount! > 10000)) {
    throw new Error("Enter the number of units.");
  }

  let subsidized: boolean | null = null;
  if (subsidyText === "yes" || subsidyText === "true") subsidized = true;
  else if (subsidyText === "no" || subsidyText === "false") subsidized = false;
  else if (subsidyText) throw new Error("Subsidy must be yes or no.");

  return { builtYear, housingType, unitCount, subsidized };
}
