import { LIBRARY_VERSION } from "@/lib/disclaimer";
import { packByJurisdiction } from "@/lib/rules/cities";
import { evaluateLocalCap, type LocalFacts } from "@/lib/rules/cities/verify";
import { addDays, addMonths, daysBetween, isWeekend } from "@/lib/rules/dates";
import { HOLIDAY_CALENDAR_NOTE, HOLIDAY_SPAN, JUDICIAL_HOLIDAYS } from "@/lib/rules/holidays";
import { getRule } from "@/lib/rules/library";

export const CLINIC_REVIEW = "pending_clinic_review" as const;

export type Jurisdiction =
  | "city_la"
  | "la_county_unincorporated"
  | "city_sd"
  | "ca"
  | "other_ca"
  | "unsure"
  | (string & {});

export type AreaKey =
  | "los_angeles_orange"
  | "riverside_san_bernardino"
  | "san_diego"
  | "san_francisco_bay"
  | "other_ca";

export type RepairSeverity =
  | "no_heat"
  | "no_water"
  | "no_electricity"
  | "gas_leak"
  | "sewage"
  | "flood"
  | "no_toilet"
  | "door"
  | "window"
  | "co_alarm"
  | "fire"
  | "wiring"
  | "leak"
  | "mold"
  | "pests"
  | "other";

export type RsoStatus = "covered" | "not_covered" | "unsure";
export type RstpoTier = "fully_covered" | "small_landlord" | "luxury" | "not_covered" | "unsure";

export type DatedResult = {
  dueDate: string | null;
  ruleId: string;
  citation: string;
  explanation: string;
  explanationEs: string;
  computation: string;
  confirmWithOfficialSource: true;
  unsure: boolean;
  rulesVersion: string;
  clinicReview: typeof CLINIC_REVIEW;
};

const CONFIRM = true as const;

function base(partial: Omit<DatedResult, "confirmWithOfficialSource" | "rulesVersion" | "clinicReview">): DatedResult {
  return {
    ...partial,
    confirmWithOfficialSource: CONFIRM,
    rulesVersion: LIBRARY_VERSION,
    clinicReview: CLINIC_REVIEW,
  };
}

/** Parts per million. 8.7% = 87000. */
export function applyPpm(cents: number, ppm: number): number {
  if (!Number.isInteger(cents) || cents < 0) throw new Error("cents must be a non-negative integer");
  if (!Number.isInteger(ppm)) throw new Error("ppm must be an integer");
  return Math.round((cents * (1_000_000 + ppm)) / 1_000_000);
}

export function increasePpm(lowestCents: number, proposedCents: number): number {
  if (lowestCents <= 0) throw new Error("lowest rent must be positive");
  return Math.round(((proposedCents - lowestCents) * 1_000_000) / lowestCents);
}

type CapPeriod = { start: string; end: string; ppm: number };

/** Published AB 1482 chart percentages, stored as parts per million. */
export const AB1482_PERIODS: {
  start: string;
  end: string;
  areas: Record<AreaKey, number>;
}[] = [
  {
    start: "2025-08-01",
    end: "2026-07-31",
    areas: {
      los_angeles_orange: 80_000,
      riverside_san_bernardino: 75_000,
      san_diego: 88_000,
      san_francisco_bay: 63_000,
      other_ca: 77_000,
    },
  },
  {
    start: "2026-08-01",
    end: "2027-07-31",
    areas: {
      los_angeles_orange: 87_000,
      riverside_san_bernardino: 81_000,
      san_diego: 82_000,
      san_francisco_bay: 88_000,
      other_ca: 86_000,
    },
  },
];

export const LA_RSO_PERIODS: CapPeriod[] = [
  { start: "2025-07-01", end: "2026-06-30", ppm: 30_000 },
  { start: "2026-07-01", end: "2027-06-30", ppm: 30_000 },
];

export const LA_RSO_UTILITY_ADDON_ENDS = "2026-02-02";

