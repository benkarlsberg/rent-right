import { addDays, addMonths, daysBetween, isWeekend, parseISODate } from "@/lib/rules/dates";
import { BATCH1B_RULES, batch1bDeposit, batch1bRent, batch1bRepair, batch1bRepairLetter, batch1bRetaliation } from "@/lib/rules/states/batch1b";
import {
  FL_RULES,
  TX_RULES,
  batchRepairLetter,
  flDeposit,
  flRent,
  flRepair,
  flRetaliation,
  txDeposit,
  txRent,
  txRepair,
  txRetaliation,
} from "@/lib/rules/states/batch1";
import { rule, type Rule } from "@/lib/rules/define";

type RepairSeverity =
  | "no_heat" | "no_water" | "no_electricity" | "gas_leak" | "sewage" | "flood" | "no_toilet"
  | "door" | "window" | "co_alarm" | "fire" | "wiring" | "leak" | "mold" | "pests" | "other";

function increasePpm(lowestCents: number, proposedCents: number): number {
  if (lowestCents <= 0) throw new Error("lowest rent must be positive");
  return Math.round(((proposedCents - lowestCents) * 1_000_000) / lowestCents);
}

/** Statewide law loaded for a home. California local packs stay on the California path. */
export const COVERED_LAW_STATES = ["AZ", "NV", "OR", "WA", "TX", "FL", "NY", "IL", "MA", "NC", "PA", "OH", "DC"] as const;
export type AddedState = (typeof COVERED_LAW_STATES)[number];
export type LawState = "CA" | AddedState;

const CHECKED = "Nov 8, 2026";
const CHECKED_ES = "8 de noviembre de 2026";

const CA_JURISDICTIONS = new Set(["city_la", "la_county_unincorporated", "city_sd", "ca", "other_ca"]);

export function lawStateOf(unit: { jurisdiction?: string; supported?: boolean } | null | undefined): LawState | null {
  if (!unit) return "CA";
  if (unit.supported === false || unit.jurisdiction === "unsupported" || unit.jurisdiction === "unsure") return null;
  const code = (unit.jurisdiction || "").toLowerCase();
  if ((COVERED_LAW_STATES as readonly string[]).includes(code.toUpperCase())) return code.toUpperCase() as AddedState;
  if (!unit.jurisdiction || CA_JURISDICTIONS.has(unit.jurisdiction)) return "CA";
  return null;
}

export function isAddedState(value: string | null | undefined): value is AddedState {
  return !!value && (COVERED_LAW_STATES as readonly string[]).includes(value.toUpperCase());
}

function nthWeekday(year: number, monthIndex: number, weekday: number, nth: number): string {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return iso(year, monthIndex, day);
}

function lastWeekday(year: number, monthIndex: number, weekday: number): string {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return iso(year, monthIndex, last.getUTCDate() - offset);
}

