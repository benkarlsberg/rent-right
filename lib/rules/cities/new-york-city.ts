import { rule } from "@/lib/rules/define";
import type { CityPack } from "@/lib/rules/cities/types";
import type { StateRentAnswer } from "@/lib/rules/states";

const CHECKED = "Nov 13, 2026";
const CHECKED_ES = "13 de noviembre de 2026";

/** RGB apartment orders opened on rentguidelinesboard.cityofnewyork.us. A lease outside these windows is not compared. */
const RGB_ORDERS = [
  { id: "57", start: "2025-10-01", end: "2026-09-30", oneYear: 3, twoYear: 4.5 },
  { id: "58", start: "2026-10-01", end: "2027-09-30", oneYear: 0, twoYear: 0 },
] as const;

export type Stabilization = "yes" | "no" | "unsure";

export const pack: CityPack = {
  id: "new-york-city",
  jurisdiction: "city_nyc",
  name: "New York",
  places: ["new york", "new york city", "nyc", "manhattan", "brooklyn", "queens", "bronx", "the bronx", "staten island"],
  zips: [],
  area: "new_york_city",
  housingName: "NYC Housing Preservation and Development",
  housingUrl: "https://www.nyc.gov/site/hpd/services-and-information/heat-and-hot-water-information.page",
  match: "city",
  county: "New York City",
  capStatus: "legacy",
  rules: [
    rule({
      id: "NYC-RGB-ORDER",
      jurisdiction: "CITY_NYC",
      topic: "rent-increase",
      topics: ["rent stabilization", "rent guidelines board", "rgb", "estabilizacion", "estabilización", "aumento de renta"],
      titleEn: "New York City rent-stabilization guidelines",
      titleEs: "Pautas de renta estabilizada en la ciudad de Nueva York",
      summaryEn: `Rent Guidelines Board Order 57 sets 3% for a one-year lease and 4.5% for a two-year lease commencing October 1, 2025 through September 30, 2026. Order 58 sets 0% for both a one-year and a two-year lease commencing October 1, 2026 through September 30, 2027. Both orders say those adjustments are together with further adjustments authorized by law. The orders apply only to rent-stabilized apartments. Rent Right does not assume an apartment is stabilized. Checked ${CHECKED}.`,
      summaryEs: `La Orden 57 de la Junta de Pautas de Renta fija 3% para un año y 4.5% para dos años en contratos que empiezan del 1 de octubre de 2025 al 30 de septiembre de 2026. La Orden 58 fija 0% para uno o dos años del 1 de octubre de 2026 al 30 de septiembre de 2027. Solo aplican si el apartamento está estabilizado. Rent Right no lo supone. Revisado el ${CHECKED_ES}.`,
      citation: "NYC Rent Guidelines Board Apartment Orders 57 and 58",
      sourceName: "New York City Rent Guidelines Board",
      sourceUrl: "https://rentguidelinesboard.cityofnewyork.us/2026-27-apartment-loft-order-58/",
      findingLabel: "informational",
      confidence: "high",
      reasonEn: "Used only for a New York City home, and a guideline comparison is made only when the tenant says the apartment is rent stabilized.",
      reasonEs: "Se usa solo para una vivienda en la ciudad de Nueva York, y la comparación se hace solo si el inquilino dice que el apartamento está estabilizado.",
      patterns: [],
    }),
    rule({
      id: "NYC-GOL-7-107",
      jurisdiction: "CITY_NYC",
      topic: "deposit",
      topics: ["security deposit", "deposito", "depósito", "stabilized deposit"],
      titleEn: "Deposit for a rent-stabilized New York City apartment",
      titleEs: "Depósito de un apartamento estabilizado en Nueva York",
      summaryEn: `General Obligations Law § 7-107 applies only to a unit under the New York City rent stabilization law or the Emergency Tenant Protection Act. It limits a deposit or advance to one month's rent and requires an itemized statement and the remaining deposit within 14 days after the tenant vacates. If that statement and deposit are not provided, the landlord forfeits any right to retain any portion. Whether an apartment is stabilized was not assumed. Checked ${CHECKED}.`,
      summaryEs: `La sección 7-107 aplica solo a una unidad de renta estabilizada o de la Ley de Protección de Emergencia. Limita el depósito a un mes y exige el desglose y el saldo dentro de 14 días después de desocupar. No se supuso que el apartamento esté estabilizado. Revisado el ${CHECKED_ES}.`,
      citation: "N.Y. Gen. Oblig. Law § 7-107",
      sourceName: "New York State Senate Open Legislation",
      sourceUrl: "https://legislation.nysenate.gov/pdf/laws/GOB7-107?full=true",
      findingLabel: "informational",
      confidence: "high",
      reasonEn: "Stated for a New York City home beside the statewide deposit rule. Stabilization was not decided.",
      reasonEs: "Se indica para una vivienda de la ciudad junto a la regla estatal. No se decidió la estabilización.",
      patterns: [],
    }),
    rule({
      id: "NYC-HMC-27-2115",
      jurisdiction: "CITY_NYC",
      topic: "repair",
      topics: ["repair", "habitability", "housing maintenance", "reparacion", "reparación", "violation"],
      titleEn: "New York City housing-code correction times",
      titleEs: "Plazos de corrección del código de vivienda de Nueva York",
      summaryEn: `Housing Maintenance Code § 27-2115(c) says a notice of violation sets the correction date: 90 days from mailing for a non-hazardous violation, 30 days from mailing for a hazardous violation, and 24 hours for an immediately hazardous violation. HPD's penalties page gives different times for some Class C conditions, including 21 days, 14 days, and no time for heat and hot water. No class was entered, so no city date was stored. These periods are not permission to withhold rent. Checked ${CHECKED}.`,
      summaryEs: `La sección 27-2115(c) fija 90 días, 30 días o 24 horas según la clase del aviso. HPD da otros plazos para algunas condiciones de clase C. No se guardó una fecha de la ciudad. No es permiso para retener la renta. Revisado el ${CHECKED_ES}.`,
      citation: "N.Y.C. Admin. Code § 27-2115",
      sourceName: "New York City Administrative Code",
      sourceUrl: "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-61267",
      findingLabel: "informational",
      confidence: "high",
      reasonEn: "The class of violation was not entered, so the city clocks are explained and no date is stored.",
      reasonEs: "No se indicó la clase de la violación, así que se explican los plazos y no se guarda una fecha.",
      patterns: [],
    }),
    rule({
      id: "NYC-HMC-27-2029",
      jurisdiction: "CITY_NYC",
      topic: "repair",
      topics: ["heat", "hot water", "calor", "agua caliente", "no heat"],
      titleEn: "New York City heat season",
      titleEs: "Temporada de calefacción en la ciudad de Nueva York",
      summaryEn: `Housing Maintenance Code § 27-2029 requires centrally supplied heat from October 1 through May 31: at least 68 degrees Fahrenheit from 6 a.m. to 10 p.m. when the outside temperature falls below 55 degrees, and at least 62 degrees from 10 p.m. to 6 a.m. HPD states that hot water must be provided every day at a minimum of 120 degrees Fahrenheit. The outside temperature and the time of day were not entered, so no violation was decided. Checked ${CHECKED}.`,
      summaryEs: `La sección 27-2029 exige calefacción del 1 de octubre al 31 de mayo: al menos 68 grados de 6 a.m. a 10 p.m. si afuera hay menos de 55, y al menos 62 grados de 10 p.m. a 6 a.m. HPD dice que el agua caliente debe estar a un mínimo de 120 grados todos los días. No se decidió una violación. Revisado el ${CHECKED_ES}.`,
      citation: "N.Y.C. Admin. Code § 27-2029",
      sourceName: "NYC Housing Preservation and Development",
      sourceUrl: "https://www.nyc.gov/site/hpd/services-and-information/heat-and-hot-water-information.page",
      findingLabel: "informational",
      confidence: "high",
      reasonEn: "Heat-season temperatures are stated. The outdoor temperature was not entered, so no violation was found.",
      reasonEs: "Se indican las temperaturas de la temporada. No se anotó la temperatura exterior, así que no hay una violación.",
      patterns: [],
    }),
    rule({
      id: "NYC-RPL-212",
      jurisdiction: "CITY_NYC",
      topic: "rent-increase",
      topics: ["good cause", "buena causa", "article 6-a", "local rent standard"],
      titleEn: "Good cause in New York City",
      titleEs: "Buena causa en la ciudad de Nueva York",
      summaryEn: `Real Property Law § 212 says article 6-A applies in the city of New York. The section is repealed June 15, 2034. Section 214 lists exemptions, including a unit already regulated for rent or eviction, and those exemptions were not decided. Section 216 creates a rebuttable presumption that a rent increase is unreasonable if it exceeds the local rent standard in a calendar year. Section 211 defines that standard as the inflation index or 10 percent, whichever is lower. The division's published index was not loaded, so no good-cause comparison was made. Checked ${CHECKED}.`,
      summaryEs: `La sección 212 dice que el artículo 6-A aplica en la ciudad de Nueva York, hasta el 15 de junio de 2034. La sección 214 enumera exenciones que no se decidieron. El índice publicado no se cargó, así que no se comparó la buena causa. Revisado el ${CHECKED_ES}.`,
      citation: "N.Y. Real Prop. Law §§ 211, 212, 214, 216",
      sourceName: "New York State Senate Open Legislation",
      sourceUrl: "https://legislation.nysenate.gov/pdf/laws/RPP212?full=true",
      findingLabel: "informational",
      confidence: "high",
      reasonEn: "Good cause applies in New York City. The published local rent standard was not loaded, so no increase was graded under it.",
      reasonEs: "La buena causa aplica en la ciudad. No se cargó el índice publicado, así que no se calificó un aumento.",
      patterns: [],
    }),
  ],
};