export const RSTPO_PERIODS: {
  start: string;
  end: string;
  fully_covered: number;
  small_landlord: number;
  luxury: number;
}[] = [
  {
    start: "2026-07-01",
    end: "2027-06-30",
    fully_covered: 19_190,
    small_landlord: 29_190,
    luxury: 39_190,
  },
];

function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

export function depositReturnDeadline(moveOutDate: string): DatedResult {
  const due = addDays(moveOutDate, 21);
  return base({
    dueDate: due,
    ruleId: "CA-CC-1950.5",
    citation: "Cal. Civ. Code §1950.5",
    unsure: false,
    computation: `${moveOutDate} + 21 calendar days = ${due}`,
    explanation: `The itemized statement and any remaining deposit are due 21 calendar days after the move-out date you entered (${moveOutDate}), which is ${due}. This counts calendar days, including weekends. Confirm the move-out date the statute uses and read §1950.5.`,
    explanationEs: `El desglose y cualquier depósito restante vencen 21 días calendario después de la fecha de mudanza que anotó (${moveOutDate}), es decir el ${due}. Se cuentan días calendario, incluidos los fines de semana. Confirme la fecha de mudanza que usa la ley y lea la §1950.5.`,
  });
}

const URGENT = new Set<RepairSeverity>([
  "no_heat",
  "no_water",
  "no_electricity",
  "gas_leak",
  "sewage",
  "flood",
  "no_toilet",
  "door",
  "window",
  "co_alarm",
  "fire",
  "wiring",
]);

export function repairReminder(requestDate: string, severity: RepairSeverity): DatedResult {
  const rule = getRule("CA-CC-1942");
  let days = 30;
  let preset = "The 30-day figure is the presumption in Civil Code §1942.";
  let presetEs = "La cifra de 30 días es la presunción del Código Civil §1942.";
  if (URGENT.has(severity)) {
    days = 3;
    preset =
      "Rent Right uses a 3-day reminder preset for urgent conditions such as no heat, no hot water, no water, no electricity, a gas smell, sewage backup, a broken exterior door or lock, a broken window, no working toilet, flooding, a carbon monoxide alarm, or a fire hazard or exposed wiring. That number is not in the statute. Section 1942 says a shorter time than 30 days can be reasonable when the condition is urgent.";
    presetEs =
      "Rent Right usa un recordatorio de 3 días para condiciones urgentes, como falta de calefacción, agua caliente, agua o electricidad, olor a gas, aguas negras, una puerta o cerradura exterior rota, una ventana rota, un inodoro que no funciona, una inundación, una alarma de monóxido o un riesgo de incendio o cable expuesto. Ese número no está en la ley. La sección 1942 dice que un plazo menor de 30 días puede ser razonable si la condición es urgente.";
  }
  const due = addDays(requestDate, days);
  return base({
    dueDate: due,
    ruleId: "CA-CC-1942",
    citation: rule?.citation ?? "Cal. Civ. Code §1942",
    unsure: false,
    computation: `${requestDate} + ${days} days = ${due} (${severity})`,
    explanation: `${preset} The reminder date is ${due}. It is not a decision about anyone's legal responsibility.`,
    explanationEs: `${presetEs} La fecha del recordatorio es ${due}. No es una decisión sobre la responsabilidad legal de nadie.`,
  });
}

