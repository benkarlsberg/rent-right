import { addDays, addMonths } from "@/lib/rules/dates";
import { rule, type Rule } from "@/lib/rules/define";

const CHECKED = "Nov 14, 2026";
const CHECKED_ES = "14 de noviembre de 2026";
export const BATCH8_STATES = ["CO", "GA", "NM", "MS"] as const;
export type Batch8State = (typeof BATCH8_STATES)[number];

type Stamp = {
  dueDate: string | null;
  ruleId: string;
  citation: string;
  explanation: string;
  explanationEs: string;
  computation: string;
  unsure: boolean;
};

export function isBatch8(state: string): state is Batch8State {
  return (BATCH8_STATES as readonly string[]).includes(state);
}

function percent(lowestCents: number, proposedCents: number): string {
  const value = Math.round(((proposedCents - lowestCents) * 1_000_000) / lowestCents);
  return (value / 10_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function info(input: {
  id: string; jurisdiction: Batch8State; topic: string; topics: string[];
  titleEn: string; titleEs: string; summaryEn: string; summaryEs: string;
  citation: string; sourceName: string; sourceUrl: string;
}): Rule {
  return rule({
    ...input, findingLabel: "informational", confidence: "high", patterns: [],
    reasonEn: `Loaded for ${input.jurisdiction} only. Checked ${CHECKED}. Not a finding about a particular home.`,
    reasonEs: `Cargado solo para ${input.jurisdiction}. Revisado el ${CHECKED_ES}. No es una conclusión sobre una vivienda.`,
  });
}

const NOT = "This is not permission to withhold rent, repair and deduct, or end the tenancy.";
const NOT_ES = "No es permiso para retener la renta, reparar y descontar, ni terminar el arrendamiento.";

export function batch8Deposit(state: string, triggerDate: string): Stamp | null {
  if (!isBatch8(state)) return null;
  if (state === "CO") {
    const thirty = addDays(triggerDate, 30);
    const sixty = addDays(triggerDate, 60);
    return {
      dueDate: null, ruleId: "CO-38-12-103", citation: "Colo. Rev. Stat. § 38-12-103", unsure: true,
      computation: `Thirty days after ${triggerDate} is ${thirty}. A lease may set a longer period, not past 60 days (${sixty}). The statute uses the later of termination and surrender.`,
      explanation: `Section 38-12-103, current through the 2026 session, returns the deposit within 30 days after the later of termination and surrender, unless the lease sets a longer period of not more than 60 days. The lease period was not entered, so no single date was stored. Normal wear and tear and preexisting damage may not be retained. The opened sections do not state a maximum number of months. Mobile-home park carpet and paint rules in subsection (11) were not applied. Checked ${CHECKED}.`,
      explanationEs: `La sección 38-12-103 da 30 días, o hasta 60 si el contrato lo dice. No se guardó una sola fecha. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "GA") {
    const due = addDays(triggerDate, 30);
    return {
      dueDate: due, ruleId: "GA-44-7-34", citation: "Ga. Code Ann. § 44-7-34", unsure: true,
      computation: `${triggerDate} + 30 days = ${due}. The clock runs from obtaining possession as described in § 44-7-33.`,
      explanation: `Section 44-7-34 returns the deposit within 30 days after the landlord obtains possession as provided in section 44-7-33. Using ${triggerDate}, the date is ${due}. It is unsure because the possession date was not entered separately. Ordinary wear and tear may not be retained. Sections 44-7-31, 44-7-32, 44-7-33, and 44-7-35 do not apply when a natural person, spouse, and minor children own ten or fewer units and a third party does not manage them for a fee. That ownership was not entered. The opened article does not state a maximum number of months. Checked ${CHECKED}.`,
      explanationEs: `La sección 44-7-34 da 30 días después de obtener la posesión. La fecha es incierta. Algunos propietarios pequeños quedan fuera de otras secciones. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "NM") {
    const due = addDays(triggerDate, 30);
    return {
      dueDate: due, ruleId: "NM-47-8-18", citation: "N.M. Stat. Ann. § 47-8-18", unsure: true,
      computation: `${triggerDate} + 30 days = ${due}. The statute uses the later of termination and departure.`,
      explanation: `Section 47-8-18 returns an itemized list and the balance within 30 days after the later of termination and the resident's departure. Using ${triggerDate} as that later date, the date is ${due}. It is unsure because the two dates were not entered separately. A tenancy shorter than one year may not require a deposit above one month's rent. An annual agreement that takes more than one month's rent must pay annual interest. The term length was not entered, so no cap or interest was applied. Normal wear and tear may not be retained. Checked ${CHECKED}.`,
      explanationEs: `La sección 47-8-18 da 30 días después de la fecha más tardía. El tope depende del plazo y no se aplicó. Revisado el ${CHECKED_ES}.`,
    };
  }
  const due = addDays(triggerDate, 45);
  return {
    dueDate: due, ruleId: "MS-89-8-21", citation: "Miss. Code Ann. § 89-8-21", unsure: true,
    computation: `${triggerDate} + 45 days = ${due}. The clock also waits for delivery of possession and a demand.`,
    explanation: `Section 89-8-21 returns any remainder no later than 45 days after termination, delivery of possession, and demand by the tenant. Using ${triggerDate}, the date is ${due}. It is unsure because possession and the demand were not entered separately. Ordinary wear and tear is excluded. The opened section does not state a maximum number of months. Checked ${CHECKED}.`,
    explanationEs: `La sección 89-8-21 da 45 días después de la terminación, la entrega y el requerimiento. La fecha es incierta. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch8Repair(state: string, requestDate: string): Stamp | null {
  if (!isBatch8(state)) return null;
  const base = { dueDate: null as string | null, unsure: true, computation: `Notice ${requestDate}. No single repair date was stored.` };
  if (state === "CO") return { ...base, ruleId: "CO-38-12-503", citation: "Colo. Rev. Stat. § 38-12-503", explanation: `Section 38-12-503 warrants that a home is fit for human habitation. After notice, the landlord must start work within 24 hours when a condition materially interferes with life, health, or safety, or within 72 hours when the premises are uninhabitable, and must finish within a reasonable time. A presumption can arise after 7 or 14 calendar days. The condition class was not entered, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `Los plazos de 24 y 72 horas no se guardaron porque no se indicó el tipo de condición. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  if (state === "GA") return { ...base, ruleId: "GA-44-7-13", citation: "Ga. Code Ann. § 44-7-13", explanation: `Section 44-7-13 requires the landlord to keep the premises in repair. A dwelling lease entered into or renewed on or after July 1, 2024, is deemed to include a promise that the premises are fit for human habitation. The lease date was not entered. The section states no repair day count, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 44-7-13 no fija un plazo. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  if (state === "NM") return { ...base, ruleId: "NM-47-8-20", citation: "N.M. Stat. Ann. § 47-8-20", explanation: `Section 47-8-20 requires the owner to keep the premises safe and to maintain supplied facilities, heat, and hot water. It states no repair day count, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 47-8-20 no fija días. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  return { ...base, ruleId: "MS-89-8-23", citation: "Miss. Code Ann. § 89-8-23", explanation: `Section 89-8-23 requires the landlord to comply with health and safety codes and to maintain plumbing and heating or cooling in substantially the same condition as at the start of the lease, ordinary wear and tear excepted. It states no day count, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 89-8-23 no fija días. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
}

export function batch8Retaliation(state: string, activityDate: string, noticeDate: string, daysSince: number): (Stamp & { flagged: boolean; daysSince: number }) | null {
  if (!isBatch8(state)) return null;
  if (state === "GA") {
    const end = addMonths(activityDate, 3);
    const flagged = daysSince >= 0 && noticeDate <= end;
    return {
      flagged, daysSince, dueDate: null, ruleId: "GA-44-7-24", citation: "Ga. Code Ann. § 44-7-24", unsure: false,
      computation: `${activityDate} plus three months = ${end}.`,
      explanation: flagged
        ? `The later date is inside three months (${end}). Section 44-7-24 lets a tenant make a prima-facie retaliation case when a listed landlord act follows a listed tenant act in that period. It is not a finding. Exceptions, including a building-wide pattern of increases, were not decided. Checked ${CHECKED}.`
        : `The later date is outside three months (${end}). Being outside that period is not a finding that the act was lawful. Checked ${CHECKED}.`,
      explanationEs: flagged ? `La fecha posterior está dentro de tres meses (${end}). No es una conclusión. Revisado el ${CHECKED_ES}.` : `La fecha posterior está fuera de tres meses (${end}). Estar fuera no significa que el acto sea lícito. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "NM") {
    const end = addMonths(activityDate, 6);
    const flagged = daysSince >= 0 && noticeDate <= end;
    return {
      flagged, daysSince, dueDate: null, ruleId: "NM-47-8-39", citation: "N.M. Stat. Ann. § 47-8-39", unsure: false,
      computation: `${activityDate} plus six months = ${end}.`,
      explanation: flagged
        ? `The later date is inside six months (${end}). Section 47-8-39 bars a rent increase, a service cut, or a possession action because of a listed act in the previous six months, when the resident is in compliance. It is not a finding. A uniform change that matches other similar units was not decided. Checked ${CHECKED}.`
        : `The later date is outside six months (${end}). Being outside that period is not a finding that the act was lawful. Checked ${CHECKED}.`,
      explanationEs: flagged ? `La fecha posterior está dentro de seis meses (${end}). No es una conclusión. Revisado el ${CHECKED_ES}.` : `La fecha posterior está fuera de seis meses (${end}). Estar fuera no significa que el acto sea lícito. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "CO") {
    return {
      flagged: false, daysSince, dueDate: null, ruleId: "CO-38-12-509", citation: "Colo. Rev. Stat. § 38-12-509", unsure: true,
      computation: "No day count. Section 38-12-509 does not state a number of days.",
      explanation: `Section 38-12-509 says a landlord shall not retaliate, including by raising rent, cutting services, ending or not renewing an agreement, or threatening possession, because of a good-faith habitability complaint, tenant organizing, or use of a habitability remedy. It states no number of days, so no date was flagged. It is not a finding. Checked ${CHECKED}.`,
      explanationEs: `La sección 38-12-509 no fija días, así que no se marcó una fecha. No es una conclusión. Revisado el ${CHECKED_ES}.`,
    };
  }
  return {
    flagged: false, daysSince, dueDate: null, ruleId: "MS-89-8-17", citation: "Miss. Code Ann. § 89-8-17", unsure: true,
    computation: "No day count. Section 89-8-17 does not state a number of days.",
    explanation: `Section 89-8-17 says a landlord may demand a rent increase after the agreement expires if the dominant purpose was not retaliation for the tenant's actions under the chapter and the landlord received written notice of each condition. It states no number of days, so no date was flagged. The opened sections do not state a broader retaliation period. It is not a finding. Checked ${CHECKED}.`,
    explanationEs: `La sección 89-8-17 no fija días. No se marcó una fecha. No es una conclusión. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch8Rent(state: string, lowestCents: number, proposedCents: number) {
  if (!isBatch8(state)) return null;
  const amount = percent(lowestCents, proposedCents);
  const base = { abovePublishedMax: false as const };
  const entered = `The increase from the amounts entered is about ${amount}%.`;
  if (state === "CO") return { ...base, headlineEn: "Colorado rent increase", headlineEs: "Aumento de renta en Colorado", ruleId: "CO-38-12-701", detailEn: `${entered} Section 38-12-701 says that, when a residential tenancy has no written agreement, the landlord may increase the rent only upon at least 60 days' written notice. Whether a written agreement exists was not entered, so the notice was not graded. The section states no percentage cap. No city ordinance was applied. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. El aviso de 60 días aplica si no hay contrato escrito. No se calificó. Revisado el ${CHECKED_ES}.` };
  if (state === "GA") return { ...base, headlineEn: "Georgia rent increase", headlineEs: "Aumento de renta en Georgia", ruleId: "GA-44-7-7", detailEn: `${entered} The sections opened on ${CHECKED} do not state a percentage cap or a rent-increase notice. Section 44-7-7 requires 60 days' notice from the landlord, or 30 days from the tenant, to end a tenancy at will. That notice ends the tenancy and was not graded as a rent increase. No city ordinance was applied. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. La sección 44-7-7 termina una tenencia a voluntad y no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.` };
  if (state === "NM") return { ...base, headlineEn: "New Mexico rent increase", headlineEs: "Aumento de renta en Nuevo México", ruleId: "NM-47-8-15", detailEn: `${entered} Section 47-8-15 requires written notice at least 30 days before the periodic rental date for a month-to-month residency, at least 30 days before the end of a fixed term, or one rental period ahead when the residency is shorter than a month. The term was not entered, so no notice period was graded. The section states no percentage cap. A late fee may not exceed 5 percent of the rent and was not used as a rent cap. No city ordinance was applied. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. El aviso depende del plazo y no se calificó. Revisado el ${CHECKED_ES}.` };
  return { ...base, headlineEn: "Mississippi rent increase", headlineEs: "Aumento de renta en Misisipi", ruleId: "MS-89-8-19", detailEn: `${entered} The sections opened on ${CHECKED} do not state a percentage cap or a rent-increase notice period. Section 89-8-19 requires at least 30 days' written notice to end a month-to-month tenancy and at least 7 days for a week-to-week tenancy. Those notices end the tenancy and were not graded as a rent increase. Section 89-8-17 allows a rent demand after the agreement expires only if retaliation was not the dominant purpose. That purpose was not decided. No city ordinance was applied. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. La sección 89-8-19 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.` };
}

export function batch8RepairLetter(state: string, locale: "en" | "es"): string | null {
  if (!isBatch8(state)) return null;
  const en: Record<Batch8State, string> = {
    CO: "I am asking you to address this repair. Colorado Revised Statutes § 38-12-503 does not give me permission to withhold rent. This letter is not a notice that I am ending the tenancy. I confirm this message before it is sent.",
    GA: "I am asking you to address this repair. Georgia Code § 44-7-13 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
    NM: "I am asking you to address this repair. New Mexico Statutes § 47-8-20 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
    MS: "I am asking you to address this repair. Mississippi Code § 89-8-23 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
  };
  const es: Record<Batch8State, string> = {
    CO: "Le pido que atienda esta reparación. Esta carta no es permiso para retener la renta ni un aviso de que termino el arrendamiento. Confirmo este mensaje antes de enviarlo.",
    GA: "Le pido que atienda esta reparación. El código de Georgia no fija un número de días. Esta carta no avisa que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    NM: "Le pido que atienda esta reparación. El estatuto de Nuevo México no fija un número de días. Esta carta no avisa que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    MS: "Le pido que atienda esta reparación. El código de Misisipi no fija un número de días. Esta carta no avisa que retengo la renta. Confirmo este mensaje antes de enviarlo.",
  };
  return locale === "es" ? es[state] : en[state];
}

const depositTopics = ["security deposit", "deposito", "depósito"];
const repairTopics = ["repair", "habitability", "reparacion", "reparación"];
const retalTopics = ["retaliation", "represalia"];
const rentTopics = ["rent increase", "aumento de renta"];

export const BATCH8_RULES: Rule[] = [
  info({ id: "CO-38-12-103", jurisdiction: "CO", topic: "deposit", topics: depositTopics, titleEn: "Colorado security deposit", titleEs: "Depósito en Colorado", summaryEn: `Section 38-12-103 returns a deposit within 30 days after the later of termination and surrender, or a longer lease period of not more than 60 days. Normal wear and preexisting damage may not be retained. No month cap was stated. Checked ${CHECKED}.`, summaryEs: `La sección 38-12-103 da 30 días, o hasta 60 si el contrato lo dice. Revisado el ${CHECKED_ES}.`, citation: "Colo. Rev. Stat. § 38-12-103", sourceName: "Colorado General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/colorado/" }),
  info({ id: "CO-38-12-503", jurisdiction: "CO", topic: "repair", topics: repairTopics, titleEn: "Colorado warranty of habitability", titleEs: "Garantía de habitabilidad en Colorado", summaryEn: `Section 38-12-503 requires the landlord to start repairs within 24 or 72 hours after notice, depending on the condition, and to finish within a reasonable time. Those periods were not stored and are not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `Los plazos de 24 y 72 horas no se guardaron y no son permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Colo. Rev. Stat. § 38-12-503", sourceName: "Colorado General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/colorado/" }),
  info({ id: "CO-38-12-509", jurisdiction: "CO", topic: "retaliation", topics: retalTopics, titleEn: "Colorado retaliation", titleEs: "Represalia en Colorado", summaryEn: `Section 38-12-509 prohibits retaliation for a habitability complaint, tenant organizing, or use of a habitability remedy. It states no number of days and is not a finding. Checked ${CHECKED}.`, summaryEs: `La sección 38-12-509 no fija días. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "Colo. Rev. Stat. § 38-12-509", sourceName: "Colorado General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/colorado/" }),
  info({ id: "CO-38-12-701", jurisdiction: "CO", topic: "rent-increase", topics: rentTopics, titleEn: "Colorado rent-increase notice", titleEs: "Aviso de aumento en Colorado", summaryEn: `Section 38-12-701 requires 60 days' written notice to increase rent when a residential tenancy has no written agreement. It states no percentage cap. Whether a written agreement exists was not graded. Checked ${CHECKED}.`, summaryEs: `La sección 38-12-701 exige 60 días si no hay contrato escrito. No hay un tope. Revisado el ${CHECKED_ES}.`, citation: "Colo. Rev. Stat. § 38-12-701", sourceName: "Colorado General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/colorado/" }),
  info({ id: "GA-44-7-34", jurisdiction: "GA", topic: "deposit", topics: depositTopics, titleEn: "Georgia security deposit", titleEs: "Depósito en Georgia", summaryEn: `Section 44-7-34 returns a deposit within 30 days after the landlord obtains possession. Ordinary wear and tear may not be retained. Some owners of ten or fewer units are exempt from related list and escrow rules. No month cap was stated. Checked ${CHECKED}.`, summaryEs: `La sección 44-7-34 da 30 días después de obtener la posesión. Revisado el ${CHECKED_ES}.`, citation: "Ga. Code Ann. § 44-7-34", sourceName: "Georgia General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/gacode/" }),
  info({ id: "GA-44-7-13", jurisdiction: "GA", topic: "repair", topics: repairTopics, titleEn: "Georgia landlord repairs", titleEs: "Reparaciones en Georgia", summaryEn: `Section 44-7-13 requires the landlord to keep the premises in repair. A dwelling lease entered or renewed on or after July 1, 2024, includes fitness for human habitation. It states no day count and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 44-7-13 no fija días y no es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Ga. Code Ann. § 44-7-13", sourceName: "Georgia General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/gacode/" }),
  info({ id: "GA-44-7-24", jurisdiction: "GA", topic: "retaliation", topics: retalTopics, titleEn: "Georgia retaliation", titleEs: "Represalia en Georgia", summaryEn: `Section 44-7-24 lets a tenant make a prima-facie retaliation case when a listed landlord act follows within three months of a listed tenant act. It is not a finding. Checked ${CHECKED}.`, summaryEs: `La sección 44-7-24 cubre tres meses. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "Ga. Code Ann. § 44-7-24", sourceName: "Georgia General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/gacode/" }),
  info({ id: "GA-44-7-7", jurisdiction: "GA", topic: "rent-increase", topics: rentTopics, titleEn: "Georgia rent change", titleEs: "Cambio de renta en Georgia", summaryEn: `The sections opened do not state a percentage cap or a rent-increase notice. Section 44-7-7's 60-day and 30-day notices end a tenancy at will and were not graded as a rent increase. Checked ${CHECKED}.`, summaryEs: `No hay un tope en las secciones abiertas. La sección 44-7-7 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`, citation: "Ga. Code Ann. § 44-7-7", sourceName: "Georgia General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/gacode/" }),
  info({ id: "NM-47-8-18", jurisdiction: "NM", topic: "deposit", topics: depositTopics, titleEn: "New Mexico deposit", titleEs: "Depósito en Nuevo México", summaryEn: `Section 47-8-18 returns an itemized list and the balance within 30 days after the later of termination and departure. A shorter tenancy may not require more than one month's rent. The term was not applied as a cap. Checked ${CHECKED}.`, summaryEs: `La sección 47-8-18 da 30 días. El tope depende del plazo y no se aplicó. Revisado el ${CHECKED_ES}.`, citation: "N.M. Stat. Ann. § 47-8-18", sourceName: "New Mexico Compilation Commission", sourceUrl: "https://nmonesource.com/nmos/nmsa/en/item/4408/index.do" }),
  info({ id: "NM-47-8-20", jurisdiction: "NM", topic: "repair", topics: repairTopics, titleEn: "New Mexico owner obligations", titleEs: "Obligaciones del propietario en Nuevo México", summaryEn: `Section 47-8-20 requires a safe premises and maintenance of supplied facilities, heat, and hot water. It states no day count and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 47-8-20 no fija días y no es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "N.M. Stat. Ann. § 47-8-20", sourceName: "New Mexico Compilation Commission", sourceUrl: "https://nmonesource.com/" }),
  info({ id: "NM-47-8-39", jurisdiction: "NM", topic: "retaliation", topics: retalTopics, titleEn: "New Mexico retaliation", titleEs: "Represalia en Nuevo México", summaryEn: `Section 47-8-39 bars a retaliatory rent increase, service cut, or possession action within six months after a listed act by a resident who is in compliance. It is not a finding. Checked ${CHECKED}.`, summaryEs: `La sección 47-8-39 cubre seis meses. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "N.M. Stat. Ann. § 47-8-39", sourceName: "New Mexico Compilation Commission", sourceUrl: "https://nmonesource.com/" }),
  info({ id: "NM-47-8-15", jurisdiction: "NM", topic: "rent-increase", topics: rentTopics, titleEn: "New Mexico rent-increase notice", titleEs: "Aviso de aumento en Nuevo México", summaryEn: `Section 47-8-15 requires 30 days' written notice for a month-to-month or fixed-term increase, or one rental period when the residency is shorter. The term was not graded. There is no percentage cap. Checked ${CHECKED}.`, summaryEs: `La sección 47-8-15 exige 30 días o un período de renta. No se calificó. Revisado el ${CHECKED_ES}.`, citation: "N.M. Stat. Ann. § 47-8-15", sourceName: "New Mexico Compilation Commission", sourceUrl: "https://nmonesource.com/" }),
  info({ id: "MS-89-8-21", jurisdiction: "MS", topic: "deposit", topics: depositTopics, titleEn: "Mississippi security deposit", titleEs: "Depósito en Misisipi", summaryEn: `Section 89-8-21 returns the remainder within 45 days after termination, delivery of possession, and demand. Ordinary wear and tear is excluded. No month cap was stated. Checked ${CHECKED}.`, summaryEs: `La sección 89-8-21 da 45 días después del requerimiento. Revisado el ${CHECKED_ES}.`, citation: "Miss. Code Ann. § 89-8-21", sourceName: "Mississippi Legislature", sourceUrl: "https://www.lexisnexis.com/hottopics/mscode/" }),
  info({ id: "MS-89-8-23", jurisdiction: "MS", topic: "repair", topics: repairTopics, titleEn: "Mississippi landlord duties", titleEs: "Deberes del propietario en Misisipi", summaryEn: `Section 89-8-23 requires code compliance and maintenance of plumbing and heating or cooling. It states no day count and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 89-8-23 no fija días y no es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Miss. Code Ann. § 89-8-23", sourceName: "Mississippi Legislature", sourceUrl: "https://www.lexisnexis.com/hottopics/mscode/" }),
  info({ id: "MS-89-8-17", jurisdiction: "MS", topic: "retaliation", topics: retalTopics, titleEn: "Mississippi post-term rent demand", titleEs: "Aumento después del contrato en Misisipi", summaryEn: `Section 89-8-17 allows a rent demand after the agreement expires only if retaliation was not the dominant purpose and the landlord had written notice of each condition. It states no number of days. Checked ${CHECKED}.`, summaryEs: `La sección 89-8-17 no fija días. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "Miss. Code Ann. § 89-8-17", sourceName: "Mississippi Legislature", sourceUrl: "https://www.lexisnexis.com/hottopics/mscode/" }),
  info({ id: "MS-89-8-19", jurisdiction: "MS", topic: "rent-increase", topics: rentTopics, titleEn: "Mississippi rent change", titleEs: "Cambio de renta en Misisipi", summaryEn: `The sections opened do not state a percentage cap or a rent-increase notice. Section 89-8-19's 30-day and 7-day notices end a periodic tenancy and were not graded as a rent increase. Checked ${CHECKED}.`, summaryEs: `No hay un tope en las secciones abiertas. La sección 89-8-19 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`, citation: "Miss. Code Ann. § 89-8-19", sourceName: "Mississippi Legislature", sourceUrl: "https://www.lexisnexis.com/hottopics/mscode/" }),
];