function percent(lowestCents: number, proposedCents: number): number {
  return ((proposedCents - lowestCents) * 100) / lowestCents;
}

function orderFor(effectiveDate: string) {
  return RGB_ORDERS.find((order) => effectiveDate >= order.start && effectiveDate <= order.end) ?? null;
}

export function nycRentAnswer(input: {
  lowestCents: number;
  proposedCents: number;
  effectiveDate: string;
  /** Confirmed only when the tenant says the apartment is rent stabilized. */
  stabilized?: Stabilization;
  leaseYears?: 1 | 2 | null;
  statewide: StateRentAnswer;
}): StateRentAnswer {
  const stabilized = input.stabilized ?? "unsure";
  const years = input.leaseYears ?? null;
  const increase = percent(input.lowestCents, input.proposedCents);
  const order = orderFor(input.effectiveDate);
  const shown = increase.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  const goodCause = `Real Property Law § 212 applies article 6-A, the good cause eviction law, in the city of New York until it is repealed on June 15, 2034. Section 214 exempts a unit already regulated for rent or eviction, and the other exemptions were not decided. Section 216 uses a local rent standard, defined in § 211 as the inflation index or 10 percent, whichever is lower. The division's published index was not loaded, so no good-cause comparison was made.`;
  const goodCauseEs = `La sección 212 aplica el artículo 6-A en la ciudad de Nueva York hasta el 15 de junio de 2034. La sección 214 excluye una unidad que ya tiene regulación de renta o desalojo. El índice publicado no se cargó, así que no se comparó la buena causa.`;
  if (!order) {
    return {
      ...input.statewide,
      abovePublishedMax: false,
      detailEn: `${input.statewide.detailEn} This home is in New York City. Rent stabilization was not used because the lease date ${input.effectiveDate} is outside Orders 57 and 58, the only orders loaded. ${goodCause} Checked ${CHECKED}.`,
      detailEs: `${input.statewide.detailEs} Esta vivienda está en la ciudad de Nueva York. No se usó la estabilización porque ${input.effectiveDate} está fuera de las Órdenes 57 y 58. ${goodCauseEs} Revisado el ${CHECKED_ES}.`,
    };
  }
  const both = `Order ${order.id} is ${order.oneYear}% for a one-year lease and ${order.twoYear}% for a two-year lease commencing ${order.start} through ${order.end}.`;
  const bothEs = `La Orden ${order.id} es ${order.oneYear}% por un año y ${order.twoYear}% por dos años, para un contrato que empieza del ${order.start} al ${order.end}.`;
  if (stabilized !== "yes") {
    const why = stabilized === "no"
      ? "You said this apartment is not rent stabilized, so the Rent Guidelines Board order was not applied."
      : "Rent stabilization was not confirmed, so the Rent Guidelines Board order was not applied and the increase was not graded under it.";
    const whyEs = stabilized === "no"
      ? "Usted dijo que este apartamento no está estabilizado, así que no se aplicó la orden."
      : "No se confirmó la estabilización, así que no se aplicó la orden ni se calificó el aumento.";
    return {
      ...input.statewide,
      abovePublishedMax: false,
      detailEn: `${input.statewide.detailEn} This home is in New York City. The increase from the amounts entered is about ${shown}%. ${both} ${why} ${goodCause} Checked ${CHECKED}.`,
      detailEs: `${input.statewide.detailEs} Esta vivienda está en la ciudad de Nueva York. El aumento es de alrededor del ${shown}%. ${bothEs} ${whyEs} ${goodCauseEs} Revisado el ${CHECKED_ES}.`,
    };
  }
  const cap = years === 1 ? order.oneYear : years === 2 ? order.twoYear : order.oneYear === order.twoYear ? order.oneYear : null;
  if (cap == null) {
    return {
      ...input.statewide,
      abovePublishedMax: false,
      detailEn: `${input.statewide.detailEn} You said this New York City apartment is rent stabilized. ${both} The lease length was not entered, and the two guidelines differ, so no comparison was made. ${goodCause} Checked ${CHECKED}.`,
      detailEs: `${input.statewide.detailEs} Usted dijo que el apartamento está estabilizado. ${bothEs} No se indicó si el contrato es de uno o dos años, y las dos pautas son distintas, así que no se comparó. ${goodCauseEs} Revisado el ${CHECKED_ES}.`,
    };
  }
  const over = increase > cap + 0.0001;
  const length = years === 1 ? "one-year" : years === 2 ? "two-year" : "one-year or two-year";
  return {
    ...input.statewide,
    abovePublishedMax: over,
    ruleId: "NYC-RGB-ORDER",
    detailEn: `${input.statewide.detailEn} You said this New York City apartment is rent stabilized. ${both} The increase of about ${shown}% is ${over ? "above" : "not above"} the published ${cap}% guideline for a ${length} lease commencing in that window. Other lawful adjustments in the order were not decided. This does not decide that the increase violates the order. ${goodCause} Checked ${CHECKED}.`,
    detailEs: `${input.statewide.detailEs} Usted dijo que el apartamento está estabilizado. ${bothEs} El aumento de alrededor del ${shown}% ${over ? "supera" : "no supera"} la pauta publicada de ${cap}%. Otros ajustes legales de la orden no se decidieron. ${goodCauseEs} Revisado el ${CHECKED_ES}.`,
  };
}

export const NYC_REPAIR_NOTE_EN =
  "In New York City, a housing-code notice sets its own correction date. Section 27-2115 generally uses 90 days from mailing for a non-hazardous violation, 30 days for a hazardous violation, and 24 hours for an immediately hazardous violation. Some Class C conditions use a different time on the housing agency's chart. No class was entered. This letter is not permission to withhold rent.";

export const NYC_REPAIR_NOTE_ES =
  "En la ciudad de Nueva York, el aviso del código de vivienda fija su propia fecha. La sección 27-2115 en general usa 90 días, 30 días o 24 horas según la clase. Algunas condiciones de clase C usan otro plazo. No se indicó la clase. Esta carta no es permiso para retener la renta.";