export function entryNoticeCheck(noticeSentAtIso: string, entryAtIso: string): {
  hours: number;
  atLeast24: boolean;
  ruleId: "CA-CC-1954";
  explanation: string;
  explanationEs: string;
  confirmWithOfficialSource: true;
} {
  const hours = (new Date(entryAtIso).getTime() - new Date(noticeSentAtIso).getTime()) / 3_600_000;
  const atLeast24 = hours >= 24;
  return {
    hours: Math.round(hours * 10) / 10,
    atLeast24,
    ruleId: "CA-CC-1954",
    confirmWithOfficialSource: true,
    explanation: atLeast24
      ? `The timestamps you entered are about ${Math.round(hours)} hours apart, which is at least 24. Civil Code §1954 still limits the reasons for entry. Written notice is the statutory form except in the situations the statute lists.`
      : `The timestamps you entered are about ${Math.round(hours)} hours apart, under 24. Civil Code §1954 presumes that 24 hours' written notice is reasonable, with exceptions such as an emergency. This is a date check, not a finding that the entry was unlawful.`,
    explanationEs: atLeast24
      ? `Las horas que anotó están separadas por unas ${Math.round(hours)} horas, al menos 24. El Código Civil §1954 igual limita los motivos de entrada. El aviso escrito es la forma de la ley, salvo las situaciones que la ley enumera.`
      : `Las horas que anotó están separadas por unas ${Math.round(hours)} horas, menos de 24. El Código Civil §1954 presume que 24 horas de aviso escrito son razonables, con excepciones como una emergencia. Es una revisión de fechas, no una conclusión de que la entrada fue ilegal.`,
  };
}

export function threeDayNoticeDeadline(
  serviceDate: string,
  holidays: readonly string[] = JUDICIAL_HOLIDAYS,
): DatedResult {
  const windowEnd = addDays(serviceDate, 21);
  const outside =
    serviceDate < HOLIDAY_SPAN.start || windowEnd > HOLIDAY_SPAN.end;
  if (outside) {
    return base({
      dueDate: null,
      ruleId: "CA-CCP-1161",
      citation: "Cal. Code Civ. Proc. §1161",
      unsure: true,
      computation: "Unsure. Holiday calendar in this library does not cover that service date.",
      explanation: `Unsure. ${HOLIDAY_CALENDAR_NOTE} No due date was calculated.`,
      explanationEs: `No se puede precisar. ${HOLIDAY_CALENDAR_NOTE} No se calculó una fecha.`,
    });
  }
  const holidaySet = new Set(holidays);
  const counted: string[] = [];
  let cursor = serviceDate;
  while (counted.length < 3) {
    cursor = addDays(cursor, 1);
    if (isWeekend(cursor) || holidaySet.has(cursor)) continue;
    counted.push(cursor);
  }
  const due = counted[2];
  return base({
    dueDate: due,
    ruleId: "CA-CCP-1161",
    citation: "Cal. Code Civ. Proc. §1161",
    unsure: false,
    computation: `Service ${serviceDate}. Counted ${counted.join(", ")}. Skipped Saturdays, Sundays, and listed judicial holidays. The service date itself was not counted.`,
    explanation: `Three counted days after ${serviceDate} land on ${due}. ${HOLIDAY_CALENDAR_NOTE} This does not say what the notice requires you to do.`,
    explanationEs: `Tres días contados después del ${serviceDate} caen en ${due}. ${HOLIDAY_CALENDAR_NOTE} Esto no dice qué le exige hacer el aviso.`,
  });
}

export function noticePeriodDays(lowestCents: number, proposedCents: number): {
  requiredDays: 30 | 90;
  ppm: number;
  ruleId: "CA-CC-827";
} {
  const ppm = increasePpm(lowestCents, proposedCents);
  return {
    requiredDays: ppm > 100_000 ? 90 : 30,
    ppm,
    ruleId: "CA-CC-827",
  };
}

export function twelveMonthEarliest(lastEffective: string): string {
  return addMonths(lastEffective, 12);
}

export type CapQuote = {
  ruleId: string;
  ppm: number | null;
  maxRentCents: number | null;
  unsure: boolean;
  note: string;
  noteEs: string;
};

