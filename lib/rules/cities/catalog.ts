import type { AreaKey } from "@/lib/rules/engine";
import type { CapStatus } from "@/lib/rules/cities/types";

/**
 * Local ordinances loaded as placeholder packs.
 * A catalog percentage is copied only when the Attorney General chart (retrieved 2026-10-12)
 * states one figure and a window. Every other catalog cap is "unsure" or "none".
 * Primary-source checks, including a later city-page figure, live in verify.ts.
 */
export type OrdinanceRecord = {
  id: string;
  name: string;
  places: string[];
  zips: string[];
  area: AreaKey;
  county: string;
  match: "city" | "unincorporated";
  housingName: string;
  housingUrl: string;
  citation: string;
  sourceName: string;
  sourceUrl: string;
  /** Ordinance effective date when an official source states one. Otherwise null. */
  effectiveDate: string | null;
  /**
   * Used when effectiveDate is null. Must say that the effective date is unsure.
   * May mention an adoption date the source actually states.
   */
  adoptedNote: string;
  capStatus: Exclude<CapStatus, "legacy">;
  /** Single chart figure, such as "2.7%". Null unless capStatus is "published". */
  figure: string | null;
  /** Date window printed with that figure. Null unless capStatus is "published". */
  window: string | null;
  /** Extra sentence. Unsure records must not add a percentage, except the Los Gatos formula. */
  detail: string;
  topic: "rent-cap" | "just-cause" | "tenant-protection";
};

