import type { AreaKey } from "@/lib/rules/engine";

/**
 * Cities on the Attorney General's local rent-cap chart whose ordinances are
 * not loaded as rules yet. Loaded programs live in their own pack files.
 * Source of the list: https://oag.ca.gov/rentcaps
 * Each housingUrl is the city page the Attorney General links for that ordinance.
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

export const LOCAL_ORDINANCES: LocalOrdinance[] = [
  { id: "alameda", name: "Alameda", places: ["alameda"], zips: ["94501", "94502"], area: "san_francisco_bay", housingName: "City of Alameda Rent Program", housingUrl: "https://www.alamedarentprogram.org/FAQs#Rent%20Increase%20Overview" },
  { id: "berkeley", name: "Berkeley", places: ["berkeley"], zips: ["94702", "94703", "94704", "94705", "94707", "94708", "94709", "94710"], area: "san_francisco_bay", housingName: "Berkeley Rent Board", housingUrl: "https://rentboard.berkeleyca.gov/rights-responsibilities/rent-levels/annual-general-adjustment" },
  { id: "hayward", name: "Hayward", places: ["hayward"], zips: ["94541", "94542", "94544", "94545"], area: "san_francisco_bay", housingName: "City of Hayward Housing", housingUrl: "https://www.hayward-ca.gov/residents/housing/landlord-rental-resources" },
  { id: "oakland", name: "Oakland", places: ["oakland"], zips: ["94601", "94602", "94603", "94605", "94606", "94607", "94608", "94609", "94610", "94611", "94612", "94618", "94619", "94621"], area: "san_francisco_bay", housingName: "City of Oakland", housingUrl: "https://www.oaklandca.gov/resources/learn-more-about-allowable-rent-increases" },
  { id: "san-leandro", name: "San Leandro", places: ["san leandro"], zips: ["94577", "94578", "94579"], area: "san_francisco_bay", housingName: "City of San Leandro Rent Program", housingUrl: "https://www.sanleandro.org/1483/Rent-Program" },
  { id: "antioch", name: "Antioch", places: ["antioch"], zips: ["94509", "94531"], area: "san_francisco_bay", housingName: "City of Antioch Rent Program", housingUrl: "https://www.antiochca.gov/1056/Rent-Program" },
  { id: "concord", name: "Concord", places: ["concord"], zips: ["94518", "94519", "94520", "94521"], area: "san_francisco_bay", housingName: "City of Concord", housingUrl: "https://www.cityofconcord.org/1172/Rent-Stabilization-and-Just-Cause-for-Ev" },
  { id: "richmond", name: "Richmond", places: ["richmond"], zips: ["94801", "94804", "94805"], area: "san_francisco_bay", housingName: "City of Richmond Rent Program", housingUrl: "https://www.ci.richmond.ca.us/3376/Rent-Increase" },
  { id: "baldwin-park", name: "Baldwin Park", places: ["baldwin park"], zips: ["91706"], area: "los_angeles_orange", housingName: "City of Baldwin Park", housingUrl: "https://www.baldwinpark.com/399/Rent-Stabilization-Ordinance" },
  { id: "bell-gardens", name: "Bell Gardens", places: ["bell gardens"], zips: [], area: "los_angeles_orange", housingName: "City of Bell Gardens", housingUrl: "https://www.bellgardens.org/government/city-departments/community-development/faqs" },
  { id: "beverly-hills", name: "Beverly Hills", places: ["beverly hills"], zips: ["90210", "90211", "90212"], area: "los_angeles_orange", housingName: "Beverly Hills Rent Stabilization", housingUrl: "https://www.beverlyhills.org/1090/Rent-Stabilization-Division" },
  { id: "commerce", name: "Commerce", places: ["commerce"], zips: ["90040"], area: "los_angeles_orange", housingName: "City of Commerce", housingUrl: "https://www.commerceca.gov/city-hall/economic-development-and-planning/housing" },
  { id: "cudahy", name: "Cudahy", places: ["cudahy"], zips: [], area: "los_angeles_orange", housingName: "City of Cudahy", housingUrl: "https://www.cityofcudahy.com/432/Rent-Stabilization-and-Tenant-Protection" },
  { id: "culver-city", name: "Culver City", places: ["culver city"], zips: ["90230", "90232"], area: "los_angeles_orange", housingName: "City of Culver City", housingUrl: "https://www.culvercity.org/Services/Housing-Homeless-Human-Services/Rent-Control-Tenant-Protection-Measures" },
  { id: "huntington-park", name: "Huntington Park", places: ["huntington park"], zips: ["90255"], area: "los_angeles_orange", housingName: "City of Huntington Park", housingUrl: "https://hpca.gov/849/Learn-about-Rent-Stabilization" },
  { id: "inglewood", name: "Inglewood", places: ["inglewood"], zips: ["90301", "90302", "90303", "90305"], area: "los_angeles_orange", housingName: "City of Inglewood", housingUrl: "https://www.cityofinglewood.org/1594/Allowable-Rent-Increases" },
  { id: "maywood", name: "Maywood", places: ["maywood"], zips: ["90270"], area: "los_angeles_orange", housingName: "City of Maywood Housing Division", housingUrl: "https://www.cityofmaywood.com/239/Housing-Division" },
  { id: "pasadena", name: "Pasadena", places: ["pasadena"], zips: ["91101", "91103", "91104", "91105", "91106", "91107"], area: "los_angeles_orange", housingName: "Pasadena Rent Stabilization", housingUrl: "https://www.cityofpasadena.net/rent-stabilization/info-sheets/rent-levels-and-rent-increases/" },
  { id: "pomona", name: "Pomona", places: ["pomona"], zips: ["91766", "91767", "91768"], area: "los_angeles_orange", housingName: "City of Pomona Rent Stabilization", housingUrl: "https://www.pomonaca.gov/government/departments/neighborhood-services/rent-stabilization-program" },
  { id: "santa-monica", name: "Santa Monica", places: ["santa monica"], zips: ["90401", "90402", "90403", "90404", "90405"], area: "los_angeles_orange", housingName: "Santa Monica Rent Control", housingUrl: "https://www.santamonica.gov/maximum-lawful-rent" },
  { id: "west-hollywood", name: "West Hollywood", places: ["west hollywood"], zips: ["90069"], area: "los_angeles_orange", housingName: "West Hollywood Rent Stabilization", housingUrl: "https://www.weho.org/city-government/rent-stabilization" },
  { id: "larkspur", name: "Larkspur", places: ["larkspur"], zips: ["94939"], area: "san_francisco_bay", housingName: "City of Larkspur", housingUrl: "https://www.ci.larkspur.ca.us/878/Eviction-Protections-and-Rent-Regulation" },
  { id: "salinas", name: "Salinas", places: ["salinas"], zips: ["93901", "93905", "93906"], area: "other_ca", housingName: "City of Salinas", housingUrl: "https://www.salinas.gov/Residents/Community/Housing-Community-Development/Rental-Registration-Rent-Stabilization" },
  { id: "santa-ana", name: "Santa Ana", places: ["santa ana"], zips: ["92701", "92703", "92704", "92706", "92707"], area: "los_angeles_orange", housingName: "City of Santa Ana", housingUrl: "https://www.santa-ana.org/renter-protections/" },
  { id: "palm-springs", name: "Palm Springs", places: ["palm springs"], zips: ["92262", "92264"], area: "riverside_san_bernardino", housingName: "City of Palm Springs", housingUrl: "https://www.palmspringsca.gov/government/departments/housing-community-development/rent-control" },
  { id: "sacramento", name: "Sacramento", places: ["sacramento"], zips: ["95811", "95814", "95816", "95817", "95818", "95819", "95820"], area: "other_ca", housingName: "City of Sacramento Tenant Protection Program", housingUrl: "https://www.cityofsacramento.gov/community-development/code-compliance/rental-info-hub/tenant-protection-program" },
  { id: "san-francisco", name: "San Francisco", places: ["san francisco"], zips: ["94102", "94103", "94107", "94109", "94110", "94112", "94114", "94115", "94117", "94118", "94121", "94122", "94123", "94124", "94127", "94131", "94132", "94133", "94134"], area: "san_francisco_bay", housingName: "San Francisco Rent Board", housingUrl: "https://www.sf.gov/reports/march-2023/learn-about-rent-increases-san-francisco" },
  { id: "mountain-view", name: "Mountain View", places: ["mountain view"], zips: ["94040", "94041", "94043"], area: "other_ca", housingName: "City of Mountain View", housingUrl: "https://www.mountainview.gov/our-city/departments/housing/rent-stabilization/rent-and-allowed-rent-increases" },
  { id: "san-jose", name: "San Jose", places: ["san jose"], zips: ["95110", "95112", "95113", "95116", "95117", "95118", "95120", "95121", "95122", "95123", "95124", "95125", "95126", "95127", "95128", "95129", "95130", "95131", "95132", "95133", "95134", "95135", "95136"], area: "other_ca", housingName: "City of San Jose", housingUrl: "https://www.sanjoseca.gov/your-government/departments-offices/housing/tenants/learn-about-rent-stabilization" },
  { id: "east-palo-alto", name: "East Palo Alto", places: ["east palo alto"], zips: ["94303"], area: "san_francisco_bay", housingName: "City of East Palo Alto", housingUrl: "https://www.ci.east-palo-alto.ca.us/rent-stabilization/page/guide-rent-stabilization-rent-increases" },
  { id: "ojai", name: "Ojai", places: ["ojai"], zips: ["93023"], area: "other_ca", housingName: "City of Ojai", housingUrl: "https://ojai.ca.gov/529/Rent-Stabilization-FAQ" },
  { id: "oxnard", name: "Oxnard", places: ["oxnard"], zips: ["93030", "93033", "93035", "93036"], area: "other_ca", housingName: "City of Oxnard", housingUrl: "https://www.oxnard.org/city-department/housing/rso/rent-stabilization-ordinance/" },
  { id: "thousand-oaks", name: "Thousand Oaks", places: ["thousand oaks"], zips: ["91360", "91362"], area: "other_ca", housingName: "City of Thousand Oaks", housingUrl: "https://toaks.gov/housing" },
];