export function ab1482Quote(effectiveDate: string, area: AreaKey, lowestCents: number): CapQuote {
  const period = AB1482_PERIODS.find((item) => inRange(effectiveDate, item.start, item.end));
  if (!period) {
    return {
      ruleId: "CA-CC-1947.12",
      ppm: null,
      maxRentCents: null,
      unsure: true,
      note: `Unsure. The library has AB 1482 chart rows for ${AB1482_PERIODS.map((item) => `${item.start} to ${item.end}`).join("; ")}. ${effectiveDate} is outside those rows. Read oag.ca.gov/rentcaps.`,
      noteEs: `No se puede precisar. La biblioteca tiene filas de la tabla de AB 1482 para ${AB1482_PERIODS.map((item) => `${item.start} a ${item.end}`).join("; ")}. ${effectiveDate} queda fuera. Lea oag.ca.gov/rentcaps.`,
    };
  }
  const ppm = period.areas[area];
  return {
    ruleId: "CA-CC-1947.12",
    ppm,
    maxRentCents: applyPpm(lowestCents, ppm),
    unsure: false,
    note: `Chart row ${period.start} through ${period.end} for this area. The cap is the lower of 5% plus the cost-of-living change, or 10%. Exemptions are not verified.`,
    noteEs: `Fila de la tabla del ${period.start} al ${period.end} para esta área. El tope es el menor entre 5% más el cambio del costo de la vida, o 10%. Las exenciones no están verificadas.`,
  };
}

export function laRsoQuote(effectiveDate: string, lowestCents: number): CapQuote {
  const period = LA_RSO_PERIODS.find((item) => inRange(effectiveDate, item.start, item.end));
  if (!period) {
    return {
      ruleId: "LA-RSO-2026-CAP",
      ppm: null,
      maxRentCents: null,
      unsure: true,
      note: `Unsure. No RSO percentage is stored for ${effectiveDate}. Read the current LAHD bulletin.`,
      noteEs: `No se puede precisar. No hay un porcentaje de la RSO guardado para ${effectiveDate}. Lea el boletín vigente de LAHD.`,
    };
  }
  return {
    ruleId: "LA-RSO-2026-CAP",
    ppm: period.ppm,
    maxRentCents: applyPpm(lowestCents, period.ppm),
    unsure: false,
    note: `LAHD published ${period.ppm / 10_000}% for ${period.start} through ${period.end}, for covered RSO units only.`,
    noteEs: `LAHD publicó ${period.ppm / 10_000}% del ${period.start} al ${period.end}, solo para unidades cubiertas por la RSO.`,
  };
}

export function rstpoQuote(effectiveDate: string, tier: Exclude<RstpoTier, "not_covered" | "unsure">, lowestCents: number): CapQuote {
  const period = RSTPO_PERIODS.find((item) => inRange(effectiveDate, item.start, item.end));
  if (!period) {
    return {
      ruleId: "LAC-RSTPO-2026",
      ppm: null,
      maxRentCents: null,
      unsure: true,
      note: `Unsure. No RSTPO percentage is stored for ${effectiveDate}. Read the DCBA bulletin.`,
      noteEs: `No se puede precisar. No hay un porcentaje de la RSTPO guardado para ${effectiveDate}. Lea el boletín de DCBA.`,
    };
  }
  const ppm = period[tier];
  return {
    ruleId: "LAC-RSTPO-2026",
    ppm,
    maxRentCents: applyPpm(lowestCents, ppm),
    unsure: false,
    note: `DCBA published figure for ${tier.replaceAll("_", " ")} units, ${period.start} through ${period.end}. Rent Right does not verify the tier.`,
    noteEs: `Cifra publicada por DCBA para unidades ${tier.replaceAll("_", " ")}, del ${period.start} al ${period.end}. Rent Right no verifica la categoría.`,
  };
}

const EXEMPTIONS = [
  "Certificate of occupancy issued within the last 15 years (confirm the date).",
  "Single-family home or condominium owned by a person or qualifying owner who gave the statutory exemption notice.",
  "A duplex where the owner lives in the other unit.",
  "Housing already restricted by a deed, regulatory agreement, or public subsidy.",
  "Dormitories and some other statutory categories.",
];