export const ORDINANCES: OrdinanceRecord[] = [
  published({
    id: "alameda",
    name: "Alameda",
    places: ["alameda"],
    zips: ["94501", "94502"],
    area: "san_francisco_bay",
    county: "Alameda",
    housingName: "City of Alameda Rent Program",
    housingUrl: "https://www.alamedarentprogram.org/FAQs#Rent%20Increase%20Overview",
    citation: "Alameda Municipal Code §§6-58.10 et seq.",
    figure: "2.7%",
    window: "2026-09-01 through 2027-08-31",
  }),
  published({
    id: "berkeley",
    name: "Berkeley",
    places: ["berkeley"],
    zips: ["94702", "94703", "94704", "94705", "94707", "94708", "94709", "94710"],
    area: "san_francisco_bay",
    county: "Alameda",
    housingName: "Berkeley Rent Board",
    housingUrl: "https://rentboard.berkeleyca.gov/rights-responsibilities/rent-levels/annual-general-adjustment",
    citation: "Berkeley Municipal Code ch. 13.76",
    figure: "1%",
    window: "2026-01-01 through 2026-12-31",
  }),
  published({
    id: "hayward",
    name: "Hayward",
    places: ["hayward"],
    zips: ["94541", "94542", "94544", "94545"],
    area: "san_francisco_bay",
    county: "Alameda",
    housingName: "City of Hayward Housing",
    housingUrl: "https://www.hayward-ca.gov/residents/housing/landlord-rental-resources",
    citation: "Hayward Municipal Code art. 12-1",
    figure: "5%",
    window: "any 12-month period (a standing maximum on the Attorney General chart, not a one-year CPI result)",
  }),
  published({
    id: "oakland",
    name: "Oakland",
    places: ["oakland"],
    zips: ["94601", "94602", "94603", "94605", "94606", "94607", "94608", "94609", "94610", "94611", "94612", "94618", "94619", "94621"],
    area: "san_francisco_bay",
    county: "Alameda",
    housingName: "City of Oakland",
    housingUrl: "https://www.oaklandca.gov/resources/learn-more-about-allowable-rent-increases",
    citation: "Oakland Municipal Code ch. 8.22",
    figure: "2.3%",
    window: "2026-08-01 through 2027-07-31",
  }),
  unsure({
    id: "san-leandro",
    name: "San Leandro",
    places: ["san leandro"],
    zips: ["94577", "94578", "94579"],
    area: "san_francisco_bay",
    county: "Alameda",
    housingName: "City of San Leandro Rent Program",
    housingUrl: "https://www.sanleandro.org/1483/Rent-Program",
    citation: "San Leandro Municipal Code ch. 4-46",
    detail:
      "The Attorney General chart does not publish a single percentage of current rent for the printed window. The base it describes is an earlier rent. This library does not state a percentage.",
  }),
  unsure({
    id: "antioch",
    name: "Antioch",
    places: ["antioch"],
    zips: ["94509", "94531"],
    area: "san_francisco_bay",
    county: "Contra Costa",
    housingName: "City of Antioch Rent Program",
    housingUrl: "https://www.antiochca.gov/1056/Rent-Program",
    citation: "City of Antioch rent program (code section not confirmed in this review)",
    detail:
      "The Attorney General chart says the allowable increase is recalculated every one to two months. This library does not state a percentage.",
  }),
  published({
    id: "concord",
    name: "Concord",
    places: ["concord"],
    zips: ["94518", "94519", "94520", "94521"],
    area: "san_francisco_bay",
    county: "Contra Costa",
    housingName: "City of Concord",
    housingUrl: "https://www.cityofconcord.org/1172/Rent-Stabilization-and-Just-Cause-for-Ev",
    citation: "Concord Municipal Code ch. 19.40",
    figure: "5%",
    window: "any 12-month period",
  }),
  published({
    id: "richmond",
    name: "Richmond",
    places: ["richmond"],
    zips: ["94801", "94804", "94805"],
    area: "san_francisco_bay",
    county: "Contra Costa",
    housingName: "City of Richmond Rent Program",
    housingUrl: "https://www.ci.richmond.ca.us/3376/Rent-Increase",
    citation: "Richmond Municipal Code ch. 11.100",
    figure: "1.5%",
    window: "2026-09-01 through 2027-08-31",
  }),
  unsure({
    id: "baldwin-park",
    name: "Baldwin Park",
    places: ["baldwin park"],
    zips: ["91706"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "City of Baldwin Park",
    housingUrl: "https://www.baldwinpark.com/399/Rent-Stabilization-Ordinance",
    citation: "Baldwin Park Municipal Code ch. 117",
    detail: "The Attorney General chart tells the reader to check with the city and does not leave one figure to apply. This library does not state a percentage.",
  }),
  published({
    id: "bell-gardens",
    name: "Bell Gardens",
    places: ["bell gardens"],
    zips: [],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "City of Bell Gardens",
    housingUrl: "https://www.bellgardens.org/government/city-departments/community-development/faqs",
    citation: "Bell Gardens Municipal Code ch. 5.62",
    figure: "1.5%",
    window: "2025-11-01 through 2026-10-31",
  }),
  published({
    id: "beverly-hills",
    name: "Beverly Hills",
    places: ["beverly hills"],
    zips: ["90210", "90211", "90212"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "Beverly Hills Rent Stabilization",
    housingUrl: "https://www.beverlyhills.org/1090/Rent-Stabilization-Division",
    citation: "Beverly Hills Municipal Code §§4-5-101, 4-6-1",
    figure: "3.6%",
    window: "2026-07-01 through 2027-06-30",
  }),
  unsure({
    id: "commerce",
    name: "Commerce",
    places: ["commerce"],
    zips: ["90040"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "City of Commerce",
    housingUrl: "https://www.commerceca.gov/city-hall/economic-development-and-planning/housing",
    citation: "City of Commerce housing page (code section not confirmed in this review)",
    detail: "The Attorney General chart tells the reader to contact the city. This library does not state a percentage.",
  }),
  published({
    id: "cudahy",
    name: "Cudahy",
    places: ["cudahy"],
    zips: [],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "City of Cudahy",
    housingUrl: "https://www.cityofcudahy.com/432/Rent-Stabilization-and-Tenant-Protection",
    citation: "Cudahy Municipal Code ch. 5.13",
    figure: "3%",
    window: "2026-07-01 through 2027-06-30",
  }),
  unsure({
    id: "culver-city",
    name: "Culver City",
    places: ["culver city"],
    zips: ["90230", "90232"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "City of Culver City",
    housingUrl: "https://www.culvercity.org/Services/Housing-Homeless-Human-Services/Rent-Control-Tenant-Protection-Measures",
    citation: "City of Culver City rent control measures (code section not confirmed in this review)",
    detail: "The Attorney General chart says the figure is recalculated monthly. This library does not state a percentage.",
  }),
  unsure({
    id: "huntington-park",
    name: "Huntington Park",
    places: ["huntington park"],
    zips: ["90255"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "City of Huntington Park",
    housingUrl: "https://hpca.gov/849/Learn-about-Rent-Stabilization",
    citation: "City of Huntington Park rent stabilization page (code section not confirmed in this review)",
    detail: "The Attorney General chart says the figure is recalculated monthly. This library does not state a percentage.",
  }),
  unsure({
    id: "inglewood",
    name: "Inglewood",
    places: ["inglewood"],
    zips: ["90301", "90302", "90303", "90305"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "City of Inglewood",
    housingUrl: "https://www.cityofinglewood.org/1594/Allowable-Rent-Increases",
    citation: "City of Inglewood allowable rent increases (code section not confirmed in this review)",
    detail:
      "The Attorney General chart splits the figure by the number of units on the property. This library does not state a single percentage.",
  }),
  published({
    id: "maywood",
    name: "Maywood",
    places: ["maywood"],
    zips: ["90270"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "City of Maywood Housing Division",
    housingUrl: "https://www.cityofmaywood.com/239/Housing-Division",
    citation: "Maywood Municipal Code §§8-21.01",
    figure: "3.7%",
    window: "2026-07-01 through 2027-06-30",
  }),
  published({
    id: "pasadena",
    name: "Pasadena",
    places: ["pasadena"],
    zips: ["91101", "91103", "91104", "91105", "91106", "91107"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "Pasadena Rent Stabilization",
    housingUrl: "https://www.cityofpasadena.net/rent-stabilization/info-sheets/rent-levels-and-rent-increases/",
    citation: "Pasadena City Charter §§1801",
    figure: "2.25%",
    window: "2025-10-01 through 2026-09-30",
  }),
  published({
    id: "pomona",
    name: "Pomona",
    places: ["pomona"],
    zips: ["91766", "91767", "91768"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "City of Pomona Rent Stabilization",
    housingUrl: "https://www.pomonaca.gov/government/departments/neighborhood-services/rent-stabilization-program",
    citation: "Pomona Municipal Code §§30-571",
    figure: "5%",
    window: "2026-01-01 through 2026-12-31",
    detail: "The city page says the ordinance sunsets on 2026-12-31 unless it is reauthorized.",
  }),
  published({
    id: "santa-monica",
    name: "Santa Monica",
    places: ["santa monica"],
    zips: ["90401", "90402", "90403", "90404", "90405"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "Santa Monica Rent Control",
    housingUrl: "https://www.santamonica.gov/maximum-lawful-rent",
    citation: "Santa Monica City Charter §§1800",
    figure: "2.6%",
    window: "2026-09-01 through 2027-08-31",
  }),
  published({
    id: "west-hollywood",
    name: "West Hollywood",
    places: ["west hollywood"],
    zips: ["90069"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "West Hollywood Rent Stabilization",
    housingUrl: "https://www.weho.org/city-government/rent-stabilization",
    citation: "West Hollywood Municipal Code tit. 17",
    figure: "2.25%",
    window: "2025-09-01 through 2026-08-31",
  }),
  unsure({
    id: "larkspur",
    name: "Larkspur",
    places: ["larkspur"],
    zips: ["94939"],
    area: "san_francisco_bay",
    county: "Marin",
    housingName: "City of Larkspur",
    housingUrl: "https://www.ci.larkspur.ca.us/878/Eviction-Protections-and-Rent-Regulation",
    citation: "City of Larkspur eviction protections and rent regulation (code section not confirmed in this review)",
    detail: "The Attorney General chart says the figure is recalculated monthly. This library does not state a percentage.",
  }),
  unsure({
    id: "salinas",
    name: "Salinas",
    places: ["salinas"],
    zips: ["93901", "93905", "93906"],
    area: "other_ca",
    county: "Monterey",
    housingName: "City of Salinas",
    housingUrl: "https://www.salinas.gov/Residents/Community/Housing-Community-Development/Rental-Registration-Rent-Stabilization",
    citation: "City of Salinas rent stabilization program (code section not confirmed in this review)",
    detail:
      "The Attorney General chart does not publish a current percentage. The city page describes a repeal vote that has not been treated here as ending the ordinance. This library does not state a percentage.",
  }),
  published({
    id: "santa-ana",
    name: "Santa Ana",
    places: ["santa ana"],
    zips: ["92701", "92703", "92704", "92706", "92707"],
    area: "los_angeles_orange",
    county: "Orange",
    housingName: "City of Santa Ana",
    housingUrl: "https://www.santa-ana.org/renter-protections/",
    citation: "Santa Ana Municipal Code §§8-3140",
    figure: "2.87%",
    window: "2026-09-01 through 2027-08-31",
  }),
  unsure({
    id: "palm-springs",
    name: "Palm Springs",
    places: ["palm springs"],
    zips: ["92262", "92264"],
    area: "riverside_san_bernardino",
    county: "Riverside",
    housingName: "City of Palm Springs",
    housingUrl: "https://www.palmspringsca.gov/government/departments/housing-community-development/rent-control",
    citation: "City of Palm Springs rent control (code section not confirmed in this review)",
    detail:
      "The Attorney General chart says to check with the city. It describes more than one formula. This library does not state a single percentage.",
  }),
  published({
    id: "sacramento",
    name: "Sacramento",
    places: ["sacramento"],
    zips: ["95811", "95814", "95816", "95817", "95818", "95819", "95820"],
    area: "other_ca",
    county: "Sacramento",
    housingName: "City of Sacramento Tenant Protection Program",
    housingUrl: "https://www.cityofsacramento.gov/community-development/code-compliance/rental-info-hub/tenant-protection-program",
    citation: "Sacramento City Code ch. 5.156",
    figure: "8.6%",
    window: "2026-07-01 through 2027-06-30",
    detail:
      "The chart figure follows the same formula as the statewide chart for this area. It is still a city ordinance. Coverage of a particular unit is not confirmed.",
  }),
  published({
    id: "san-francisco",
    name: "San Francisco",
    places: ["san francisco"],
    zips: ["94102", "94103", "94107", "94109", "94110", "94112", "94114", "94115", "94117", "94118", "94121", "94122", "94123", "94124", "94127", "94131", "94132", "94133", "94134"],
    area: "san_francisco_bay",
    county: "San Francisco",
    housingName: "San Francisco Rent Board",
    housingUrl: "https://www.sf.gov/reports/march-2023/learn-about-rent-increases-san-francisco",
    citation: "San Francisco Administrative Code ch. 37",
    figure: "1.6%",
    window: "2026-03-01 through 2027-02-28",
    detail: "San Francisco is a consolidated city-county. This pack is the local ordinance for that city and county.",
  }),
  published({
    id: "mountain-view",
    name: "Mountain View",
    places: ["mountain view"],
    zips: ["94040", "94041", "94043"],
    area: "other_ca",
    county: "Santa Clara",
    housingName: "City of Mountain View",
    housingUrl: "https://www.mountainview.gov/our-city/departments/housing/rent-stabilization/rent-and-allowed-rent-increases",
    citation: "Mountain View City Charter §§1700",
    figure: "2.5%",
    window: "2026-09-01 through 2027-08-31",
  }),
  published({
    id: "san-jose",
    name: "San Jose",
    places: ["san jose"],
    zips: ["95110", "95112", "95113", "95116", "95117", "95118", "95120", "95121", "95122", "95123", "95124", "95125", "95126", "95127", "95128", "95129", "95130", "95131", "95132", "95133", "95134", "95135", "95136"],
    area: "other_ca",
    county: "Santa Clara",
    housingName: "City of San Jose",
    housingUrl: "https://www.sanjoseca.gov/your-government/departments-offices/housing/tenants/learn-about-rent-stabilization",
    citation: "San Jose Municipal Code ch. 17.23",
    figure: "5%",
    window: "any 12-month period",
  }),
  published({
    id: "east-palo-alto",
    name: "East Palo Alto",
    places: ["east palo alto"],
    zips: ["94303"],
    area: "san_francisco_bay",
    county: "San Mateo",
    housingName: "City of East Palo Alto",
    housingUrl: "https://www.ci.east-palo-alto.ca.us/rent-stabilization/page/guide-rent-stabilization-rent-increases",
    citation: "East Palo Alto Municipal Code ch. 14.04",
    figure: "2%",
    window: "2026-07-01 through 2027-06-30",
  }),
  published({
    id: "ojai",
    name: "Ojai",
    places: ["ojai"],
    zips: ["93023"],
    area: "other_ca",
    county: "Ventura",
    housingName: "City of Ojai",
    housingUrl: "https://ojai.ca.gov/529/Rent-Stabilization-FAQ",
    citation: "Ojai Municipal Code tit. 11",
    figure: "4%",
    window: "any 12-month period",
  }),
  published({
    id: "oxnard",
    name: "Oxnard",
    places: ["oxnard"],
    zips: ["93030", "93033", "93035", "93036"],
    area: "other_ca",
    county: "Ventura",
    housingName: "City of Oxnard",
    housingUrl: "https://www.oxnard.org/city-department/housing/rso/rent-stabilization-ordinance/",
    citation: "Oxnard Municipal Code §§27-20",
    figure: "4%",
    window: "any 12-month period",
  }),
  unsure({
    id: "thousand-oaks",
    name: "Thousand Oaks",
    places: ["thousand oaks"],
    zips: ["91360", "91362"],
    area: "other_ca",
    county: "Ventura",
    housingName: "City of Thousand Oaks",
    housingUrl: "https://toaks.gov/housing",
    citation: "City of Thousand Oaks housing page (code section not confirmed in this review)",
    detail:
      "The Attorney General chart says to contact the city. The ordinance is described as applying only to a narrow class of long-term tenancies. This library does not state a percentage.",
  }),
  noneCap({
    id: "glendale",
    name: "Glendale",
    places: ["glendale"],
    zips: ["91201", "91202", "91203", "91204", "91205", "91206", "91207", "91208"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "City of Glendale",
    housingUrl: "https://www.glendaleca.gov/home/showpublisheddocument/49848/637864959401030000",
    citation: "Glendale Ordinance 5922",
    sourceName: "City of Glendale",
    effectiveDate: "2019-03-14",
    topic: "just-cause",
    detail:
      "The city flyer describes just cause, a right to a lease, and relocation. This library did not find a local annual percentage cap on that flyer. A relocation trigger described there is not stored as an allowable rent increase.",
  }),
  noneCap({
    id: "long-beach",
    name: "Long Beach",
    places: ["long beach"],
    zips: ["90802", "90803", "90804", "90805", "90806", "90807", "90808", "90810", "90813", "90814", "90815"],
    area: "los_angeles_orange",
    county: "Los Angeles",
    housingName: "City of Long Beach",
    housingUrl: "https://www.longbeach.gov/lbcd/hn/tenant-landlord-resources/",
    citation: "Long Beach Municipal Code ch. 8.99",
    topic: "just-cause",
    adoptedNote:
      "A restatement of the chapter includes a sunset of 2030-01-01. The original effective date is unsure.",
    detail:
      "The city describes a just-cause ordinance that is more protective than the statewide rule. This library did not find a local percentage cap.",
  }),
  unsure({
    id: "los-gatos",
    name: "Los Gatos",
    places: ["los gatos"],
    zips: ["95030", "95032"],
    area: "other_ca",
    county: "Santa Clara",
    housingName: "Town of Los Gatos",
    housingUrl: "https://losgatosca.gov/DocumentCenter/View/118/Rental-Dispute-Regulations",
    citation: "Town of Los Gatos rental dispute regulations",
    sourceName: "Town of Los Gatos",
    detail:
      "The town regulations describe a formula: the annual increase shall not exceed 70% of CPI or 5%, whichever is greater, unless the tenants agree or an arbitrator allows more. The current computed percentage for a dated window is unsure. A related FAQ is at https://www.losgatosca.gov/DocumentCenter/View/7731/Rental-Dispute-Resolution-Prgm-FAQ.",
  }),
  noneCap({
    id: "fremont",
    name: "Fremont",
    places: ["fremont"],
    zips: ["94536", "94538", "94539", "94555"],
    area: "san_francisco_bay",
    county: "Alameda",
    housingName: "City of Fremont",
    housingUrl: "https://www.codepublishing.com/CA/Fremont/html/Fremont09/Fremont0960.html",
    citation: "Fremont Municipal Code ch. 9.60",
    sourceName: "City of Fremont code",
    adoptedNote:
      "The code page prints Ordinance 13-2017 dated 2017-10-03. Whether that date is the operative effective date is unsure. The effective date is unsure.",
    topic: "tenant-protection",
    detail:
      "Chapter 9.60 is a rent-review program, not a local percentage cap and not a local just-cause ordinance. A notice threshold printed in the code is not stored here as an allowable rent increase.",
  }),
  noneCap({
    id: "alameda-county",
    name: "Unincorporated Alameda County",
    places: ["alameda county", "alameda"],
    zips: [],
    area: "san_francisco_bay",
    county: "Alameda",
    match: "unincorporated",
    housingName: "County of Alameda",
    housingUrl: "https://www.acgov.org/board/bos_calendar/documents/DocsAgendaReg_02_04_25/GENERAL%20ADMINISTRATION/Set%20Matter%20Calendar/CDA_381856.pdf",
    citation: "Alameda County Ordinance O-2025-9, County Code ch. 3.70",
    sourceName: "County of Alameda Board of Supervisors agenda packet",
    adoptedNote:
      "Ordinance O-2025-9 says it takes effect 30 days after passage. The passage date was not confirmed from the text reviewed here. The effective date is unsure.",
    topic: "just-cause",
    detail:
      "The ordinance incorporates Civil Code §1946.2 except subdivisions (g) and (k) and says it does not adopt the state rent-cap sections. This library does not state a local percentage.",
  }),
  noneCap({
    id: "marin-county",
    name: "Unincorporated Marin County",
    places: ["marin county", "marin"],
    zips: [],
    area: "san_francisco_bay",
    county: "Marin",
    match: "unincorporated",
    housingName: "County of Marin",
    housingUrl: "https://www.marincounty.gov/departments/cda/housing-and-grants/renting-marin/just-cause-eviction",
    citation: "Marin County Code ch. 5.100, Ordinance 3705",
    sourceName: "County of Marin",
    adoptedNote: "Ordinance 3705 was adopted on 2018-12-18. The operative effective date is unsure.",
    topic: "just-cause",
    detail: "The county page describes a just-cause ordinance for unincorporated Marin. This library did not find a local percentage rent cap.",
  }),
  noneCap({
    id: "sonoma-county",
    name: "Unincorporated Sonoma County",
    places: ["sonoma county", "sonoma"],
    zips: [],
    area: "other_ca",
    county: "Sonoma",
    match: "unincorporated",
    housingName: "County of Sonoma",
    housingUrl: "https://sonomacounty.gov/tenantprotections",
    citation: "Sonoma County Residential Tenancy Protections",
    sourceName: "County of Sonoma",
    adoptedNote:
      "The Board of Supervisors adopted residential tenancy protections on 2024-09-17. The operative effective date is unsure.",
    topic: "just-cause",
    detail:
      "The county page describes day-one just cause and relocation augmentation for unincorporated Sonoma. This library did not find a local percentage rent cap. A code chapter number was not confirmed in this review.",
  }),
  noneCap({
    id: "santa-cruz-county",
    name: "Unincorporated Santa Cruz County",
    places: ["santa cruz county", "santa cruz"],
    zips: [],
    area: "other_ca",
    county: "Santa Cruz",
    match: "unincorporated",
    housingName: "County of Santa Cruz",
    housingUrl: "https://www.codepublishing.com/CA/SantaCruzCounty/html/SantaCruzCounty08/SantaCruzCounty0843.html",
    citation: "Santa Cruz County Code ch. 8.43",
    sourceName: "County of Santa Cruz code",
    topic: "tenant-protection",
    detail:
      "Chapter 8.43 addresses tenant protections against retaliation and harassment. It is not a just-cause eviction ordinance and not a rent cap. This library does not state a local percentage.",
  }),
];

type Base = {
  id: string;
  name: string;
  places: string[];
  zips: string[];
  area: AreaKey;
  county: string;
  housingName: string;
  housingUrl: string;
  citation: string;
  detail?: string;
  match?: "city" | "unincorporated";
  sourceName?: string;
  effectiveDate?: string | null;
  adoptedNote?: string;
  topic?: OrdinanceRecord["topic"];
};

function published(input: Base & { figure: string; window: string }): OrdinanceRecord {
  return {
    ...base(input),
    capStatus: "published",
    figure: input.figure,
    window: input.window,
    topic: "rent-cap",
    sourceName: input.sourceName ?? input.housingName,
  };
}

function unsure(input: Base & { detail: string }): OrdinanceRecord {
  return {
    ...base(input),
    capStatus: "unsure",
    figure: null,
    window: null,
    topic: input.topic ?? "rent-cap",
    detail: input.detail,
    sourceName: input.sourceName ?? input.housingName,
  };
}

function noneCap(input: Base & { detail: string; topic: OrdinanceRecord["topic"] }): OrdinanceRecord {
  return {
    ...base(input),
    capStatus: "none",
    figure: null,
    window: null,
    topic: input.topic,
    detail: input.detail,
    sourceName: input.sourceName ?? input.housingName,
  };
}

function base(input: Base): Omit<OrdinanceRecord, "capStatus" | "figure" | "window" | "topic" | "sourceName"> & { detail: string } {
  return {
    id: input.id,
    name: input.name,
    places: input.places,
    zips: input.zips,
    area: input.area,
    county: input.county,
    match: input.match ?? "city",
    housingName: input.housingName,
    housingUrl: input.housingUrl,
    citation: input.citation,
    sourceUrl: input.housingUrl,
    effectiveDate: input.effectiveDate ?? null,
    adoptedNote: input.adoptedNote ?? "",
    detail: input.detail ?? "",
  };
}