function iso(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A.R.S. § 1-301, opened on azleg.gov on Nov 8, 2026. Years outside 2026–2027 are not generated. */
export function arizonaLegalHoliday(date: string): boolean | null {
  const year = Number(date.slice(0, 4));
  if (year < 2026 || year > 2027) return null;
  const month = Number(date.slice(5, 7)) - 1;
  const day = Number(date.slice(8, 10));
  const stamp = parseISODate(date);
  const weekday = stamp.getUTCDay();
  const fixed = new Set<string>([
    iso(year, 0, 1),
    nthWeekday(year, 0, 1, 3),
    nthWeekday(year, 1, 1, 3),
    lastWeekday(year, 4, 1),
    iso(year, 5, 2),
    iso(year, 6, 4),
    iso(year, 7, 14),
    nthWeekday(year, 8, 1, 1),
    iso(year, 8, 17),
    nthWeekday(year, 9, 1, 2),
    iso(year, 10, 11),
    nthWeekday(year, 10, 4, 4),
    iso(year, 11, 25),
  ]);
  if (fixed.has(date) && weekday !== 0) return true;
  const saturdayShift = [iso(year, 0, 1), iso(year, 6, 4), iso(year, 10, 11), iso(year, 11, 25)];
  for (const holiday of saturdayShift) {
    if (parseISODate(holiday).getUTCDay() === 6 && date === addDays(holiday, -1)) return true;
  }
  const sundayShift = [
    iso(year, 0, 1),
    nthWeekday(year, 0, 1, 3),
    nthWeekday(year, 1, 1, 3),
    lastWeekday(year, 4, 1),
    iso(year, 6, 4),
    nthWeekday(year, 8, 1, 1),
    nthWeekday(year, 9, 1, 2),
    iso(year, 10, 11),
    nthWeekday(year, 10, 4, 4),
    iso(year, 11, 25),
  ];
  for (const holiday of sundayShift) {
    if (parseISODate(holiday).getUTCDay() === 0 && date === addDays(holiday, 1)) return true;
  }
  if (month === 5 && day === 2 && weekday !== 0) return true;
  return false;
}

function countedDays(start: string, count: number, skip: (day: string) => boolean | null): { due: string | null; unsure: boolean } {
  const found: string[] = [];
  let cursor = start;
  while (found.length < count) {
    cursor = addDays(cursor, 1);
    const skipped = skip(cursor);
    if (skipped == null) return { due: null, unsure: true };
    if (skipped) continue;
    found.push(cursor);
  }
  return { due: found[count - 1] || null, unsure: false };
}

type Stamp = {
  dueDate: string | null;
  ruleId: string;
  citation: string;
  explanation: string;
  explanationEs: string;
  computation: string;
  unsure: boolean;
};

export function stateDeposit(state: AddedState, triggerDate: string): Stamp {
  const added = batch1bDeposit(state, triggerDate);
  if (added) return added;
  if (state === "TX") return txDeposit(triggerDate);
  if (state === "FL") return flDeposit(triggerDate);
  if (state === "AZ") {
    const counted = countedDays(triggerDate, 14, (day) => {
      if (isWeekend(day)) return true;
      return arizonaLegalHoliday(day);
    });
    const due = counted.due;
    return {
      dueDate: due,
      ruleId: "AZ-ARS-33-1321",
      citation: "Ariz. Rev. Stat. § 33-1321",
      unsure: counted.unsure || !due,
      computation: due
        ? `${triggerDate} plus 14 days that are not a Saturday, Sunday, or Arizona legal holiday under § 1-301 = ${due}. The trigger day was not counted.`
        : "Unsure. The Arizona legal-holiday list in this library covers 2026 and 2027 only.",
      explanation: due
        ? `A.R.S. § 33-1321(D) gives the landlord 14 days, excluding Saturdays, Sundays, and other legal holidays, after termination of the tenancy and delivery of possession and a demand by the tenant. Using ${triggerDate} as the day all three had happened, that date is ${due}. If termination, possession, or the demand was later, this date is too early. Checked ${CHECKED}. This is not a decision about what may be withheld.`
        : `Unsure. A.R.S. § 33-1321(D) excludes Saturdays, Sundays, and legal holidays, and this library's holiday list covers 2026–2027 only. No due date was calculated.`,
      explanationEs: due
        ? `La sección 33-1321(D) de Arizona da 14 días, sin sábados, domingos ni otros días festivos legales, después de que terminen el arrendamiento, la entrega de la posesión y un requerimiento del inquilino. Si ${triggerDate} es el día en que ya ocurrieron los tres, la fecha es ${due}. Si alguno fue después, esta fecha es demasiado pronto. Revisado el ${CHECKED_ES}. No decide qué se puede retener.`
        : `No se puede precisar. La sección 33-1321(D) excluye sábados, domingos y días festivos, y esta lista cubre solo 2026–2027. No se calculó una fecha.`,
    };
  }
  if (state === "NV") {
    const due = addDays(triggerDate, 30);
    return {
      dueDate: due,
      ruleId: "NV-NRS-118A.242",
      citation: "Nev. Rev. Stat. § 118A.242",
      unsure: false,
      computation: `${triggerDate} + 30 calendar days = ${due}. Weekends and holidays are not excluded by the section opened.`,
      explanation: `NRS 118A.242(4) says the itemized accounting and any remaining deposit are due no later than 30 days after termination of the tenancy. Counted from ${triggerDate}, that is ${due}. The section does not say to skip weekends or holidays. It does not use California's 21-day count. Checked ${CHECKED}.`,
      explanationEs: `NRS 118A.242(4) dice que el desglose y cualquier depósito restante vencen a más tardar 30 días después de que termina el arrendamiento. Contado desde ${triggerDate}, es ${due}. La sección no dice que se omitan fines de semana o días festivos. No usa el conteo de 21 días de California. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "OR") {
    const due = addDays(triggerDate, 31);
    return {
      dueDate: due,
      ruleId: "OR-ORS-90.300",
      citation: "Or. Rev. Stat. § 90.300",
      unsure: false,
      computation: `${triggerDate} + 31 calendar days = ${due}.`,
      explanation: `ORS 90.300(13) says the deposit or the unclaimed part is due not later than 31 days after the tenancy terminates and the tenant delivers possession. Using ${triggerDate} as that combined day, the date is ${due}. A manufactured dwelling or floating home that is abandoned uses a different start, and that path was not applied. Checked ${CHECKED}.`,
      explanationEs: `ORS 90.300(13) dice que el depósito o la parte no reclamada vence a más tardar 31 días después de que termina el arrendamiento y el inquilino entrega la posesión. Si ${triggerDate} es ese día combinado, la fecha es ${due}. Una vivienda prefabricada o casa flotante abandonada usa otro inicio, y ese camino no se aplicó. Revisado el ${CHECKED_ES}.`,
    };
  }
  const due = addDays(triggerDate, 30);
  return {
    dueDate: due,
    ruleId: "WA-RCW-59.18.280",
    citation: "Wash. Rev. Code § 59.18.280",
    unsure: false,
    computation: `${triggerDate} + 30 calendar days = ${due}.`,
    explanation: `RCW 59.18.280(1)(a) gives 30 days after termination of the rental agreement and vacation of the premises, or 30 days after the landlord learns of abandonment. Using ${triggerDate} as termination and vacation, the date is ${due}. The abandonment trigger was not used. The section does not say to skip weekends. Checked ${CHECKED}.`,
    explanationEs: `RCW 59.18.280(1)(a) da 30 días después de que terminan el contrato y el desalojo de la vivienda, o 30 días después de que el propietario se entera del abandono. Si ${triggerDate} es la terminación y la entrega, la fecha es ${due}. No se usó el abandono. La sección no dice que se omitan fines de semana. Revisado el ${CHECKED_ES}.`,
  };
}

type RepairClock = { hours: number | null; days: number | null; label: string; labelEs: string };

function repairClock(state: AddedState, severity: RepairSeverity): RepairClock {
  if (state === "AZ") {
    const health = new Set<RepairSeverity>(["no_heat", "no_water", "no_electricity", "gas_leak", "sewage", "flood", "no_toilet", "co_alarm", "fire", "wiring"]);
    if (health.has(severity)) {
      return { hours: null, days: 5, label: "5 days after receipt for a § 33-1324 breach that materially affects health and safety", labelEs: "5 días después de recibirlo si el incumplimiento de la § 33-1324 afecta de forma importante la salud y la seguridad" };
    }
    return { hours: null, days: 10, label: "10 days after receipt for other material noncompliance", labelEs: "10 días después de recibirlo para otro incumplimiento importante" };
  }
  if (state === "NV") {
    return { hours: null, days: 14, label: "14 days after receipt to remedy or use best efforts", labelEs: "14 días después de recibirlo para remediarlo o hacer un esfuerzo razonable" };
  }
  if (state === "OR") {
    const imminent = new Set<RepairSeverity>(["gas_leak", "fire", "co_alarm"]);
    const essential = new Set<RepairSeverity>(["no_heat", "no_water", "no_electricity", "sewage", "no_toilet", "flood"]);
    if (imminent.has(severity)) {
      return { hours: 48, days: null, label: "48 hours under ORS 90.365(2) when the lack of an essential service is an imminent and serious threat", labelEs: "48 horas según ORS 90.365(2) cuando la falta de un servicio esencial es una amenaza inminente y grave" };
    }
    if (essential.has(severity)) {
      return { hours: null, days: 7, label: "7 days to remedy an essential service under ORS 90.360", labelEs: "7 días para remediar un servicio esencial según ORS 90.360" };
    }
    return { hours: null, days: 30, label: "30 days to remedy other noncompliance under ORS 90.360", labelEs: "30 días para remediar otro incumplimiento según ORS 90.360" };
  }
  const day = new Set<RepairSeverity>(["no_heat", "no_water", "no_electricity", "gas_leak", "fire", "co_alarm", "wiring"]);
  const plumbing = new Set<RepairSeverity>(["sewage", "flood", "no_toilet"]);
  if (day.has(severity)) {
    return { hours: 24, days: null, label: "24 hours after receipt where the condition deprives the tenant of water, heat, or electricity, or is imminently hazardous to life", labelEs: "24 horas después de recibirlo si falta agua, calefacción o electricidad, o si el peligro para la vida es inminente" };
  }
  if (plumbing.has(severity)) {
    return { hours: 72, days: null, label: "72 hours after receipt for a refrigerator, range and oven, or major plumbing fixture supplied by the landlord", labelEs: "72 horas después de recibirlo para un refrigerador, estufa y horno, o un accesorio importante de plomería que da el propietario" };
  }
  return { hours: null, days: 10, label: "10 days after receipt in other cases under RCW 59.18.070", labelEs: "10 días después de recibirlo en los demás casos de RCW 59.18.070" };
}

export function stateRepair(state: AddedState, requestDate: string, severity: RepairSeverity): Stamp {
  const added = batch1bRepair(state, requestDate, severity);
  if (added) return added;
  if (state === "TX") return txRepair(requestDate);
  if (state === "FL") return flRepair();
  if (state !== "AZ" && state !== "NV" && state !== "OR" && state !== "WA") {
    throw new Error("repair state was not routed");
  }
  const clock = repairClock(state, severity);
  const cites = {
    AZ: ["AZ-ARS-33-1361", "Ariz. Rev. Stat. § 33-1361"],
    NV: ["NV-NRS-118A.355", "Nev. Rev. Stat. § 118A.355"],
    OR: ["OR-ORS-90.360", clock.hours === 48 ? "Or. Rev. Stat. § 90.365" : "Or. Rev. Stat. § 90.360"],
    WA: ["WA-RCW-59.18.070", "Wash. Rev. Code § 59.18.070"],
  }[state];
  if (clock.hours != null) {
    return {
      dueDate: null,
      ruleId: cites[0],
      citation: cites[1],
      unsure: true,
      computation: `Receipt ${requestDate}. ${clock.label}. No calendar date was stored because the statute uses hours and the time of receipt was not entered.`,
      explanation: `${cites[1]} uses ${clock.label}. The date you entered is ${requestDate}, without a time of receipt, so Rent Right did not turn that into a calendar day. This is the statute's response period after a written notice is received. It is not permission to withhold rent, repair and deduct, or end the tenancy. Those remedies have separate conditions in the same chapter. A personal follow-up reminder is separate from this period. Checked ${CHECKED}. This does not decide that the condition is the landlord's duty.`,
      explanationEs: `${cites[1]} usa ${clock.labelEs}. La fecha anotada es ${requestDate}, sin la hora en que se recibió el aviso, así que Rent Right no la convirtió en un día calendario. Este es el plazo de respuesta de la ley después de que se recibe un aviso escrito. No autoriza retener la renta, reparar y descontar, ni terminar el arrendamiento. Esos remedios tienen condiciones aparte. Un recordatorio personal es distinto. Revisado el ${CHECKED_ES}.`,
    };
  }
  const due = addDays(requestDate, clock.days || 0);
  return {
    dueDate: due,
    ruleId: cites[0],
    citation: cites[1],
    unsure: false,
    computation: `Receipt ${requestDate} + ${clock.days} calendar days = ${due}. The receipt day was not counted. Weekends were not skipped.`,
      explanation: `${cites[1]}: ${clock.label}. Counted from the notice-receipt date you entered (${requestDate}), that is ${due}. If the notice was only sent that day and not yet received, this date is early. Mailed notice in Oregon can add three days under ORS 90.155, and that was not added because delivery method was not entered. This date is not permission to withhold rent, repair and deduct, or end the tenancy. Those steps have separate conditions. A personal follow-up reminder is separate from this statutory period. Checked ${CHECKED}.`,
      explanationEs: `${cites[1]}: ${clock.labelEs}. Contado desde la fecha en que anotó que se recibió el aviso (${requestDate}), es ${due}. Si ese día solo se envió y aún no se recibió, esta fecha es demasiado pronto. Un aviso por correo en Oregón puede sumar tres días según ORS 90.155, y eso no se sumó porque no se anotó la forma de entrega. Esta fecha no autoriza retener la renta, reparar y descontar, ni terminar el arrendamiento. Un recordatorio personal es distinto. Revisado el ${CHECKED_ES}.`,
  };
}

export function stateRetaliation(state: AddedState, activityDate: string, noticeDate: string): {
  flagged: boolean;
  daysSince: number;
  ruleId: string;
  explanation: string;
  explanationEs: string;
} {
  const daysSince = daysBetween(activityDate, noticeDate);
  const added = batch1bRetaliation(state, activityDate, noticeDate, daysSince);
  if (added) return added;
  if (state === "TX") return txRetaliation(activityDate, noticeDate, daysSince);
  if (state === "FL") return flRetaliation(daysSince);
  if (state === "AZ") {
    const end = addMonths(activityDate, 6);
    const flagged = daysSince >= 0 && noticeDate <= end;
    return {
      flagged,
      daysSince,
      ruleId: "AZ-ARS-33-1381",
      explanation: flagged
        ? `The later date is ${daysSince} days after the earlier one, and not after ${end}, six calendar months from the earlier date. A.R.S. § 33-1381(B) says a complaint within six months before the alleged act creates a presumption. The presumption does not arise if the complaint came after notice of termination. It is not a finding of retaliation. Exceptions include a tenant-caused code violation and rent default.`
        : `The later date is outside six calendar months after the earlier date (${end}). A.R.S. § 33-1381(B) uses that period for a presumption. Being outside it is not a finding that the act was lawful.`,
      explanationEs: flagged
        ? `La fecha posterior es ${daysSince} días después de la anterior, y no después del ${end}, seis meses calendario. La sección 33-1381(B) dice que una queja dentro de los seis meses anteriores al acto alegado crea una presunción. La presunción no surge si la queja fue después del aviso de terminación. No es una conclusión de represalia.`
        : `La fecha posterior está fuera de los seis meses calendario después de la anterior (${end}). La sección 33-1381(B) usa ese período para una presunción. Estar fuera no significa que el acto sea lícito.`,
    };
  }
  if (state === "WA") {
    const flagged = daysSince >= 0 && daysSince <= 90;
    return {
      flagged,
      daysSince,
      ruleId: "WA-RCW-59.18.250",
      explanation: flagged
        ? `The later date is ${daysSince} days after the earlier one, inside 90 days. RCW 59.18.250 creates a rebuttable presumption for a listed reprisal within 90 days after a protected act. It is not a finding. The presumption can be affected by unpaid rent, a stated ground for a rent increase, or repairs that cannot be done while the tenant stays.`
        : `The later date is ${daysSince} days after the earlier one, outside the 90 days in RCW 59.18.250. Being outside that period is not a finding that the act was lawful.`,
      explanationEs: flagged
        ? `La fecha posterior es ${daysSince} días después, dentro de 90 días. RCW 59.18.250 crea una presunción refutable para una represalia enumerada dentro de 90 días. No es una conclusión.`
        : `La fecha posterior es ${daysSince} días después, fuera de los 90 días de RCW 59.18.250. Estar fuera no significa que el acto sea lícito.`,
    };
  }
  const citation = state === "NV" ? "NRS 118A.510" : "ORS 90.385";
  const ruleId = state === "NV" ? "NV-NRS-118A.510" : "OR-ORS-90.385";
  return {
    flagged: false,
    daysSince,
    ruleId,
    explanation: `${citation} prohibits retaliatory conduct after listed tenant acts. The section opened on ${CHECKED} does not state a general number of days for every rent increase or notice. Rent Right did not apply California's 180-day window. A date match was not flagged. Exceptions in the statute still have to be read, including, for Nevada, a uniform rent increase to all tenants.`,
    explanationEs: `${citation} prohíbe represalias después de actos enumerados del inquilino. La sección abierta el ${CHECKED_ES} no fija un número general de días para cada aumento o aviso. Rent Right no aplicó la ventana de 180 días de California. No se marcó una coincidencia de fechas.`,
  };
}

export type StateRentAnswer = {
  headlineEn: string;
  headlineEs: string;
  detailEn: string;
  detailEs: string;
  ruleId: string;
  abovePublishedMax: boolean;
};

export function stateRentAnswer(input: {
  state: AddedState;
  lowestCents: number;
  proposedCents: number;
  noticeDate: string | null;
  effectiveDate: string;
  weekToWeek: boolean;
  firstYear: boolean | null;
  claimsExemption: boolean;
  /** Ordinary rented dwelling, a lot for a home the tenant owns, or not yet known. */
  homeKind?: "dwelling" | "manufactured_lot" | "unknown";
}): StateRentAnswer {
  const added = batch1bRent(input.state, input.lowestCents, input.proposedCents);
  if (added) return added;
  if (input.state === "TX") return txRent(input.lowestCents, input.proposedCents);
  if (input.state === "FL") return flRent(input.lowestCents, input.proposedCents);
  const ppm = increasePpm(input.lowestCents, input.proposedCents);
  const percent = (ppm / 10_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  const given = input.noticeDate ? daysBetween(input.noticeDate, input.effectiveDate) : null;
  if (input.state === "AZ") {
    return {
      headlineEn: "Arizona rent increase",
      headlineEs: "Aumento de renta en Arizona",
      ruleId: "AZ-ARS-33-1314",
      abovePublishedMax: false,
      detailEn: `The increase from the amounts entered is about ${percent}%. A.R.S. § 33-1314 lets the rental agreement set the rent. The sections opened on ${CHECKED} do not state a statewide percentage cap for a chapter 10 dwelling. They also do not label a rent increase as its own notice period. A.R.S. § 33-1375 is a different duty: written notice at least 10 days before the termination date for a week-to-week tenancy, or at least 30 days before the periodic rental date for a month-to-month tenancy, to end that tenancy. A.R.S. § 33-1313 says notice is given by steps reasonably calculated to inform the other person, and registered or certified mail is deemed received on actual receipt or five days after mailing, whichever is first. Rent Right did not treat § 33-1375 as a passed or failed rent-increase deadline. A fixed-term agreement can set its own change terms. A.R.S. § 33-1329 preempts city and town rent control on most private housing. The 90-day notice in § 33-1413 is the mobile-home chapter and was not applied. No cap was checked.`,
      detailEs: `El aumento con los montos anotados es de alrededor del ${percent}%. La sección 33-1314 permite que el contrato fije la renta. Las secciones abiertas el ${CHECKED_ES} no fijan un tope estatal para una vivienda del capítulo 10 ni llaman al aumento un plazo de aviso propio. La sección 33-1375 es otra obligación: aviso escrito de al menos 10 días para terminar un arrendamiento semanal, o al menos 30 días antes de la fecha periódica de renta para terminar un arrendamiento mes a mes. Rent Right no trató esa sección como un plazo de aumento aprobado o reprobado. La sección 33-1413 es de casas móviles y no se aplicó. No se revisó un tope.`,
    };
  }
  if (input.state === "NV") {
    const short = input.weekToWeek;
    const needed = short ? 30 : 60;
    const notice = given == null
      ? "The notice date was not entered, so the 60-day or 30-day count was not made."
      : given >= 60
        ? `The dates entered are ${given} days apart, which meets the 60-day written notice in NRS 118A.300.`
        : given >= 30
          ? `The dates entered are ${given} days apart. NRS 118A.300 requires 60 days, or 30 days only when the periodic tenancy is less than one month. That length was ${short ? "marked as less than one month" : "not confirmed"}, so this is not a finding that the notice was sufficient.`
          : `The dates entered are ${given} days apart, shorter than both the 60-day and 30-day periods in NRS 118A.300.`;
    return {
      headlineEn: "Nevada rent notice",
      headlineEs: "Aviso de renta en Nevada",
      ruleId: "NV-NRS-118A.300",
      abovePublishedMax: false,
      detailEn: `The increase from the amounts entered is about ${percent}%. NRS 118A.300 requires written notice 60 days, or 30 days for a periodic tenancy of less than one month, before the first increased payment. ${notice} The section does not state a percentage cap. Checked ${CHECKED}.`,
      detailEs: `El aumento con los montos anotados es de alrededor del ${percent}%. NRS 118A.300 exige aviso escrito de 60 días, o 30 días si el período es menor de un mes, antes del primer pago aumentado. La sección no fija un tope de porcentaje. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (input.state === "OR") {
    const kind = input.homeKind ?? "unknown";
    if (kind !== "dwelling") {
      return {
        headlineEn: "Oregon rent increase",
        headlineEs: "Aumento de renta en Oregón",
        ruleId: "OR-ORS-90.323",
        abovePublishedMax: false,
        detailEn: `The increase from the amounts entered is about ${percent}%. ORS 90.323's 2026 maximum of 9.5% applies to a dwelling tenancy covered by that section. ORS 90.323(7) says the section does not apply to a tenancy governed by ORS 90.505 to 90.850, including a manufactured-dwelling or floating-home space. That kind of home was not confirmed, so the 9.5% figure was not used and no notice period was judged. The 2026 figure is not reused for another year.`,
        detailEs: `El aumento es de alrededor del ${percent}%. El 9.5% de 2026 es para un arrendamiento sujeto a ORS 90.323. Esa sección no aplica a un espacio de vivienda prefabricada o casa flotante bajo ORS 90.505 a 90.850. Como eso no se confirmó, no se usó el porcentaje ni se juzgó el aviso.`,
      };
    }
    const in2026 = input.effectiveDate >= "2026-01-01" && input.effectiveDate <= "2026-12-31";
    const max = in2026 ? 9.5 : null;
    const over = max != null && ppm > Math.round(max * 10_000) && !input.claimsExemption && input.firstYear !== true;
    const cap = !in2026
      ? `The only published maximum loaded here is 9.5% for a rent increase that takes effect in calendar year 2026. The effective date ${input.effectiveDate} is outside that year, so the 2026 figure was not used and no cap comparison was made.`
      : input.claimsExemption
        ? "An exemption was marked, so the 9.5% figure was not applied. ORS 90.323(5) exempts a dwelling whose first certificate of occupancy was issued less than 15 years before the notice, and some regulated affordable housing."
        : input.firstYear === true
          ? "The tenancy was marked as still in its first year. ORS 90.323(2)(a) says rent may not be increased during that year. The percentage was not used as a cap finding."
          : over
            ? `About ${percent}% is above the 9.5% maximum DAS published for 2026 for tenancies subject to ORS 90.323. That is not a finding if the unit is exempt or the tenancy is week-to-week.`
            : `About ${percent}% is not above the 9.5% maximum DAS published for 2026, if the tenancy is subject to ORS 90.323 and no exemption applies.`;
    const needed = input.weekToWeek ? 7 : 90;
    const notice = given == null
      ? "The notice date was not entered."
      : `The dates entered are ${given} days apart. ORS 90.323 requires at least ${needed} days' written notice${input.weekToWeek ? " for a week-to-week tenancy" : " after the first year, and only one increase in 12 months"}.`;
    return {
      headlineEn: "Oregon rent increase",
      headlineEs: "Aumento de renta en Oregón",
      ruleId: "OR-ORS-90.323",
      abovePublishedMax: over,
      detailEn: `${cap} ${notice} Manufactured-dwelling and marina caps under ORS 90.600 were not applied. City ordinances were not researched. DAS page checked ${CHECKED}.`,
      detailEs: `El tope publicado en esta biblioteca para 2026 es 9.5% según el Departamento de Servicios Administrativos, para arrendamientos sujetos a ORS 90.323. ${notice} No se aplicó ORS 90.600 ni ordenanzas locales. Revisado el ${CHECKED_ES}.`,
    };
  }
  const kind = input.homeKind ?? "unknown";
  if (kind === "manufactured_lot") {
    const overLot = ppm > 50_000 && !input.claimsExemption && input.firstYear !== true;
    return {
      headlineEn: "Washington manufactured-home lot rent",
      headlineEs: "Renta del lote en Washington",
      ruleId: "WA-RCW-59.20.370",
      abovePublishedMax: overLot,
      detailEn: `The increase from the amounts entered is about ${percent}%. RCW 59.20.370 limits a manufactured or mobile home lot to 5% in any 12-month period after the first 12 months, unless an exemption in RCW 59.20.380 applies. RCW 59.20.090(2) requires written notice three months before the effective date. That three-month period was not converted into a day count. The dwelling cap in RCW 59.18.700 was not used. ${overLot ? "About " + percent + "% is above 5% if no exemption applies. That is not a finding that an exemption is absent." : "No amount above 5% was calculated from these inputs."} Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${percent}%. RCW 59.20.370 limita el lote de una casa prefabricada al 5% en cualquier período de 12 meses después de los primeros 12 meses, salvo una exención de RCW 59.20.380. RCW 59.20.090(2) exige aviso escrito con tres meses de anticipación. No se usó el tope de RCW 59.18.700. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (kind !== "dwelling") {
    return {
      headlineEn: "Washington rent increase",
      headlineEs: "Aumento de renta en Washington",
      ruleId: "WA-RCW-59.18.700",
      abovePublishedMax: false,
      detailEn: `The increase from the amounts entered is about ${percent}%. A rented house or apartment can fall under RCW 59.18.700. Commerce published 9.683% for 2026 and 10% for 2027, and RCW 59.18.140 generally requires 90 days' written notice. A lot for a manufactured or mobile home the tenant owns is RCW 59.20.370, capped at 5%, with three months' notice under RCW 59.20.090. Which one this is was not entered, so no percentage was applied and no notice period was judged. RCW 59.18.040 also lists living arrangements the residential chapter does not intend to cover. Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${percent}%. Una casa o apartamento alquilado puede caer en RCW 59.18.700. Un lote de casa prefabricada que el inquilino posee es RCW 59.20.370, con un tope del 5%. Como no se indicó cuál es, no se aplicó un porcentaje ni se juzgó el aviso. Revisado el ${CHECKED_ES}.`,
    };
  }
  const in2026 = input.effectiveDate >= "2026-01-01" && input.effectiveDate <= "2026-12-31";
  const in2027 = input.effectiveDate >= "2027-01-01" && input.effectiveDate <= "2027-12-31";
  const max = in2026 ? 9.683 : in2027 ? 10 : null;
  const over = max != null && ppm > Math.round(max * 10_000) && !input.claimsExemption && input.firstYear !== true;
  const cap = max == null
    ? `Commerce's published maximum is loaded for an increase that takes effect in 2026 (9.683%) or 2027 (10%). The effective date ${input.effectiveDate} is outside those years, so neither figure was used and no cap comparison was made.`
    : input.claimsExemption
      ? "An exemption was marked, so the published percentage was not applied. RCW 59.18.710 lists exemptions, including a certificate of occupancy 12 or fewer years before the notice and some owner-occupied housing."
      : input.firstYear === true
        ? "The tenancy was marked as still in its first 12 months. RCW 59.18.700(1)(a)(i) says rent may not be increased then."
        : over
          ? `About ${percent}% is above the ${max}% maximum Commerce published for this calendar year under RCW 59.18.700, if no exemption applies.`
          : `About ${percent}% is not above the ${max}% maximum Commerce published for this calendar year, if the tenancy is subject to RCW 59.18.700 and no exemption applies.`;
  const notice = given == null
    ? "The notice date was not entered. RCW 59.18.140 generally requires 90 days' written notice, or 30 days for some income-based subsidized tenancies."
    : `The dates entered are ${given} days apart. RCW 59.18.140 generally requires at least 90 days' written notice before a rent increase, with a 30-day notice for some income-based subsidized tenancies. Whether this tenancy is subsidized was not entered.`;
  return {
    headlineEn: "Washington rent increase",
    headlineEs: "Aumento de renta en Washington",
    ruleId: "WA-RCW-59.18.700",
    abovePublishedMax: over,
    detailEn: `${cap} ${notice} The statute expires July 1, 2040. Manufactured-home park lot rent under a different act was not applied. City ordinances were not researched. Commerce and the statute were opened ${CHECKED}.`,
    detailEs: `${cap} ${notice} La ley vence el 1 de julio de 2040. No se aplicó la renta de un lote de casa prefabricada ni ordenanzas locales. Revisado el ${CHECKED_ES}.`,
  };
}

function stateRule(input: {
  id: string;
  jurisdiction: AddedState;
  topic: string;
  topics: string[];
  titleEn: string;
  titleEs: string;
  summaryEn: string;
  summaryEs: string;
  citation: string;
  sourceName: string;
  sourceUrl: string;
}): Rule {
  return rule({
    ...input,
    findingLabel: "informational",
    confidence: "high",
    reasonEn: `Loaded for ${input.jurisdiction} only. Checked ${CHECKED}. This is not a finding about a particular home.`,
    reasonEs: `Cargado solo para ${input.jurisdiction}. Revisado el ${CHECKED_ES}. No es una conclusión sobre una vivienda en particular.`,
    patterns: [],
  });
}

export const ADDED_STATE_RULES: Rule[] = [
  ...TX_RULES,
  ...FL_RULES,
  ...BATCH1B_RULES,
  stateRule({
    id: "AZ-ARS-33-1321",
    jurisdiction: "AZ",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "Arizona security deposit accounting",
    titleEs: "Rendición del depósito en Arizona",
    summaryEn: `A.R.S. § 33-1321 limits a demanded security deposit, including prepaid rent, to one and one-half months' rent, and gives 14 days excluding Saturdays, Sundays, and legal holidays after termination, delivery of possession, and the tenant's demand for an itemized list and any amount due. Checked ${CHECKED} on azleg.gov. Chapter 10 does not cover every occupancy; § 33-1308 lists exclusions.`,
    summaryEs: `La sección 33-1321 limita el depósito exigido, incluida la renta pagada por adelantado, a un mes y medio de renta, y da 14 días sin sábados, domingos ni días festivos legales después de la terminación, la entrega de la posesión y el requerimiento del inquilino. Revisado el ${CHECKED_ES}.`,
    citation: "Ariz. Rev. Stat. § 33-1321",
    sourceName: "Arizona State Legislature",
    sourceUrl: "https://www.azleg.gov/ars/33/01321.htm",
  }),
  stateRule({
    id: "AZ-ARS-33-1361",
    jurisdiction: "AZ",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "Arizona repair notice",
    titleEs: "Aviso de reparación en Arizona",
    summaryEn: `A.R.S. § 33-1361 lets a tenant give written notice of a material breach. For a § 33-1324 breach that materially affects health and safety, the notice may say the agreement will terminate not less than five days after receipt if the breach is not remedied in five days. Other material noncompliance uses ten days. The count runs from receipt. Checked ${CHECKED}.`,
    summaryEs: `La sección 33-1361 permite un aviso escrito. Si el incumplimiento de la sección 33-1324 afecta de forma importante la salud y la seguridad, el plazo es de cinco días después de recibirlo. Otro incumplimiento importante usa diez días. Revisado el ${CHECKED_ES}.`,
    citation: "Ariz. Rev. Stat. § 33-1361",
    sourceName: "Arizona State Legislature",
    sourceUrl: "https://www.azleg.gov/ars/33/01361.htm",
  }),
  stateRule({
    id: "AZ-ARS-33-1381",
    jurisdiction: "AZ",
    topic: "retaliation",
    topics: ["retaliation", "represalia"],
    titleEn: "Arizona retaliation presumption",
    titleEs: "Presunción de represalia en Arizona",
    summaryEn: `A.R.S. § 33-1381 prohibits retaliation by a rent increase, a decrease in services, or a possession action after listed complaints or tenant organizing. A complaint within six months before the act creates a presumption, which does not arise if the complaint came after a termination notice. It is not proof. Checked ${CHECKED}.`,
    summaryEs: `La sección 33-1381 prohíbe represalias después de quejas enumeradas o de organizar inquilinos. Una queja dentro de los seis meses anteriores crea una presunción. No es una prueba. Revisado el ${CHECKED_ES}.`,
    citation: "Ariz. Rev. Stat. § 33-1381",
    sourceName: "Arizona State Legislature",
    sourceUrl: "https://www.azleg.gov/ars/33/01381.htm",
  }),
  stateRule({
    id: "AZ-ARS-33-1314",
    jurisdiction: "AZ",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta"],
    titleEn: "Arizona rent amount and notice",
    titleEs: "Monto y aviso de renta en Arizona",
    summaryEn: `A.R.S. § 33-1314 lets the agreement set the rent and does not state a statewide percentage cap. A.R.S. § 33-1375 requires written notice to terminate a week-to-week tenancy at least 10 days before the termination date, or a month-to-month tenancy at least 30 days before the periodic rental date. That section does not use the words rent increase, so it was not applied as a rent-increase deadline. A.R.S. § 33-1313 explains when notice is given and received. A.R.S. § 33-1329 preempts most city rent control. Checked ${CHECKED}.`,
    summaryEs: `La sección 33-1314 permite que el contrato fije la renta y no establece un tope estatal. La sección 33-1375 exige aviso escrito para terminar un arrendamiento semanal con al menos 10 días, o uno mes a mes con al menos 30 días antes de la fecha periódica de renta. Esa sección no dice aumento de renta, así que no se usó como plazo de aumento. Revisado el ${CHECKED_ES}.`,
    citation: "Ariz. Rev. Stat. § 33-1314",
    sourceName: "Arizona State Legislature",
    sourceUrl: "https://www.azleg.gov/ars/33/01314.htm",
  }),
  stateRule({
    id: "NV-NRS-118A.242",
    jurisdiction: "NV",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "Nevada security deposit",
    titleEs: "Depósito en Nevada",
    summaryEn: `NRS 118A.242 limits a security deposit or surety bond, including last month's rent, to three months' periodic rent, and requires an itemized written accounting and any remainder no later than 30 days after termination of the tenancy. Checked ${CHECKED} on the Nevada Legislature chapter page.`,
    summaryEs: `NRS 118A.242 limita el depósito o la fianza, incluida la renta del último mes, a tres meses de renta, y exige un desglose escrito y cualquier resto a más tardar 30 días después de que termina el arrendamiento. Revisado el ${CHECKED_ES}.`,
    citation: "Nev. Rev. Stat. § 118A.242",
    sourceName: "Nevada Legislature",
    sourceUrl: "https://www.leg.state.nv.us/division/legal/lawlibrary/nrs/NRS-118A.html",
  }),
  stateRule({
    id: "NV-NRS-118A.355",
    jurisdiction: "NV",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "Nevada habitability notice",
    titleEs: "Aviso de habitabilidad en Nevada",
    summaryEn: `NRS 118A.355 requires written notice of each failure to maintain a habitable condition. If the landlord does not remedy a material failure, or use best efforts, within 14 days after receipt, the tenant may terminate, recover actual damages, seek court relief, or withhold rent that becomes due until the landlord remedies or attempts in good faith to remedy it. A separate repair-and-deduct path in NRS 118A.360 has its own dollar limit and was not used as this deadline. Checked ${CHECKED}.`,
    summaryEs: `NRS 118A.355 exige aviso escrito. Si el propietario no remedia un incumplimiento importante, o no hace un esfuerzo razonable, dentro de 14 días después de recibirlo, el inquilino tiene los remedios de esa sección. NRS 118A.360 es otro camino y no se usó como este plazo. Revisado el ${CHECKED_ES}.`,
    citation: "Nev. Rev. Stat. § 118A.355",
    sourceName: "Nevada Legislature",
    sourceUrl: "https://www.leg.state.nv.us/division/legal/lawlibrary/nrs/NRS-118A.html",
  }),
  stateRule({
    id: "NV-NRS-118A.510",
    jurisdiction: "NV",
    topic: "retaliation",
    topics: ["retaliation", "represalia"],
    titleEn: "Nevada retaliation",
    titleEs: "Represalia en Nevada",
    summaryEn: `NRS 118A.510 prohibits retaliatory termination, nonrenewal, rent increases, cuts to essential items, or possession actions after listed protected acts. A uniform rent increase to all tenants is one exception. The section does not state a general day count. California's 180-day window is not used. Checked ${CHECKED}.`,
    summaryEs: `NRS 118A.510 prohíbe represalias después de actos protegidos enumerados. Un aumento uniforme para todos los inquilinos es una excepción. La sección no fija un conteo general de días. Revisado el ${CHECKED_ES}.`,
    citation: "Nev. Rev. Stat. § 118A.510",
    sourceName: "Nevada Legislature",
    sourceUrl: "https://www.leg.state.nv.us/division/legal/lawlibrary/nrs/NRS-118A.html",
  }),
  stateRule({
    id: "NV-NRS-118A.300",
    jurisdiction: "NV",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta"],
    titleEn: "Nevada rent-increase notice",
    titleEs: "Aviso de aumento en Nevada",
    summaryEn: `NRS 118A.300 says a landlord may not increase rent unless the landlord serves written notice 60 days, or 30 days for a periodic tenancy of less than one month, before the first increased payment. The section does not state a percentage cap. Checked ${CHECKED}.`,
    summaryEs: `NRS 118A.300 dice que el propietario no puede aumentar la renta sin un aviso escrito de 60 días, o 30 días si el período es menor de un mes, antes del primer pago aumentado. La sección no fija un tope de porcentaje. Revisado el ${CHECKED_ES}.`,
    citation: "Nev. Rev. Stat. § 118A.300",
    sourceName: "Nevada Legislature",
    sourceUrl: "https://www.leg.state.nv.us/division/legal/lawlibrary/nrs/NRS-118A.html",
  }),
  stateRule({
    id: "OR-ORS-90.300",
    jurisdiction: "OR",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "Oregon security deposit",
    titleEs: "Depósito en Oregón",
    summaryEn: `ORS 90.300(13) requires return of the security deposit or prepaid rent, or the part not claimed, not later than 31 days after the tenancy terminates and the tenant delivers possession. The 2025 special-session and 2026 regular-session amendment tables do not list 90.300. Checked ${CHECKED}.`,
    summaryEs: `ORS 90.300(13) exige devolver el depósito o la renta pagada por adelantado, o la parte no reclamada, a más tardar 31 días después de que termina el arrendamiento y el inquilino entrega la posesión. Revisado el ${CHECKED_ES}.`,
    citation: "Or. Rev. Stat. § 90.300",
    sourceName: "Oregon State Legislature",
    sourceUrl: "https://www.oregonlegislature.gov/bills_laws/ors/ors090.html",
  }),
  stateRule({
    id: "OR-ORS-90.360",
    jurisdiction: "OR",
    topic: "repair",
    topics: ["repair", "habitability", "essential service", "reparacion", "reparación"],
    titleEn: "Oregon repair periods",
    titleEs: "Plazos de reparación en Oregón",
    summaryEn: `ORS 90.360 gives seven days to remedy an essential service and 30 days for other noncompliance after delivery of the tenant's written notice. ORS 90.365(2) uses 48 hours only for an imminent and serious threat. Those periods are not permission to withhold rent or end the tenancy by themselves. The 2026 amendment table does not list 90.360 or 90.365. ORS 90.320 was amended by Oregon Laws 2026, chapter 23, effective June 5, 2026, about access devices and cooling. That amendment does not change these day counts. Checked ${CHECKED}.`,
    summaryEs: `ORS 90.360 da siete días para un servicio esencial y 30 días para otro incumplimiento después de la entrega del aviso escrito. ORS 90.365(2) permite 48 horas si la amenaza es inminente y grave. Un aviso por correo puede sumar tres días. Revisado el ${CHECKED_ES}.`,
    citation: "Or. Rev. Stat. §§ 90.360, 90.365",
    sourceName: "Oregon State Legislature",
    sourceUrl: "https://www.oregonlegislature.gov/bills_laws/ors/ors090.html",
  }),
  stateRule({
    id: "OR-ORS-90.385",
    jurisdiction: "OR",
    topic: "retaliation",
    topics: ["retaliation", "represalia"],
    titleEn: "Oregon retaliation",
    titleEs: "Represalia en Oregón",
    summaryEn: `ORS 90.385 prohibits retaliation by a rent increase, a decrease in services, a termination notice, or a possession action after listed tenant acts. The section does not set one day count for every act. The 2025 special-session and 2026 regular-session amendment tables do not list 90.385. California's 180-day window is not used. Checked ${CHECKED}.`,
    summaryEs: `ORS 90.385 prohíbe represalias después de actos enumerados. La sección no fija un solo conteo de días para todos los actos. No se usa la ventana de 180 días de California. Revisado el ${CHECKED_ES}.`,
    citation: "Or. Rev. Stat. § 90.385",
    sourceName: "Oregon State Legislature",
    sourceUrl: "https://www.oregonlegislature.gov/bills_laws/ors/ors090.html",
  }),
  stateRule({
    id: "OR-ORS-90.323",
    jurisdiction: "OR",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta", "rent cap", "percent"],
    titleEn: "Oregon maximum rent increase",
    titleEs: "Tope de aumento en Oregón",
    summaryEn: `ORS 90.323 requires 7 days' written notice for a week-to-week tenancy and, after the first year, 90 days' written notice, no more than one increase in 12 months, and no increase above the maximum calculated under ORS 90.324 unless an exemption applies. The Department of Administrative Services published 9.5% for an increase taking effect in calendar year 2026. That figure is not used for any other year. The 2026 regular-session amendment table does not list 90.323. ORS 90.323(7) excludes tenancies under ORS 90.505 to 90.850. Checked ${CHECKED}.`,
    summaryEs: `ORS 90.323 exige 7 días de aviso en un arrendamiento semanal y, después del primer año, 90 días, no más de un aumento en 12 meses, y no más del máximo de ORS 90.324 salvo una exención. El Departamento de Servicios Administrativos publicó 9.5% para 2026. Revisado el ${CHECKED_ES}.`,
    citation: "Or. Rev. Stat. § 90.323",
    sourceName: "Oregon Department of Administrative Services",
    sourceUrl: "https://apps.oregon.gov/oregon-newsroom/OR/DAS/Posts/Post/2026-Rent-Stabilization-Percentages",
  }),
  stateRule({
    id: "WA-RCW-59.18.280",
    jurisdiction: "WA",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "Washington deposit statement",
    titleEs: "Estado de cuenta del depósito en Washington",
    summaryEn: `RCW 59.18.280(1)(a) requires a full and specific statement of the basis for keeping any deposit, required documentation, and any refund within 30 days after termination and vacation, or within 30 days after the landlord learns of abandonment. Checked ${CHECKED} on the Legislature's RCW page.`,
    summaryEs: `RCW 59.18.280(1)(a) exige un estado de cuenta específico, la documentación requerida y cualquier reembolso dentro de 30 días después de la terminación y la desocupación, o dentro de 30 días después de que el propietario se entera del abandono. Revisado el ${CHECKED_ES}.`,
    citation: "Wash. Rev. Code § 59.18.280",
    sourceName: "Washington State Legislature",
    sourceUrl: "https://app.leg.wa.gov/RCW/default.aspx?cite=59.18.280",
  }),
  stateRule({
    id: "WA-RCW-59.18.070",
    jurisdiction: "WA",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "Washington repair response times",
    titleEs: "Plazos de reparación en Washington",
    summaryEn: `RCW 59.18.070 says the landlord shall commence remedial action after receipt of the tenant's written notice as soon as possible but not later than 24 hours where the tenant lacks hot or cold water, heat, or electricity, or the condition is imminently hazardous to life; 72 hours for a refrigerator, range and oven, or major plumbing fixture supplied by the landlord; and 10 days in other cases. Delay beyond the landlord's control is addressed in the section. Checked ${CHECKED}.`,
    summaryEs: `RCW 59.18.070 dice que el propietario debe empezar la reparación después de recibir el aviso escrito lo antes posible, y no más tarde de 24 horas si falta agua, calefacción o electricidad o el peligro para la vida es inminente; 72 horas para un refrigerador, estufa y horno, o plomería importante; y 10 días en los demás casos. Revisado el ${CHECKED_ES}.`,
    citation: "Wash. Rev. Code § 59.18.070",
    sourceName: "Washington State Legislature",
    sourceUrl: "https://app.leg.wa.gov/RCW/default.aspx?cite=59.18.070",
  }),
  stateRule({
    id: "WA-RCW-59.18.250",
    jurisdiction: "WA",
    topic: "retaliation",
    topics: ["retaliation", "represalia"],
    titleEn: "Washington retaliation presumption",
    titleEs: "Presunción de represalia en Washington",
    summaryEn: `RCW 59.18.240 lists prohibited reprisals, including a rent increase, after a good-faith complaint or an assertion of rights under the chapter. RCW 59.18.250 says a listed action within 90 days after that act creates a rebuttable presumption. It is not proof. Unpaid rent and a stated ground for a rent increase can affect the presumption. Checked ${CHECKED}.`,
    summaryEs: `RCW 59.18.240 enumera represalias prohibidas, incluido un aumento de renta. RCW 59.18.250 dice que un acto enumerado dentro de 90 días crea una presunción refutable. No es una prueba. Revisado el ${CHECKED_ES}.`,
    citation: "Wash. Rev. Code §§ 59.18.240, 59.18.250",
    sourceName: "Washington State Legislature",
    sourceUrl: "https://app.leg.wa.gov/RCW/default.aspx?cite=59.18.250",
  }),
  stateRule({
    id: "WA-RCW-59.18.700",
    jurisdiction: "WA",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta", "rent cap", "percent"],
    titleEn: "Washington rent increase limit",
    titleEs: "Límite de aumento en Washington",
    summaryEn: `RCW 59.18.700, effective May 7, 2025, and expiring July 1, 2040, bars a rent increase during the first 12 months and, after that, an increase in any 12-month period greater than 7% plus CPI or 10%, whichever is less, unless an exemption in RCW 59.18.710 applies. Commerce published 9.683% for calendar year 2026 and 10% for 2027. RCW 59.18.140 generally requires 90 days' written notice, or 30 days for some income-based subsidized tenancies. Checked ${CHECKED}.`,
    summaryEs: `RCW 59.18.700 prohíbe un aumento durante los primeros 12 meses y, después, un aumento en cualquier período de 12 meses mayor que 7% más el IPC o 10%, lo que sea menor, salvo una exención de RCW 59.18.710. Commerce publicó 9.683% para 2026 y 10% para 2027. RCW 59.18.140 en general exige 90 días de aviso escrito. Revisado el ${CHECKED_ES}.`,
    citation: "Wash. Rev. Code § 59.18.700",
    sourceName: "Washington State Department of Commerce",
    sourceUrl: "https://www.commerce.wa.gov/housing-policy/hb1217-landlord-resource-center/",
  }),
];

export function stateRepairLetter(state: AddedState, locale: "en" | "es", severity: RepairSeverity): string {
  const added = batch1bRepairLetter(state, locale);
  if (added) return added;
  if (state === "TX" || state === "FL") return batchRepairLetter(state, locale);
  if (state !== "AZ" && state !== "NV" && state !== "OR" && state !== "WA") {
    throw new Error("repair letter was not routed");
  }
  const clock = repairClock(state, severity);
  const period = clock.hours != null ? `${clock.hours} hours after you receive this notice` : `${clock.days} calendar days after you receive this notice`;
  const periodEs = clock.hours != null ? `${clock.hours} horas después de recibir este aviso` : `${clock.days} días calendario después de recibir este aviso`;
  const citation = {
    AZ: "Arizona Revised Statutes § 33-1361",
    NV: "Nevada Revised Statutes 118A.355",
    OR: clock.hours === 48 ? "Oregon Revised Statutes 90.365" : "Oregon Revised Statutes 90.360",
    WA: "Revised Code of Washington 59.18.070",
  }[state];
  if (locale === "es") {
    return `Le pido que atienda esta reparación. ${citation} describe un plazo de respuesta de ${periodEs} después de que se recibe un aviso escrito, para el tipo de condición de arriba. Esta carta no es un aviso de que termino el arrendamiento ni de que retengo la renta. Confirmo este mensaje antes de enviarlo.`;
  }
  return `I am asking you to address this repair. ${citation} describes a response period of ${period} after written notice is received, for the kind of condition described above. This letter is not a notice that I am ending the tenancy or withholding rent. I confirm this message before it is sent.`;
}