const EXEMPTIONS_ES = [
  "Certificado de ocupación emitido en los últimos 15 años (confirme la fecha).",
  "Casa unifamiliar o condominio de un dueño que dio el aviso de exención que exige la ley.",
  "Un dúplex en el que el dueño vive en la otra unidad.",
  "Vivienda ya restringida por escritura, acuerdo regulatorio o subsidio público.",
  "Dormitorios y otras categorías de la ley.",
];

export type RentIncreaseInput = {
  jurisdiction: Jurisdiction;
  rsoStatus: RsoStatus;
  rstpoTier: RstpoTier;
  lowestRentCents: number;
  proposedRentCents: number;
  noticeDate: string;
  effectiveDate: string;
  lastIncreaseDate: string | null;
  claimsExemption: boolean;
  /** Statewide chart area when jurisdiction is ca or other_ca. */
  countyArea?: AreaKey;
  /** Set when the address is in a city whose ordinance is not loaded yet. */
  localOrdinanceName?: string | null;
  /** Optional facts used to test a verified local covered class. */
  localFacts?: LocalFacts;
};

export type RentIncreaseResult = {
  rulesVersion: string;
  clinicReview: typeof CLINIC_REVIEW;
  confirmWithOfficialSource: true;
  ppm: number;
  percentLabel: string;
  notice: {
    requiredDays: 30 | 90;
    givenDays: number;
    ok: boolean;
    ruleId: "CA-CC-827";
    computation: string;
  };
  frequency: {
    ok: boolean | "unknown";
    earliest: string | null;
    ruleId: string;
    computation: string;
  };
  ab1482: CapQuote | null;
  local: CapQuote | null;
  applicable: {
    status: "within_cap" | "over_cap" | "unsure";
    ppm: number | null;
    maxRentCents: number | null;
    ruleId: string | null;
    reason: string;
    reasonEs: string;
  };
  utilityAddonAllowed: boolean | null;
  utilityNote: string | null;
  exemptionsToConfirm: string[];
  exemptionsToConfirmEs: string[];
  exemptionUnverified: boolean;
  jurisdictionNote: string;
  jurisdictionNoteEs: string;
};

function statewide(jurisdiction: Jurisdiction): boolean {
  return jurisdiction === "ca" || jurisdiction === "other_ca";
}

function areaFor(input: RentIncreaseInput): AreaKey | null {
  const pack = packByJurisdiction(input.jurisdiction);
  if (pack) return pack.area;
  if (statewide(input.jurisdiction)) return input.countyArea ?? "other_ca";
  return null;
}

