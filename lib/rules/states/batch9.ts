import { addDays, addMonths } from "@/lib/rules/dates";
import { rule, type Rule } from "@/lib/rules/define";
import type { LawChoice } from "@/lib/rules/special";

const CHECKED = "Nov 14, 2026";
const CHECKED_ES = "14 de noviembre de 2026";
export const BATCH9_STATES = ["LA", "AR", "NJ", "TN", "KY"] as const;
export type Batch9State = (typeof BATCH9_STATES)[number];

type Stamp = {
  dueDate: string | null;
  ruleId: string;
  citation: string;
  explanation: string;
  explanationEs: string;
  computation: string;
  unsure: boolean;
};

export function isBatch9(state: string): state is Batch9State {
  return (BATCH9_STATES as readonly string[]).includes(state);
}

function percent(lowestCents: number, proposedCents: number): string {
  const value = Math.round(((proposedCents - lowestCents) * 1_000_000) / lowestCents);
  return (value / 10_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function info(input: {
  id: string; jurisdiction: Batch9State; topic: string; topics: string[];
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

function held(state: "TN" | "KY", choice: LawChoice): Stamp | null {
  if (choice === "yes") return null;
  if (state === "TN") {
    return {
      dueDate: null, ruleId: "TN-66-28-102", citation: "Tenn. Code Ann. § 66-28-102", unsure: true,
      computation: "URLTA was not applied.",
      explanation: `The Uniform Residential Landlord and Tenant Act applies only in a county with a population of more than 75,000 according to the 2010 federal census. ${choice === "no" ? "You said that test is not met for your county, so the Act was not applied." : "Whether your county meets that test was not confirmed, so the Act was not applied."} Checked ${CHECKED}.`,
      explanationEs: `La ley uniforme aplica solo en un condado de más de 75,000 habitantes según el censo de 2010. No se aplicó. Revisado el ${CHECKED_ES}.`,
    };
  }
  return {
    dueDate: null, ruleId: "KY-383.500", citation: "Ky. Rev. Stat. Ann. § 383.500", unsure: true,
    computation: "URLTA was not applied.",
    explanation: `The Uniform Residential Landlord and Tenant Act applies only where a city, county, or urban-county government has adopted it. ${choice === "no" ? "You said your locality has not adopted it, so the Act was not applied." : "It may apply if your city or county adopted it. That was not confirmed, so the Act was not applied."} Checked ${CHECKED}.`,
    explanationEs: `La ley uniforme puede aplicar si su ciudad o condado la adoptó. No se aplicó. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch9Deposit(state: string, triggerDate: string, choice: LawChoice = "unsure"): Stamp | null {
  if (!isBatch9(state)) return null;
  if (state === "TN" || state === "KY") {
    const gate = held(state, choice);
    if (gate) return gate;
  }
  if (state === "LA") {
    const due = addMonths(triggerDate, 1);
    return {
      dueDate: due, ruleId: "LA-9-3251", citation: "La. Rev. Stat. Ann. § 9:3251", unsure: true,
      computation: `${triggerDate} plus one month = ${due}. A retained portion may be itemized up to 15 days after that month.`,
      explanation: `Section 9:3251 returns a residential deposit within one month after the lease terminates. Using ${triggerDate}, that date is ${due}. It is unsure because a retained portion may instead be itemized within one month or within 15 days after the date that is one month after termination, and the tenant must give a forwarding address. The opened section does not state a maximum number of months. Checked ${CHECKED}.`,
      explanationEs: `La sección 9:3251 da un mes. La fecha es incierta si se retiene una parte. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "AR") {
    const due = addDays(triggerDate, 60);
    return {
      dueDate: due, ruleId: "AR-18-16-305", citation: "Ark. Code Ann. § 18-16-305", unsure: true,
      computation: `${triggerDate} + 60 days = ${due}. The itemized notice also requires delivery of possession.`,
      explanation: `Section 18-16-304 limits a security deposit to two months' periodic rent. Section 18-16-305 returns the remainder, with a written itemization, within 60 days after termination and delivery of possession. Using ${triggerDate}, the date is ${due}. It is unsure because delivery of possession was not entered separately. Section 18-17-501 points deposit rights to that subchapter. Checked ${CHECKED}.`,
      explanationEs: `El depósito se limita a dos meses y el saldo se devuelve a los 60 días. La fecha es incierta. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "NJ") {
    const due = addDays(triggerDate, 30);
    return {
      dueDate: due, ruleId: "NJ-46-8-21.1", citation: "N.J. Stat. Ann. § 46:8-21.1", unsure: false,
      computation: `${triggerDate} + 30 days = ${due}.`,
      explanation: `Section 46:8-21.1 returns the deposit, plus the tenant's portion of interest or earnings, less itemized charges, within 30 days after the lease terminates. Using ${triggerDate}, the date is ${due}. The opened sections do not state a maximum number of months. Interest was not calculated. Municipal rent control was not applied. Checked ${CHECKED}.`,
      explanationEs: `La sección 46:8-21.1 da 30 días después de la terminación. El interés no se calculó. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "TN") {
    return {
      dueDate: null, ruleId: "TN-66-28-301", citation: "Tenn. Code Ann. § 66-28-301", unsure: true,
      computation: `Move-out ${triggerDate}. A refund notice starts a 60-day response period that was not entered.`,
      explanation: `You said the Uniform Residential Landlord and Tenant Act applies. Section 66-28-301 requires a damage listing and, when a refund is due and no rent is owed, a notice of the refund. If the tenant does not respond within 60 days after that notice, the landlord may keep the refund. The notice date was not entered, so no single date was stored from ${triggerDate}. Physical-damage costs discovered after the inspection may be recovered only if found before the earlier of 30 days after the tenant left or 7 days after a new tenant takes possession. The opened section does not state a maximum number of months. Checked ${CHECKED}.`,
      explanationEs: `Usted indicó que la ley uniforme aplica. No se guardó una sola fecha porque falta la fecha del aviso de reembolso. Revisado el ${CHECKED_ES}.`,
    };
  }
  return {
    dueDate: null, ruleId: "KY-383.580", citation: "Ky. Rev. Stat. Ann. § 383.580", unsure: true,
    computation: `Move-out ${triggerDate}. A refund notice starts a 60-day response period that was not entered.`,
    explanation: `You said your locality adopted the Uniform Residential Landlord and Tenant Act. Section 383.580 requires a separate deposit account and damage lists. If the tenant leaves without owing rent and a refund is due, the landlord sends notice of the refund. If the tenant does not respond within 60 days after that notice, the landlord may keep it. The notice date was not entered, so no single date was stored from ${triggerDate}. The opened section does not state a maximum number of months. Checked ${CHECKED}.`,
    explanationEs: `Usted indicó que su localidad adoptó la ley uniforme. No se guardó una sola fecha. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch9Repair(state: string, requestDate: string, choice: LawChoice = "unsure"): Stamp | null {
  if (!isBatch9(state)) return null;
  if ((state === "TN" || state === "KY") && choice !== "yes") return held(state, choice);
  const base = { dueDate: null as string | null, unsure: true, computation: `Notice ${requestDate}. No single repair date was stored.` };
  if (state === "LA") return { ...base, ruleId: "LA-CC-2691", citation: "La. Civ. Code art. 2691", explanation: `Article 2691 requires the lessor, during the lease, to make the repairs necessary to keep the thing suitable for the purpose for which it was leased, except repairs that are the lessee's. It states no day count, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `El artículo 2691 no fija días. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  if (state === "AR") return { ...base, ruleId: "AR-18-17-502", citation: "Ark. Code Ann. § 18-17-502", explanation: `Section 18-17-502 implies, for a residential agreement entered or renewed after November 1, 2021, hot and cold running water, electricity, potable water, a sanitary sewer, a functioning roof and envelope, and a functioning heating and air system to the extent one served the premises when the agreement was made. It states no day count. Section 18-17-702 is a landlord remedy for the tenant's own health or safety breach and was not stored as a repair deadline from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 18-17-502 no fija días. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  if (state === "NJ") return { ...base, ruleId: "NJ-2A-42-88", citation: "N.J. Stat. Ann. § 2A:42-88", explanation: `Section 2A:42-88 lets a tenant maintain a court proceeding when a dwelling lacks heat, running water, light, electricity, or adequate sewage, or has another condition in substantial violation of fitness standards or dangerous to life, health, or safety. It states no repair day count. Rent paid into court in that proceeding is not a private right to withhold rent. No date was stored from ${requestDate}. ${NOT} Municipal rent control was not applied. Checked ${CHECKED}.`, explanationEs: `La sección 2A:42-88 es un procedimiento judicial. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  if (state === "TN") return { ...base, ruleId: "TN-66-28-304", citation: "Tenn. Code Ann. § 66-28-304", explanation: `You said the Act applies. Section 66-28-304 requires the landlord to keep the premises fit and habitable and to comply with health and safety codes. It states no day count. Section 66-28-501's 14-day notice is before a court remedy and was not stored as a repair deadline from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 66-28-304 no fija días. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  return { ...base, ruleId: "KY-383.595", citation: "Ky. Rev. Stat. Ann. § 383.595", explanation: `You said your locality adopted the Act. Section 383.595 requires a fit and habitable premises and maintenance of supplied systems, heat, and hot water. It states no day count, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 383.595 no fija días. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
}

export function batch9Retaliation(state: string, activityDate: string, noticeDate: string, daysSince: number, choice: LawChoice = "unsure"): (Stamp & { flagged: boolean; daysSince: number }) | null {
  if (!isBatch9(state)) return null;
  if ((state === "TN" || state === "KY") && choice !== "yes") {
    const gate = held(state, choice);
    return gate ? { ...gate, flagged: false, daysSince } : null;
  }
  if (state === "KY") {
    const end = addMonths(activityDate, 12);
    const flagged = daysSince >= 0 && noticeDate <= end;
    return {
      flagged, daysSince, dueDate: null, ruleId: "KY-383.705", citation: "Ky. Rev. Stat. Ann. § 383.705", unsure: false,
      computation: `${activityDate} plus one year = ${end}.`,
      explanation: flagged
        ? `You said your locality adopted the Act. The later date is inside one year (${end}). Section 383.705 creates a presumption of retaliation for a complaint in that period. It is not a finding. The presumption does not arise if the complaint followed notice of a proposed increase. That was not decided. Checked ${CHECKED}.`
        : `You said your locality adopted the Act. The later date is outside one year (${end}). Being outside the presumption is not a finding that the act was lawful. Checked ${CHECKED}.`,
      explanationEs: flagged ? `La fecha posterior está dentro de un año (${end}). No es una conclusión. Revisado el ${CHECKED_ES}.` : `La fecha posterior está fuera de un año (${end}). Estar fuera no significa que el acto sea lícito. Revisado el ${CHECKED_ES}.`,
    };
  }
  const none = { flagged: false as const, daysSince, dueDate: null as string | null, unsure: true };
  if (state === "LA") return { ...none, ruleId: "LA-9-3201", citation: "La. Rev. Stat. Ann. §§ 9:3201 to 9:3261.2", computation: "No retaliation section in the lease statutes that were listed.", explanation: `The legislature's list of Revised Statutes 9:3201 through 9:3261.2 has no retaliation heading. A search of the Revised Statutes for "retaliat" did not return a section in that range. Civil Code articles 2668 through 2729 also have no retaliation heading. No date was flagged. That is not a finding that every later act was lawful. Checked ${CHECKED}.`, explanationEs: `Las listas oficiales no tienen una sección de represalia para el arrendamiento. No se marcó una fecha. Revisado el ${CHECKED_ES}.` };
  if (state === "AR") return { ...none, ruleId: "AR-18-17", citation: "Ark. Code Ann. §§ 18-17-101 to 18-17-913", computation: "No retaliation heading in chapter 17.", explanation: `The table of contents for the Arkansas Residential Landlord-Tenant Act of 2007, sections 18-17-101 through 18-17-913, has no retaliation heading. No date was flagged. That is not a finding that every later act was lawful. Checked ${CHECKED}.`, explanationEs: `El índice del capítulo 18-17 no tiene una sección de represalia. No se marcó una fecha. Revisado el ${CHECKED_ES}.` };
  if (state === "NJ") return { ...none, ruleId: "NJ-2A-42-10.12", citation: "N.J. Stat. Ann. § 2A:42-10.12", computation: "No general day count.", explanation: `Section 2A:42-10.10 says a landlord shall not use a notice to quit or a possession action as a reprisal for a listed tenant act. Section 2A:42-10.12 creates a rebuttable presumption when a notice to quit or a substantial change follows a listed act. It states no general number of days, so no date was flagged. No presumption arises from a failure to renew when the tenant asked sooner than 90 days before the lease expires. That timing was not entered. It is not a finding. Municipal rent control was not applied. Checked ${CHECKED}.`, explanationEs: `Las secciones 2A:42-10.10 y 10.12 no fijan un plazo general. No se marcó una fecha. Revisado el ${CHECKED_ES}.` };
  return { ...none, unsure: false, ruleId: "TN-66-28-514", citation: "Tenn. Code Ann. § 66-28-514", computation: "No day count. Section 66-28-514 does not state a number of days.", explanation: `You said the Act applies. Section 66-28-514 says a landlord may not retaliate by increasing rent, decreasing services, or bringing a possession action after a complaint under section 66-28-301 or use of a remedy under the chapter. It states no number of days, so no date was flagged. Exceptions, including nonpayment, were not decided. It is not a finding. Checked ${CHECKED}.`, explanationEs: `La sección 66-28-514 no fija días. No se marcó una fecha. Revisado el ${CHECKED_ES}.` };
}

export function batch9Rent(state: string, lowestCents: number, proposedCents: number, choice: LawChoice = "unsure") {
  if (!isBatch9(state)) return null;
  if ((state === "TN" || state === "KY") && choice !== "yes") {
    const gate = held(state, choice);
    return gate ? { abovePublishedMax: false as const, headlineEn: state === "TN" ? "Tennessee rent increase" : "Kentucky rent increase", headlineEs: state === "TN" ? "Aumento de renta en Tennessee" : "Aumento de renta en Kentucky", ruleId: gate.ruleId, detailEn: gate.explanation, detailEs: gate.explanationEs } : null;
  }
  const amount = percent(lowestCents, proposedCents);
  const base = { abovePublishedMax: false as const };
  const entered = `The increase from the amounts entered is about ${amount}%.`;
  if (state === "LA") return { ...base, headlineEn: "Louisiana rent increase", headlineEs: "Aumento de renta en Luisiana", ruleId: "LA-CC-2728", detailEn: `${entered} Articles 2727 and 2728 do not state a percentage cap. They set the notice to end a lease with an indeterminate term: 30 calendar days before the end of a period longer than a month, 10 calendar days for month to month, 5 calendar days for a week or longer but shorter than a month, and any time before the end of a shorter period. The term was not entered, so no notice period was graded as a rent increase. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. Los artículos 2727 y 2728 no fijan un tope. El aviso no se calificó. Revisado el ${CHECKED_ES}.` };
  if (state === "AR") return { ...base, headlineEn: "Arkansas rent increase", headlineEs: "Aumento de renta en Arkansas", ruleId: "AR-18-17-704", detailEn: `${entered} The sections opened on ${CHECKED} do not state a percentage cap or a rent-increase notice. Section 18-17-704 requires at least 30 days' written notice to end a month-to-month tenancy and at least 7 days for a week-to-week tenancy. Those notices end the tenancy and were not graded as a rent increase. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. La sección 18-17-704 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.` };
  if (state === "NJ") return { ...base, headlineEn: "New Jersey rent increase", headlineEs: "Aumento de renta en Nueva Jersey", ruleId: "NJ-2A-42-10.10", detailEn: `${entered} The sections opened on ${CHECKED} do not state a statewide percentage cap or a rent-increase notice period. Section 2A:42-10.10 treats a substantial change in the tenancy, including a refusal to renew, as an unlawful reprisal when it follows a listed tenant act. That was not decided. Municipal rent control is not covered and was not applied. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. No hay un tope estatal en las secciones abiertas. El control municipal de la renta no se aplicó. Revisado el ${CHECKED_ES}.` };
  if (state === "TN") return { ...base, headlineEn: "Tennessee rent increase", headlineEs: "Aumento de renta en Tennessee", ruleId: "TN-66-28-201", detailEn: `${entered} You said the Act applies. Section 66-28-201 lets the agreement set the rent and states no percentage cap. A late fee may not exceed 10 percent of the past-due rent and was not used as a rent cap. Section 66-28-512 requires at least 30 days' written notice to end a month-to-month tenancy and at least 10 days for a week-to-week tenancy. Those notices end the tenancy and were not graded as a rent increase. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. La sección 66-28-201 no fija un tope. Revisado el ${CHECKED_ES}.` };
  return { ...base, headlineEn: "Kentucky rent increase", headlineEs: "Aumento de renta en Kentucky", ruleId: "KY-383.505", detailEn: `${entered} You said your locality adopted the Act. The sections opened on ${CHECKED} do not state a percentage cap or a rent-increase notice. A retaliatory increase is a separate limit under section 383.705. No notice period was graded. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. No hay un tope en las secciones abiertas. Revisado el ${CHECKED_ES}.` };
}

export function batch9RepairLetter(state: string, locale: "en" | "es", choice: LawChoice = "unsure"): string | null {
  if (!isBatch9(state)) return null;
  if ((state === "TN" || state === "KY") && choice !== "yes") {
    const en = state === "TN"
      ? choice === "no"
        ? "I am asking you to address this repair. The Tennessee county population test is not met, so the Uniform Residential Landlord and Tenant Act was not applied. This letter is not a notice that I am withholding rent. I confirm this message before it is sent."
        : "I am asking you to address this repair. Tennessee's Uniform Residential Landlord and Tenant Act was not applied because the county population test was not confirmed. This letter is not a notice that I am withholding rent. I confirm this message before it is sent."
      : choice === "no"
        ? "I am asking you to address this repair. My city or county has not adopted Kentucky's Uniform Residential Landlord and Tenant Act, so it was not applied. This letter is not a notice that I am withholding rent. I confirm this message before it is sent."
        : "I am asking you to address this repair. Kentucky's Uniform Residential Landlord and Tenant Act may apply if my city or county adopted it. That was not confirmed, so it was not applied. This letter is not a notice that I am withholding rent. I confirm this message before it is sent.";
    const es = state === "TN"
      ? "Le pido que atienda esta reparación. La ley uniforme de Tennessee no se aplicó. Esta carta no avisa que retengo la renta. Confirmo este mensaje antes de enviarlo."
      : choice === "no"
        ? "Le pido que atienda esta reparación. Mi ciudad o condado no adoptó la ley uniforme de Kentucky, así que no se aplicó. Confirmo este mensaje antes de enviarlo."
        : "Le pido que atienda esta reparación. La ley uniforme de Kentucky puede aplicar si mi ciudad o condado la adoptó. No se confirmó, así que no se aplicó. Confirmo este mensaje antes de enviarlo.";
    return locale === "es" ? es : en;
  }
  const en: Record<Batch9State, string> = {
    LA: "I am asking you to address this repair. Louisiana Civil Code article 2691 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
    AR: "I am asking you to address this repair. Arkansas Code § 18-17-502 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
    NJ: "I am asking you to address this repair. This letter is not a court case under New Jersey law and it is not a notice that I am withholding rent or paying rent into court. I confirm this message before it is sent.",
    TN: "I am asking you to address this repair. Tennessee Code § 66-28-304 does not set a number of days. This letter is not a 14-day court notice and it is not a notice that I am withholding rent. I confirm this message before it is sent.",
    KY: "I am asking you to address this repair. Kentucky Revised Statutes § 383.595 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
  };
  const es: Record<Batch9State, string> = {
    LA: "Le pido que atienda esta reparación. El código civil de Luisiana no fija un número de días. Esta carta no avisa que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    AR: "Le pido que atienda esta reparación. El código de Arkansas no fija un número de días. Esta carta no avisa que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    NJ: "Le pido que atienda esta reparación. Esta carta no es un caso judicial ni un aviso de que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    TN: "Le pido que atienda esta reparación. El código de Tennessee no fija un número de días. Esta carta no avisa que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    KY: "Le pido que atienda esta reparación. El estatuto de Kentucky no fija un número de días. Esta carta no avisa que retengo la renta. Confirmo este mensaje antes de enviarlo.",
  };
  return locale === "es" ? es[state] : en[state];
}

const depositTopics = ["security deposit", "deposito", "depósito"];
const repairTopics = ["repair", "habitability", "reparacion", "reparación"];
const retalTopics = ["retaliation", "represalia"];
const rentTopics = ["rent increase", "aumento de renta"];

export const BATCH9_RULES: Rule[] = [
  info({ id: "LA-9-3251", jurisdiction: "LA", topic: "deposit", topics: depositTopics, titleEn: "Louisiana security deposit", titleEs: "Depósito en Luisiana", summaryEn: `Section 9:3251 returns a residential deposit within one month after the lease ends. A retained portion may be itemized up to 15 days after that month. No month cap was stated. Checked ${CHECKED}.`, summaryEs: `La sección 9:3251 da un mes. No se indicó un máximo de meses. Revisado el ${CHECKED_ES}.`, citation: "La. Rev. Stat. Ann. § 9:3251", sourceName: "Louisiana Legislature", sourceUrl: "https://legis.la.gov/" }),
  info({ id: "LA-CC-2691", jurisdiction: "LA", topic: "repair", topics: repairTopics, titleEn: "Louisiana lessor repairs", titleEs: "Reparaciones en Luisiana", summaryEn: `Civil Code article 2691 requires the lessor to make repairs necessary to keep the thing suitable for its leased purpose. It states no day count and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `El artículo 2691 no fija días y no es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "La. Civ. Code art. 2691", sourceName: "Louisiana Legislature", sourceUrl: "https://legis.la.gov/" }),
  info({ id: "LA-9-3201", jurisdiction: "LA", topic: "retaliation", topics: retalTopics, titleEn: "Louisiana retaliation", titleEs: "Represalia en Luisiana", summaryEn: `The official lists of Revised Statutes 9:3201 to 9:3261.2 and Civil Code articles 2668 to 2729 have no retaliation section. A Revised Statutes search for retaliat did not return a lease-range section. No date is flagged. Checked ${CHECKED}.`, summaryEs: `Las listas oficiales no tienen una sección de represalia para el arrendamiento. Revisado el ${CHECKED_ES}.`, citation: "La. Rev. Stat. Ann. §§ 9:3201 to 9:3261.2", sourceName: "Louisiana Legislature", sourceUrl: "https://legis.la.gov/legis/LawSearch.aspx" }),
  info({ id: "LA-CC-2728", jurisdiction: "LA", topic: "rent-increase", topics: rentTopics, titleEn: "Louisiana lease notice", titleEs: "Aviso de arrendamiento en Luisiana", summaryEn: `Articles 2727 and 2728 set notice to end an indeterminate lease and state no percentage cap. The periods were not graded as a rent increase. Checked ${CHECKED}.`, summaryEs: `Los artículos 2727 y 2728 no fijan un tope. El aviso no se calificó como un aumento. Revisado el ${CHECKED_ES}.`, citation: "La. Civ. Code arts. 2727 and 2728", sourceName: "Louisiana Legislature", sourceUrl: "https://legis.la.gov/" }),
  info({ id: "AR-18-16-305", jurisdiction: "AR", topic: "deposit", topics: depositTopics, titleEn: "Arkansas security deposit", titleEs: "Depósito en Arkansas", summaryEn: `Section 18-16-304 limits a deposit to two months' rent. Section 18-16-305 returns the balance within 60 days after termination and delivery of possession. Checked ${CHECKED}.`, summaryEs: `El depósito se limita a dos meses y el saldo se devuelve a los 60 días. Revisado el ${CHECKED_ES}.`, citation: "Ark. Code Ann. § 18-16-305", sourceName: "Arkansas Code Revision Commission", sourceUrl: "https://www.lexisnexis.com/hottopics/arcode/" }),
  info({ id: "AR-18-17-502", jurisdiction: "AR", topic: "repair", topics: repairTopics, titleEn: "Arkansas residential standards", titleEs: "Normas de vivienda en Arkansas", summaryEn: `Section 18-17-502 implies basic residential systems for agreements entered or renewed after November 1, 2021. It states no day count and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 18-17-502 no fija días y no es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Ark. Code Ann. § 18-17-502", sourceName: "Arkansas Code Revision Commission", sourceUrl: "https://www.lexisnexis.com/hottopics/arcode/" }),
  info({ id: "AR-18-17", jurisdiction: "AR", topic: "retaliation", topics: retalTopics, titleEn: "Arkansas retaliation", titleEs: "Represalia en Arkansas", summaryEn: `The table of contents for sections 18-17-101 through 18-17-913 has no retaliation heading. No date is flagged. Checked ${CHECKED}.`, summaryEs: `El índice del capítulo 18-17 no tiene una sección de represalia. Revisado el ${CHECKED_ES}.`, citation: "Ark. Code Ann. §§ 18-17-101 to 18-17-913", sourceName: "Arkansas Code Revision Commission", sourceUrl: "https://www.lexisnexis.com/hottopics/arcode/" }),
  info({ id: "AR-18-17-704", jurisdiction: "AR", topic: "rent-increase", topics: rentTopics, titleEn: "Arkansas rent change", titleEs: "Cambio de renta en Arkansas", summaryEn: `The sections opened do not state a percentage cap or a rent-increase notice. Section 18-17-704's 30-day and 7-day notices end a periodic tenancy and were not graded as a rent increase. Checked ${CHECKED}.`, summaryEs: `No hay un tope en las secciones abiertas. La sección 18-17-704 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`, citation: "Ark. Code Ann. § 18-17-704", sourceName: "Arkansas Code Revision Commission", sourceUrl: "https://www.lexisnexis.com/hottopics/arcode/" }),
  info({ id: "NJ-46-8-21.1", jurisdiction: "NJ", topic: "deposit", topics: depositTopics, titleEn: "New Jersey security deposit", titleEs: "Depósito en Nueva Jersey", summaryEn: `Section 46:8-21.1 returns the deposit and the tenant's share of interest within 30 days after the lease ends. The opened sections state no maximum number of months. Interest was not calculated. Checked ${CHECKED}.`, summaryEs: `La sección 46:8-21.1 da 30 días. El interés no se calculó. Revisado el ${CHECKED_ES}.`, citation: "N.J. Stat. Ann. § 46:8-21.1", sourceName: "New Jersey Legislature", sourceUrl: "https://lis.njleg.state.nj.us/" }),
  info({ id: "NJ-2A-42-88", jurisdiction: "NJ", topic: "repair", topics: repairTopics, titleEn: "New Jersey court remedy for serious defects", titleEs: "Remedio judicial en Nueva Jersey", summaryEn: `Section 2A:42-88 lets a tenant maintain a court proceeding for a lack of heat, water, light, electricity, or sewage, or another serious fitness violation. It is not a repair deadline and is not permission to withhold rent. Municipal rent control was not applied. Checked ${CHECKED}.`, summaryEs: `La sección 2A:42-88 es un procedimiento judicial. No es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "N.J. Stat. Ann. § 2A:42-88", sourceName: "New Jersey Legislature", sourceUrl: "https://lis.njleg.state.nj.us/" }),
  info({ id: "NJ-2A-42-10.12", jurisdiction: "NJ", topic: "retaliation", topics: retalTopics, titleEn: "New Jersey reprisal", titleEs: "Represalia en Nueva Jersey", summaryEn: `Sections 2A:42-10.10 and 2A:42-10.12 prohibit a reprisal notice or possession action and create a rebuttable presumption. They state no general day count. It is not a finding. Checked ${CHECKED}.`, summaryEs: `Las secciones 2A:42-10.10 y 10.12 no fijan un plazo general. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "N.J. Stat. Ann. § 2A:42-10.12", sourceName: "New Jersey Legislature", sourceUrl: "https://lis.njleg.state.nj.us/" }),
  info({ id: "NJ-2A-42-10.10", jurisdiction: "NJ", topic: "rent-increase", topics: rentTopics, titleEn: "New Jersey rent change", titleEs: "Cambio de renta en Nueva Jersey", summaryEn: `The sections opened do not state a statewide percentage cap or a rent-increase notice. A reprisal change in the tenancy is a separate limit. Municipal rent control is not covered. Checked ${CHECKED}.`, summaryEs: `No hay un tope estatal en las secciones abiertas. El control municipal de la renta no se aplicó. Revisado el ${CHECKED_ES}.`, citation: "N.J. Stat. Ann. § 2A:42-10.10", sourceName: "New Jersey Legislature", sourceUrl: "https://lis.njleg.state.nj.us/" }),
  info({ id: "TN-66-28-301", jurisdiction: "TN", topic: "deposit", topics: depositTopics, titleEn: "Tennessee security deposit", titleEs: "Depósito en Tennessee", summaryEn: `Section 66-28-301 applies only in a county over 75,000 people in the 2010 census, and only when the tenant confirms that. A refund notice starts a 60-day response period. No date is stored until that notice date is entered. Checked ${CHECKED}.`, summaryEs: `La sección 66-28-301 aplica solo si el condado califica y el inquilino lo confirma. Revisado el ${CHECKED_ES}.`, citation: "Tenn. Code Ann. § 66-28-301", sourceName: "Tennessee General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/tncode/" }),
  info({ id: "TN-66-28-304", jurisdiction: "TN", topic: "repair", topics: repairTopics, titleEn: "Tennessee landlord maintenance", titleEs: "Mantenimiento en Tennessee", summaryEn: `Section 66-28-304 requires a fit premises when the Act applies. It states no day count and is not permission to withhold rent. The Act was not applied unless the tenant confirmed the county test. Checked ${CHECKED}.`, summaryEs: `La sección 66-28-304 no fija días y no se aplica sin confirmación. Revisado el ${CHECKED_ES}.`, citation: "Tenn. Code Ann. § 66-28-304", sourceName: "Tennessee General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/tncode/" }),
  info({ id: "TN-66-28-514", jurisdiction: "TN", topic: "retaliation", topics: retalTopics, titleEn: "Tennessee retaliation", titleEs: "Represalia en Tennessee", summaryEn: `Section 66-28-514 prohibits a retaliatory rent increase, service cut, or possession action when the Act applies. It states no number of days. It is not a finding. Checked ${CHECKED}.`, summaryEs: `La sección 66-28-514 no fija días. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "Tenn. Code Ann. § 66-28-514", sourceName: "Tennessee General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/tncode/" }),
  info({ id: "TN-66-28-201", jurisdiction: "TN", topic: "rent-increase", topics: rentTopics, titleEn: "Tennessee rent terms", titleEs: "Renta en Tennessee", summaryEn: `Section 66-28-201 lets the agreement set the rent when the Act applies and states no percentage cap. Section 66-28-512's notices end a periodic tenancy and were not graded as a rent increase. Checked ${CHECKED}.`, summaryEs: `La sección 66-28-201 no fija un tope. El aviso de la sección 66-28-512 no se calificó. Revisado el ${CHECKED_ES}.`, citation: "Tenn. Code Ann. § 66-28-201", sourceName: "Tennessee General Assembly", sourceUrl: "https://www.lexisnexis.com/hottopics/tncode/" }),
  info({ id: "KY-383.580", jurisdiction: "KY", topic: "deposit", topics: depositTopics, titleEn: "Kentucky security deposit", titleEs: "Depósito en Kentucky", summaryEn: `Section 383.580 applies only where a locality has adopted the Act, and only when the tenant confirms that. A refund notice starts a 60-day response period. No date is stored until that notice date is entered. Checked ${CHECKED}.`, summaryEs: `La sección 383.580 aplica solo si la localidad adoptó la ley y el inquilino lo confirma. Revisado el ${CHECKED_ES}.`, citation: "Ky. Rev. Stat. Ann. § 383.580", sourceName: "Kentucky Legislature", sourceUrl: "https://apps.legislature.ky.gov/law/statutes/" }),
  info({ id: "KY-383.595", jurisdiction: "KY", topic: "repair", topics: repairTopics, titleEn: "Kentucky landlord maintenance", titleEs: "Mantenimiento en Kentucky", summaryEn: `Section 383.595 requires a fit premises where the Act was adopted. It states no day count and is not permission to withhold rent. It was not applied unless the tenant confirmed adoption. Checked ${CHECKED}.`, summaryEs: `La sección 383.595 no fija días y no se aplica sin confirmación. Revisado el ${CHECKED_ES}.`, citation: "Ky. Rev. Stat. Ann. § 383.595", sourceName: "Kentucky Legislature", sourceUrl: "https://apps.legislature.ky.gov/law/statutes/" }),
  info({ id: "KY-383.705", jurisdiction: "KY", topic: "retaliation", topics: retalTopics, titleEn: "Kentucky retaliation", titleEs: "Represalia en Kentucky", summaryEn: `Section 383.705 creates a one-year presumption of retaliation where the Act was adopted. A date inside that year is not a finding. The Act was not applied unless the tenant confirmed adoption. Checked ${CHECKED}.`, summaryEs: `La sección 383.705 cubre un año. No es una conclusión y no se aplica sin confirmación. Revisado el ${CHECKED_ES}.`, citation: "Ky. Rev. Stat. Ann. § 383.705", sourceName: "Kentucky Legislature", sourceUrl: "https://apps.legislature.ky.gov/law/statutes/" }),
  info({ id: "KY-383.505", jurisdiction: "KY", topic: "rent-increase", topics: rentTopics, titleEn: "Kentucky rent change", titleEs: "Cambio de renta en Kentucky", summaryEn: `Where the Act was adopted, the opened sections state no percentage cap and no rent-increase notice. A retaliatory increase is a separate limit. The Act was not applied unless the tenant confirmed adoption. Checked ${CHECKED}.`, summaryEs: `No hay un tope en las secciones abiertas. No se aplica sin confirmación. Revisado el ${CHECKED_ES}.`, citation: "Ky. Rev. Stat. Ann. § 383.500", sourceName: "Kentucky Legislature", sourceUrl: "https://apps.legislature.ky.gov/law/statutes/" }),
];