export function checkRentIncrease(input: RentIncreaseInput): RentIncreaseResult {
  const ppm = increasePpm(input.lowestRentCents, input.proposedRentCents);
  const notice = noticePeriodDays(input.lowestRentCents, input.proposedRentCents);
  const givenDays = daysBetween(input.noticeDate, input.effectiveDate);
  const frequency = input.lastIncreaseDate
    ? {
        ok: input.effectiveDate >= twelveMonthEarliest(input.lastIncreaseDate),
        earliest: twelveMonthEarliest(input.lastIncreaseDate),
        ruleId: "CA-CC-1947.12",
        computation: `Prior increase ${input.lastIncreaseDate}. Earliest next effective date under a 12-month count is ${twelveMonthEarliest(input.lastIncreaseDate)}.`,
      }
    : {
        ok: "unknown" as const,
        earliest: null,
        ruleId: "CA-CC-1947.12",
        computation: "No earlier increase date was entered, so the once-per-12-months limit was not checked.",
      };

  const area = areaFor(input);
  const ab1482 = area ? ab1482Quote(input.effectiveDate, area, input.lowestRentCents) : null;
  const pack = packByJurisdiction(input.jurisdiction);
  const facts = input.localFacts ?? { builtYear: null, housingType: null, unitCount: null, subsidized: null };

  let local: CapQuote | null = null;
  let utilityAddonAllowed: boolean | null = null;
  let utilityNote: string | null = null;
  let jurisdictionNote = "";
  let jurisdictionNoteEs = "";

  if (input.jurisdiction === "city_la") {
    utilityAddonAllowed = input.effectiveDate < LA_RSO_UTILITY_ADDON_ENDS;
    utilityNote = utilityAddonAllowed
      ? "This effective date is before February 2, 2026. Read the older utility-add-on rules on LAHD rather than assuming the new ban applies."
      : "LAHD says that starting February 2, 2026 an RSO landlord can no longer add an extra percentage for gas and electricity. This note applies only if the unit is actually covered.";
    if (input.rsoStatus === "covered") {
      local = laRsoQuote(input.effectiveDate, input.lowestRentCents);
      jurisdictionNote = "You said this unit is covered by the City of Los Angeles RSO. The local percentage is stricter than AB 1482 when both numbers are known. Confirm coverage on ZIMAS.";
      jurisdictionNoteEs = "Usted indicó que esta unidad está cubierta por la RSO de la Ciudad de Los Ángeles. El porcentaje local es más estricto que AB 1482 cuando ambos números se conocen. Confirme la cobertura en ZIMAS.";
    } else if (input.rsoStatus === "not_covered") {
      jurisdictionNote = "You said this unit is not covered by the City of Los Angeles RSO. The checker uses the statewide chart only. Confirm that status on ZIMAS. Exemptions from AB 1482 are listed and not verified.";
      jurisdictionNoteEs = "Usted indicó que esta unidad no está cubierta por la RSO de la Ciudad de Los Ángeles. La herramienta usa solo la tabla estatal. Confirme ese dato en ZIMAS. Las exenciones de AB 1482 se enumeran y no están verificadas.";
    } else {
      jurisdictionNote = "RSO coverage is marked unknown. A covered unit may be limited to the local percentage, which is lower than the statewide chart. No single allowed rent is stated.";
      jurisdictionNoteEs = "La cobertura de la RSO está marcada como desconocida. Una unidad cubierta puede limitarse al porcentaje local, más bajo que la tabla estatal. No se indica una sola renta permitida.";
    }
  } else if (input.jurisdiction === "la_county_unincorporated") {
    if (input.rstpoTier === "not_covered") {
      jurisdictionNote = "You said the unit is not a fully covered RSTPO unit. The checker uses the statewide chart only. Confirm the map and the ordinance.";
      jurisdictionNoteEs = "Usted indicó que la unidad no está plenamente cubierta por la RSTPO. La herramienta usa solo la tabla estatal. Confirme el mapa y la ordenanza.";
    } else if (input.rstpoTier === "unsure") {
      jurisdictionNote = "The RSTPO tier is unknown. Fully covered units use a lower cap than AB 1482. No single allowed rent is stated.";
      jurisdictionNoteEs = "La categoría de la RSTPO es desconocida. Las unidades plenamente cubiertas usan un tope más bajo que AB 1482. No se indica una sola renta permitida.";
    } else {
      local = rstpoQuote(input.effectiveDate, input.rstpoTier, input.lowestRentCents);
      jurisdictionNote = "You selected an unincorporated LA County tier. Rent Right does not verify small-landlord or luxury status.";
      jurisdictionNoteEs = "Usted eligió una categoría del condado no incorporado. Rent Right no verifica si es pequeño propietario o unidad de lujo.";
    }
  } else if (input.jurisdiction === "city_sd") {
    jurisdictionNote =
      "The City of San Diego ordinance in this library (Municipal Code §§98.0701–98.0709) is a just-cause rule, not a local percentage cap. The percentage used here is the statewide AB 1482 chart for San Diego County. Other cities in the county are not the City of San Diego.";
    jurisdictionNoteEs =
      "La ordenanza de la Ciudad de San Diego en esta biblioteca (Código Municipal §§98.0701–98.0709) es una regla de causa justa, no un tope local de porcentaje. El porcentaje usado aquí es la tabla estatal de AB 1482 para el condado de San Diego. Otras ciudades del condado no son la Ciudad de San Diego.";
  } else if (pack?.capStatus === "none") {
    const name = pack.name;
    jurisdictionNote = `${name} is in this library as a local tenant ordinance without a local percentage rent cap. The percentage used here is the statewide AB 1482 chart. Coverage and exemptions are not confirmed.`;
    jurisdictionNoteEs = `${name} está en esta biblioteca como una ordenanza local de inquilinos sin un tope local de porcentaje. El porcentaje usado aquí es la tabla estatal de AB 1482. La cobertura y las exenciones no están confirmadas.`;
  } else if (pack?.verification && (pack.capStatus === "published" || pack.capStatus === "unsure")) {
    const decision = evaluateLocalCap(pack.verification, facts, input.effectiveDate);
    jurisdictionNote = decision.note;
    jurisdictionNoteEs = decision.noteEs;
    if (decision.outcome === "applied" && decision.ppm != null) {
      local = {
        ruleId: pack.rules[0]?.id ?? "LOCAL",
        ppm: decision.ppm,
        maxRentCents: applyPpm(input.lowestRentCents, decision.ppm),
        unsure: false,
        note: decision.note,
        noteEs: decision.noteEs,
      };
    }
  } else if (statewide(input.jurisdiction)) {
    if (input.localOrdinanceName) {
      jurisdictionNote = `Statewide California rules are shown. Local rules in ${input.localOrdinanceName} may add protections. This library has not loaded that city's ordinance, so the percentage here is only the statewide chart.`;
      jurisdictionNoteEs = `Se muestran las reglas estatales de California. Las reglas locales de ${input.localOrdinanceName} pueden añadir protecciones. Esta biblioteca no ha cargado la ordenanza de esa ciudad, así que el porcentaje de aquí es solo la tabla estatal.`;
    } else {
      jurisdictionNote = "Statewide California rules are shown. A city ordinance that is not in this library may add protections.";
      jurisdictionNoteEs = "Se muestran las reglas estatales de California. Una ordenanza de la ciudad que no esté en esta biblioteca puede añadir protecciones.";
    }
  } else {
    jurisdictionNote = "Jurisdiction is unknown, so no cap was applied. A California address uses statewide rules until a loaded city matches.";
    jurisdictionNoteEs = "La jurisdicción es desconocida, así que no se aplicó un tope. Una dirección de California usa las reglas estatales hasta que coincida una ciudad cargada.";
  }

  const known: CapQuote[] = [ab1482, local].filter((item): item is CapQuote => !!item && !item.unsure && item.ppm !== null);
  const coverageUnknown =
    input.jurisdiction === "unsure" ||
    (input.jurisdiction === "city_la" && input.rsoStatus === "unsure") ||
    (input.jurisdiction === "la_county_unincorporated" && input.rstpoTier === "unsure");

  let applicable: RentIncreaseResult["applicable"];
  if (coverageUnknown || known.length === 0) {
    applicable = {
      status: "unsure",
      ppm: null,
      maxRentCents: null,
      ruleId: null,
      reason: coverageUnknown
        ? "Unsure which cap controls. The figures above are shown so you can compare them. This is not a statement that the increase is legal."
        : "Unsure. No published percentage in this library covers that effective date.",
      reasonEs: coverageUnknown
        ? "No se puede precisar qué tope manda. Las cifras de arriba se muestran para que las compare. No es una afirmación de que el aumento sea legal."
        : "No se puede precisar. Ningún porcentaje publicado en esta biblioteca cubre esa fecha de vigencia.",
    };
  } else {
    const strictest = known.reduce((best, item) => (item.ppm! < best.ppm! ? item : best));
    const over = input.proposedRentCents > (strictest.maxRentCents ?? 0);
    applicable = {
      status: over ? "over_cap" : "within_cap",
      ppm: strictest.ppm,
      maxRentCents: strictest.maxRentCents,
      ruleId: strictest.ruleId,
      reason: over
        ? `The proposed rent is above the stricter published figure in this library (${strictest.ppm! / 10_000}%). If an exemption applies, this comparison does not.`
        : `The proposed rent is at or under the stricter published figure in this library (${strictest.ppm! / 10_000}%). Exemptions, notices, and local registration are not verified.`,
      reasonEs: over
        ? `La renta propuesta está por encima de la cifra publicada más estricta de esta biblioteca (${strictest.ppm! / 10_000}%). Si aplica una exención, esta comparación no.`
        : `La renta propuesta está en o bajo la cifra publicada más estricta de esta biblioteca (${strictest.ppm! / 10_000}%). Las exenciones, los avisos y el registro local no están verificados.`,
    };
  }

  return {
    rulesVersion: LIBRARY_VERSION,
    clinicReview: CLINIC_REVIEW,
    confirmWithOfficialSource: true,
    ppm,
    percentLabel: `${(ppm / 10_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`,
    notice: {
      requiredDays: notice.requiredDays,
      givenDays,
      ok: givenDays >= notice.requiredDays,
      ruleId: "CA-CC-827",
      computation: `Increase ${ppm} ppm. More than 100000 ppm (10%) requires 90 days; otherwise 30. Notice ${input.noticeDate} to effective ${input.effectiveDate} is ${givenDays} days.`,
    },
    frequency,
    ab1482,
    local,
    applicable,
    utilityAddonAllowed,
    utilityNote,
    exemptionsToConfirm: input.jurisdiction === "unsure" ? [] : EXEMPTIONS,
    exemptionsToConfirmEs: input.jurisdiction === "unsure" ? [] : EXEMPTIONS_ES,
    exemptionUnverified: input.claimsExemption,
    jurisdictionNote,
    jurisdictionNoteEs,
  };
}

export function retaliationWindow(activityDate: string, noticeDate: string): {
  flagged: boolean;
  daysSince: number;
  ruleId: "CA-CC-1942.5";
  explanation: string;
  explanationEs: string;
} {
  const daysSince = daysBetween(activityDate, noticeDate);
  const flagged = daysSince >= 0 && daysSince <= 180;
  return {
    flagged,
    daysSince,
    ruleId: "CA-CC-1942.5",
    explanation: flagged
      ? `This notice date is ${daysSince} days after a logged repair request or complaint. Civil Code §1942.5 uses a 180-day window. A date inside that window is not a finding that the notice was retaliation. Exceptions in the statute include nonpayment and other good-faith reasons. Talk with legal aid before you act on an eviction notice.`
      : `This notice date is ${daysSince} days after that activity, outside the 180-day window described in Civil Code §1942.5. Being outside the window is not a finding that the notice is lawful.`,
    explanationEs: flagged
      ? `La fecha de este aviso es ${daysSince} días después de una solicitud de reparación o queja registrada. El Código Civil §1942.5 usa una ventana de 180 días. Una fecha dentro de esa ventana no es una conclusión de que el aviso fue represalia. Las excepciones incluyen la falta de pago y otros motivos de buena fe. Hable con asistencia legal antes de actuar sobre un aviso de desalojo.`
      : `La fecha de este aviso es ${daysSince} días después de esa actividad, fuera de la ventana de 180 días del Código Civil §1942.5. Estar fuera de la ventana no significa que el aviso sea legal.`,
  };
}

export type ReminderSlot = "7d" | "3d" | "0d";

export function pendingReminderSlots(dueDate: string, today: string, alreadySent: readonly string[]): ReminderSlot[] {
  const slots: { id: ReminderSlot; on: string }[] = [
    { id: "7d", on: addDays(dueDate, -7) },
    { id: "3d", on: addDays(dueDate, -3) },
    { id: "0d", on: dueDate },
  ];
  return slots
    .filter((slot) => {
      if (alreadySent.includes(slot.id)) return false;
      const late = daysBetween(slot.on, today);
      return late >= 0 && late <= 1;
    })
    .map((slot) => slot.id);
}

export { inferJurisdiction } from "@/lib/rules/detect";
