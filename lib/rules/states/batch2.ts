import { addDays, addMonths } from "@/lib/rules/dates";
import { rule, type Rule } from "@/lib/rules/define";

const CHECKED = "Nov 14, 2026";
const CHECKED_ES = "14 de noviembre de 2026";

export const BATCH2_STATES = ["MI", "VA", "MD", "MN", "WI"] as const;
export type Batch2State = (typeof BATCH2_STATES)[number];

type Stamp = {
  dueDate: string | null;
  ruleId: string;
  citation: string;
  explanation: string;
  explanationEs: string;
  computation: string;
  unsure: boolean;
};

export function isBatch2(state: string): state is Batch2State {
  return (BATCH2_STATES as readonly string[]).includes(state);
}

function percent(lowestCents: number, proposedCents: number): string {
  const value = Math.round(((proposedCents - lowestCents) * 1_000_000) / lowestCents);
  return (value / 10_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function info(input: {
  id: string;
  jurisdiction: Batch2State;
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
    reasonEn: `Loaded for ${input.jurisdiction} only. Checked ${CHECKED}. Not a finding about a particular home.`,
    reasonEs: `Cargado solo para ${input.jurisdiction}. Revisado el ${CHECKED_ES}. No es una conclusión sobre una vivienda.`,
    patterns: [],
  });
}

const NOT = "This is not permission to withhold rent, repair and deduct, or end the tenancy.";
const NOT_ES = "No es permiso para retener la renta, reparar y descontar, ni terminar el arrendamiento.";

export function batch2Deposit(state: string, triggerDate: string): Stamp | null {
  if (!isBatch2(state)) return null;
  if (state === "MI") {
    const due = addDays(triggerDate, 30);
    return {
      dueDate: due,
      ruleId: "MI-554.609",
      citation: "Mich. Comp. Laws § 554.609",
      unsure: true,
      computation: `${triggerDate} + 30 days = ${due}, the notice-of-damages date. A direct deposit of the balance may be 10 days after that notice is mailed.`,
      explanation: `MCL 554.602 limits a security deposit to 1 1/2 months' rent. MCL 554.609 says that if there is damage or another obligation against the deposit, the landlord shall mail an itemized notice within 30 days after termination of occupancy, ordinarily with the balance. A 2026 amendment allows the balance by direct deposit within 10 days after that notice is mailed. Using ${triggerDate} as the end of occupancy, the notice date is ${due}. It is unsure because the payment method was not entered. MCL 554.610 says failure to give the notice within 30 days is an agreement that no damages are due and the full deposit shall be remitted immediately. Checked ${CHECKED}.`,
      explanationEs: `MCL 554.602 limita el depósito a un mes y medio de renta. El aviso de daños es a los 30 días, y el saldo electrónico puede ser 10 días después de enviarlo. La fecha es incierta. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "VA") {
    const due = addDays(triggerDate, 45);
    return {
      dueDate: due,
      ruleId: "VA-55.1-1226",
      citation: "Va. Code § 55.1-1226",
      unsure: true,
      computation: `${triggerDate} + 45 days = ${due}. The statute uses the later of termination or the date the tenant vacates. A third-party repair can add 15 days.`,
      explanation: `Section 55.1-1226 limits a security deposit to two months' periodic rent. The itemized notice and any amount due must be given within 45 days after termination or the date the tenant vacates, whichever is later. Using ${triggerDate} as that later date, the date is ${due}. It is unsure because the other date was not entered, and the landlord may take 15 more days when a third-party contractor is required and notice is given in the 45 days. If no forwarding address is given, the landlord may hold the deposit. Checked ${CHECKED}.`,
      explanationEs: `La sección 55.1-1226 limita el depósito a dos meses de renta y da 45 días después de la terminación o de la desocupación, lo que sea después. La fecha es incierta. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MD") {
    const due = addDays(triggerDate, 45);
    return {
      dueDate: due,
      ruleId: "MD-8-203",
      citation: "Md. Code, Real Prop. § 8-203",
      unsure: false,
      computation: `${triggerDate} + 45 days = ${due}.`,
      explanation: `Section 8-203(e) says the landlord shall return the security deposit, with simple interest, within 45 days after the end of the tenancy, less damages rightfully withheld. Using ${triggerDate} as the end of the tenancy, the date is ${due}. The ordinary cap is one month's rent. Up to two months is allowed only when the tenant has qualified for utility assistance, pays utilities to the landlord, and agrees in writing. That exception was not applied. Interest is the greater of the one-year Treasury yield or 1.5 percent when the deposit is at least $50 and was held six months. The Treasury figure was not loaded, so interest was not calculated. An eviction or abandonment uses a written-demand path that was not applied. Montgomery County and Takoma Park rent rules were not applied to this deposit. Checked ${CHECKED}.`,
      explanationEs: `La sección 8-203 da 45 días después del fin del arrendamiento. El tope ordinario es un mes de renta. No se calculó el interés. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MN") {
    const due = addDays(triggerDate, 21);
    return {
      dueDate: due,
      ruleId: "MN-504B.178",
      citation: "Minn. Stat. § 504B.178",
      unsure: true,
      computation: `${triggerDate} + 21 days = ${due}. The statute says three weeks after termination, and only after the landlord receives a mailing address or delivery instructions.`,
      explanation: `Section 504B.178, subdivision 3, says the landlord shall, within three weeks after termination of the tenancy and after receipt of the tenant's mailing address or delivery instructions, return the deposit with interest or furnish a written statement of the reasons for withholding. Using ${triggerDate} as termination, three weeks is ${due}. It is unsure because receipt of the address was not entered. The opened section does not state a maximum number of months. Interest is simple interest at one percent per year. Ordinary wear and tear is excluded. St. Paul and Minneapolis rent stabilization were not applied. Checked ${CHECKED}.`,
      explanationEs: `La sección 504B.178 da tres semanas después de la terminación, y solo después de recibir una dirección. La fecha es incierta. No se fijó un máximo de meses. Revisado el ${CHECKED_ES}.`,
    };
  }
  const due = addDays(triggerDate, 21);
  return {
    dueDate: due,
    ruleId: "WI-704.28",
    citation: "Wis. Stat. § 704.28",
    unsure: true,
    computation: `${triggerDate} + 21 days = ${due}. The statute has three different start dates.`,
    explanation: `Section 704.28(4) says the landlord shall deliver or mail the security deposit, less lawful withholdings, within 21 days after one of three events: termination if the tenant vacates that day; termination or the new tenancy's start if the tenant leaves early and the unit is rerented; or the date the landlord learns the tenant has left if the tenant stays past termination. Using ${triggerDate} as the applicable event, the date is ${due}. It is unsure because which event applies was not entered. Normal wear and tear may not be withheld. The opened section does not state a maximum number of months. Checked ${CHECKED}.`,
    explanationEs: `La sección 704.28 da 21 días desde uno de tres hechos distintos. La fecha es incierta. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch2Repair(state: string, requestDate: string): Stamp | null {
  if (!isBatch2(state)) return null;
  const common = {
    dueDate: null as string | null,
    unsure: true,
    computation: `Notice ${requestDate}. No single repair date was stored.`,
  };
  if (state === "MI") {
    return {
      ...common,
      ruleId: "MI-554.139",
      citation: "Mich. Comp. Laws § 554.139",
      explanation: `MCL 554.139 covenants that residential premises are fit for the intended use, that the landlord will keep them in reasonable repair, and that the landlord will comply with applicable health and safety laws, unless the tenant's willful or irresponsible conduct caused the problem. It states no number of days, so no date was stored from ${requestDate}. A lease of at least one year may modify these duties. That was not decided. ${NOT} Checked ${CHECKED}.`,
      explanationEs: `MCL 554.139 no fija un número de días. No se guardó una fecha. ${NOT_ES} Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "VA") {
    return {
      ...common,
      ruleId: "VA-55.1-1220",
      citation: "Va. Code § 55.1-1220",
      explanation: `Section 55.1-1220 requires the landlord to comply with building and housing codes that materially affect health and safety, keep the premises fit and habitable, and maintain supplied facilities. It states no number of days, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`,
      explanationEs: `La sección 55.1-1220 no fija un número de días. No se guardó una fecha. ${NOT_ES} Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MD") {
    return {
      ...common,
      ruleId: "MD-8-211",
      citation: "Md. Code, Real Prop. § 8-211",
      explanation: `Section 8-211 gives the landlord a reasonable time after notice to repair a serious and dangerous condition. There is a rebuttable presumption that more than 30 days from receipt is unreasonable. The length of a reasonable time is a question for the court. No date was stored from ${requestDate}. The rent-escrow and nonpayment defenses in that section have extra conditions, including notice and payment of rent into court. ${NOT} Montgomery County and Takoma Park ordinances were not applied. Checked ${CHECKED}.`,
      explanationEs: `La sección 8-211 da un tiempo razonable. Hay una presunción de que más de 30 días es irrazonable. No se guardó una fecha. ${NOT_ES} Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MN") {
    return {
      ...common,
      ruleId: "MN-504B.161",
      citation: "Minn. Stat. § 504B.161",
      explanation: `Section 504B.161 covenants that the premises are fit, that the landlord will keep them in reasonable repair, and that the landlord will comply with health and safety laws. It also requires heat of at least 68 degrees Fahrenheit from October 1 through April 30 where habitation is intended, unless a utility instructs otherwise. It states no repair day count, so no date was stored from ${requestDate}. ${NOT} St. Paul and Minneapolis rent stabilization were not applied. Checked ${CHECKED}.`,
      explanationEs: `La sección 504B.161 no fija un plazo de reparación. Exige 68 grados del 1 de octubre al 30 de abril. No se guardó una fecha. ${NOT_ES} Revisado el ${CHECKED_ES}.`,
    };
  }
  return {
    ...common,
    ruleId: "WI-704.07",
    citation: "Wis. Stat. § 704.07",
    explanation: `Section 704.07 requires the landlord to keep premises the landlord controls in reasonable repair, make necessary structural repairs, and, for a residential tenancy, comply with a local housing code. It states no number of days, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`,
    explanationEs: `La sección 704.07 no fija un número de días. No se guardó una fecha. ${NOT_ES} Revisado el ${CHECKED_ES}.`,
  };
}

export function batch2Retaliation(state: string, activityDate: string, noticeDate: string, daysSince: number): (Stamp & { flagged: boolean; daysSince: number }) | null {
  if (!isBatch2(state)) return null;
  if (state === "MD") {
    const end = addMonths(activityDate, 6);
    const flagged = daysSince >= 0 && noticeDate <= end;
    return {
      flagged,
      daysSince,
      dueDate: null,
      ruleId: "MD-8-208.1",
      citation: "Md. Code, Real Prop. § 8-208.1",
      unsure: false,
      computation: `${activityDate} plus six months = ${end}.`,
      explanation: flagged
        ? `The later date is inside six months (${end}). Section 8-208.1(e) says a landlord's action is not deemed retaliatory if it occurs more than six months after the tenant's protected act. A date inside six months is not a finding. The tenant must be current on rent unless rent is withheld under the lease, § 8-211, or a comparable local ordinance. Checked ${CHECKED}.`
        : `The later date is outside six months (${end}). Section 8-208.1(e) says the action is not deemed retaliatory for this section. That is not a finding that the act was lawful. Checked ${CHECKED}.`,
      explanationEs: flagged
        ? `La fecha posterior está dentro de seis meses (${end}). No es una conclusión. Revisado el ${CHECKED_ES}.`
        : `La fecha posterior está fuera de seis meses (${end}). Estar fuera no significa que el acto sea lícito. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MN") {
    const flagged = daysSince >= 0 && daysSince <= 90;
    return {
      flagged,
      daysSince,
      dueDate: null,
      ruleId: "MN-504B.212",
      citation: "Minn. Stat. § 504B.212",
      unsure: false,
      computation: "90 days from the protected act. Day 90 is included.",
      explanation: flagged
        ? `The later date is ${daysSince} days after the earlier one, within 90 days. Section 504B.212, subdivision 2, puts the burden of proof on the landlord when the alleged retaliation is within 90 days of a listed tenant act, including a repair request or a code complaint. It is not a finding. After 90 days the tenant has the burden. St. Paul and Minneapolis rent stabilization were not applied. Checked ${CHECKED}.`
        : `The later date is ${daysSince} days after the earlier one, outside 90 days. After 90 days, section 504B.212 puts the burden on the tenant. Being outside 90 days is not a finding that the act was lawful. Checked ${CHECKED}.`,
      explanationEs: flagged
        ? `La fecha posterior está dentro de 90 días. La sección 504B.212 pone la carga en el propietario. No es una conclusión. Revisado el ${CHECKED_ES}.`
        : `La fecha posterior está fuera de 90 días. Estar fuera no significa que el acto sea lícito. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MI") {
    return {
      flagged: false,
      daysSince,
      dueDate: null,
      ruleId: "MI-600.5720",
      citation: "Mich. Comp. Laws § 600.5720",
      unsure: true,
      computation: "No date flagged. The 90-day presumption requires an official complaint that was not dismissed.",
      explanation: `MCL 600.5720 bars a possession judgment when a termination was primarily a penalty for enforcing rights, reporting a health or safety violation, or lawful tenant organizing. A presumption arises if, within 90 days before the summary proceeding, the tenant took official action that was not dismissed or denied. Those facts were not entered, so no date was flagged. It is not a finding. Checked ${CHECKED}.`,
      explanationEs: `MCL 600.5720 no se marcó por fechas porque la presunción de 90 días exige una queja oficial que no fue desestimada. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "VA") {
    return {
      flagged: false,
      daysSince,
      dueDate: null,
      ruleId: "VA-55.1-1258",
      citation: "Va. Code § 55.1-1258",
      unsure: true,
      computation: "No day count in the version effective on Nov 14, 2026.",
      explanation: `The version of § 55.1-1258 effective until January 1, 2027, says a landlord may not retaliate by increasing rent, decreasing services, bringing or threatening possession, or terminating after knowing of a listed tenant act. It states no number of days, so no date was flagged. The tenant has the burden of proving retaliatory intent. Exceptions include nonpayment and a tenant-caused code violation. The version effective January 1, 2027, was not applied. It is not a finding. Checked ${CHECKED}.`,
      explanationEs: `La versión vigente de la sección 55.1-1258 no fija días, así que no se marcó una fecha. La versión del 1 de enero de 2027 no se aplicó. Revisado el ${CHECKED_ES}.`,
    };
  }
  return {
    flagged: false,
    daysSince,
    dueDate: null,
    ruleId: "WI-704.45",
    citation: "Wis. Stat. § 704.45",
    unsure: true,
    computation: "No day count. § 704.45 does not state a number of days.",
    explanation: `Section 704.45 says a residential landlord may not increase rent, decrease services, bring a possession action, refuse to renew, or threaten those acts if a preponderance of the evidence shows the act would not have occurred but for retaliation for a listed tenant act. It states no number of days, so no date was flagged. It does not apply when the defect was caused by the tenant's negligence or improper use, and the landlord may bring a possession action for unpaid rent other than a prohibited increase. It is not a finding. Checked ${CHECKED}.`,
    explanationEs: `La sección 704.45 no fija días, así que no se marcó una fecha. No es una conclusión. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch2Rent(state: string, lowestCents: number, proposedCents: number) {
  if (!isBatch2(state)) return null;
  const amount = percent(lowestCents, proposedCents);
  const base = { abovePublishedMax: false as const };
  if (state === "MI") {
    return {
      ...base,
      headlineEn: "Michigan rent increase",
      headlineEs: "Aumento de renta en Michigan",
      ruleId: "MI-554.633",
      detailEn: `The increase from the amounts entered is about ${amount}%. The Truth in Renting Act sections opened on ${CHECKED} do not state a statewide percentage cap or a general rent-increase notice period. No notice period was graded. Section 554.633 allows some operating-cost adjustments on not less than 30 days' written notice when the agreement provides for them. That clause was not applied as a finding. A retaliatory increase is a separate limit under MCL 600.5720. Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${amount}%. La ley abierta no fija un tope estatal ni un aviso general de aumento. No se calificó un plazo. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "VA") {
    return {
      ...base,
      headlineEn: "Virginia rent increase",
      headlineEs: "Aumento de renta en Virginia",
      ruleId: "VA-55.1-1204",
      detailEn: `The increase from the amounts entered is about ${amount}%. The chapter opened on ${CHECKED} does not state a statewide percentage cap. Section 55.1-1204(K), as in effect until July 1, 2027, requires a landlord who owns more than four rental dwelling units to give written notice of a rent increase at least 60 days before the end of the term when the tenant has a renewal option or the agreement renews automatically. The number of units and whether the lease renews were not entered, so no notice period was graded. The 90-day text effective July 1, 2027, was not applied. Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${amount}%. No hay un tope estatal. El aviso de 60 días de la sección 55.1-1204 no se calificó porque no se indicó el número de unidades ni si el contrato se renueva. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MD") {
    return {
      ...base,
      headlineEn: "Maryland rent increase",
      headlineEs: "Aumento de renta en Maryland",
      ruleId: "MD-8-209",
      detailEn: `The increase from the amounts entered is about ${amount}%. Section 8-209 requires written notice before a rent increase: at least 90 days for a term of more than one month, 60 days for more than a week but not more than a month, and 7 or 21 days for a week or less depending on whether there is a written lease. The term was not entered, so no notice period was graded. The section states no percentage cap. It does not displace a local law that requires more notice. Montgomery County and Takoma Park rent stabilization were not applied. Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${amount}%. La sección 8-209 exige 90, 60, 7 o 21 días según el plazo. No se calificó porque no se indicó el plazo. No se aplicó la estabilización de Montgomery County ni de Takoma Park. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MN") {
    return {
      ...base,
      headlineEn: "Minnesota rent increase",
      headlineEs: "Aumento de renta en Minnesota",
      ruleId: "MN-504B.147",
      detailEn: `The increase from the amounts entered is about ${amount}%. Section 504B.147 does not state a statewide percentage cap or a fixed number of days. It says the landlord's notice of a rent increase cannot be shorter than the notice period the lease gives the tenant to quit. Those lease periods were not entered, so no notice period was graded. St. Paul rent stabilization and Minneapolis rent stabilization were not applied. A retaliatory increase is a separate limit under § 504B.212. Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${amount}%. La sección 504B.147 no fija un tope ni un número de días. No se aplicó la estabilización de St. Paul ni de Minneapolis. Revisado el ${CHECKED_ES}.`,
    };
  }
  return {
    ...base,
    headlineEn: "Wisconsin rent increase",
    headlineEs: "Aumento de renta en Wisconsin",
    ruleId: "WI-704.19",
    detailEn: `The increase from the amounts entered is about ${amount}%. The sections of chapter 704 opened on ${CHECKED} do not state a statewide percentage cap or a rent-increase notice period. No notice period was graded. Section 704.19 is how either party ends a periodic tenancy, generally with at least 28 days' written notice, or the rent-paying period if rent is payable more often than monthly. It was not graded as a rent-increase deadline. A retaliatory increase is a separate limit under § 704.45. Checked ${CHECKED}.`,
    detailEs: `El aumento es de alrededor del ${amount}%. El capítulo abierto no fija un tope ni un aviso de aumento. La sección 704.19 es para terminar un arrendamiento periódico y no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch2RepairLetter(state: string, locale: "en" | "es"): string | null {
  if (!isBatch2(state)) return null;
  const en: Record<Batch2State, string> = {
    MI: "I am asking you to address this repair. Michigan Compiled Laws § 554.139 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
    VA: "I am asking you to address this repair. Virginia Code § 55.1-1220 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
    MD: "I am asking you to address this repair. Maryland Real Property § 8-211 describes a court process after a reasonable time. This letter is not that court filing and it is not a notice that I am withholding rent. I confirm this message before it is sent.",
    MN: "I am asking you to address this repair. Minnesota Statutes § 504B.161 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
    WI: "I am asking you to address this repair. Wisconsin Statutes § 704.07 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
  };
  const es: Record<Batch2State, string> = {
    MI: "Le pido que atienda esta reparación. La ley de Michigan no fija un número de días. Esta carta no avisa que retengo la renta ni que termino el arrendamiento. Confirmo este mensaje antes de enviarlo.",
    VA: "Le pido que atienda esta reparación. El código de Virginia no fija un número de días. Esta carta no avisa que retengo la renta ni que termino el arrendamiento. Confirmo este mensaje antes de enviarlo.",
    MD: "Le pido que atienda esta reparación. Esta carta no es una demanda judicial ni un aviso de que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    MN: "Le pido que atienda esta reparación. El estatuto de Minnesota no fija un número de días. Esta carta no avisa que retengo la renta ni que termino el arrendamiento. Confirmo este mensaje antes de enviarlo.",
    WI: "Le pido que atienda esta reparación. El estatuto de Wisconsin no fija un número de días. Esta carta no avisa que retengo la renta ni que termino el arrendamiento. Confirmo este mensaje antes de enviarlo.",
  };
  return locale === "es" ? es[state] : en[state];
}

export const BATCH2_RULES: Rule[] = [
  info({ id: "MI-554.609", jurisdiction: "MI", topic: "deposit", topics: ["security deposit", "deposito", "depósito"], titleEn: "Michigan security deposit", titleEs: "Depósito en Michigan", summaryEn: `MCL 554.602 limits a security deposit to 1 1/2 months' rent. MCL 554.609 requires an itemized damage notice within 30 days after occupancy ends. Failure to give that notice is an agreement that no damages are due. Checked ${CHECKED}.`, summaryEs: `MCL 554.602 limita el depósito a un mes y medio. El aviso de daños es a los 30 días. Revisado el ${CHECKED_ES}.`, citation: "Mich. Comp. Laws §§ 554.602, 554.609", sourceName: "Michigan Legislature", sourceUrl: "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-554-609" }),
  info({ id: "MI-554.139", jurisdiction: "MI", topic: "repair", topics: ["repair", "habitability", "reparacion", "reparación"], titleEn: "Michigan fitness covenant", titleEs: "Habitabilidad en Michigan", summaryEn: `MCL 554.139 requires premises fit for the intended use and reasonable repair, and compliance with health and safety laws. It states no day count. It is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `MCL 554.139 exige una reparación razonable y no fija días. No es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Mich. Comp. Laws § 554.139", sourceName: "Michigan Legislature", sourceUrl: "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-554-139" }),
  info({ id: "MI-600.5720", jurisdiction: "MI", topic: "retaliation", topics: ["retaliation", "represalia"], titleEn: "Michigan retaliatory termination", titleEs: "Terminación por represalia en Michigan", summaryEn: `MCL 600.5720 bars a possession judgment for a retaliatory termination. A 90-day presumption applies only after an official complaint that was not dismissed. That fact was not entered, so no date was flagged. Checked ${CHECKED}.`, summaryEs: `MCL 600.5720 prohíbe una terminación por represalia. La presunción de 90 días no se aplicó sin una queja oficial. Revisado el ${CHECKED_ES}.`, citation: "Mich. Comp. Laws § 600.5720", sourceName: "Michigan Legislature", sourceUrl: "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-600-5720" }),
  info({ id: "MI-554.633", jurisdiction: "MI", topic: "rent-increase", topics: ["rent increase", "aumento de renta"], titleEn: "Michigan rent change", titleEs: "Cambio de renta en Michigan", summaryEn: `The Truth in Renting Act sections opened on ${CHECKED} do not state a statewide percentage cap or a general rent-increase notice. Some operating-cost adjustments may use 30 days' notice if the agreement says so. That was not graded. Checked ${CHECKED}.`, summaryEs: `La ley abierta no fija un tope estatal ni un aviso general de aumento. No se calificó un plazo. Revisado el ${CHECKED_ES}.`, citation: "Mich. Comp. Laws § 554.633", sourceName: "Michigan Legislature", sourceUrl: "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-554-633" }),
  info({ id: "VA-55.1-1226", jurisdiction: "VA", topic: "deposit", topics: ["security deposit", "deposito", "depósito"], titleEn: "Virginia security deposit", titleEs: "Depósito en Virginia", summaryEn: `Section 55.1-1226 limits a security deposit to two months' rent and requires an itemized disposition within 45 days after termination or vacating, whichever is later. A contractor repair can add 15 days. Checked ${CHECKED}.`, summaryEs: `La sección 55.1-1226 limita el depósito a dos meses y da 45 días. Revisado el ${CHECKED_ES}.`, citation: "Va. Code § 55.1-1226", sourceName: "Virginia Legislative Information System", sourceUrl: "https://law.lis.virginia.gov/vacode/title55.1/chapter12/section55.1-1226/" }),
  info({ id: "VA-55.1-1220", jurisdiction: "VA", topic: "repair", topics: ["repair", "habitability", "reparacion", "reparación"], titleEn: "Virginia fit premises", titleEs: "Vivienda habitable en Virginia", summaryEn: `Section 55.1-1220 requires the landlord to keep the premises fit and habitable and to maintain supplied facilities. It states no day count and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 55.1-1220 no fija días y no es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Va. Code § 55.1-1220", sourceName: "Virginia Legislative Information System", sourceUrl: "https://law.lis.virginia.gov/vacode/title55.1/chapter12/section55.1-1220/" }),
  info({ id: "VA-55.1-1258", jurisdiction: "VA", topic: "retaliation", topics: ["retaliation", "represalia"], titleEn: "Virginia retaliatory conduct", titleEs: "Conducta de represalia en Virginia", summaryEn: `The current text of § 55.1-1258 prohibits retaliatory rent increases, service cuts, possession actions, and terminations. It states no day count. The version effective January 1, 2027, was not applied. Checked ${CHECKED}.`, summaryEs: `La sección 55.1-1258 vigente no fija días. La versión de 2027 no se aplicó. Revisado el ${CHECKED_ES}.`, citation: "Va. Code § 55.1-1258", sourceName: "Virginia Legislative Information System", sourceUrl: "https://law.lis.virginia.gov/vacode/title55.1/chapter12/section55.1-1258/" }),
  info({ id: "VA-55.1-1204", jurisdiction: "VA", topic: "rent-increase", topics: ["rent increase", "aumento de renta"], titleEn: "Virginia rent-increase notice", titleEs: "Aviso de aumento en Virginia", summaryEn: `Until July 1, 2027, § 55.1-1204(K) requires 60 days' written notice of a rent increase from a landlord with more than four units when the lease renews or can be renewed. There is no statewide percentage cap. The notice was not graded because the unit count and renewal terms were not entered. Checked ${CHECKED}.`, summaryEs: `Hasta el 1 de julio de 2027, la sección 55.1-1204 exige 60 días en algunos casos. No se calificó el aviso. Revisado el ${CHECKED_ES}.`, citation: "Va. Code § 55.1-1204", sourceName: "Virginia Legislative Information System", sourceUrl: "https://law.lis.virginia.gov/vacode/title55.1/chapter12/section55.1-1204/" }),
  info({ id: "MD-8-203", jurisdiction: "MD", topic: "deposit", topics: ["security deposit", "deposito", "depósito"], titleEn: "Maryland security deposit", titleEs: "Depósito en Maryland", summaryEn: `Section 8-203 generally limits a security deposit to one month's rent and requires return within 45 days after the tenancy ends. A two-month deposit is a narrow utility-assistance exception and was not applied. Interest was not calculated. Checked ${CHECKED}.`, summaryEs: `La sección 8-203 limita el depósito en general a un mes y da 45 días. No se calculó el interés. Revisado el ${CHECKED_ES}.`, citation: "Md. Code, Real Prop. § 8-203", sourceName: "Maryland General Assembly", sourceUrl: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=grp&section=8-203&enactments=false" }),
  info({ id: "MD-8-211", jurisdiction: "MD", topic: "repair", topics: ["repair", "habitability", "reparacion", "reparación"], titleEn: "Maryland serious-repair remedy", titleEs: "Reparación grave en Maryland", summaryEn: `Section 8-211 gives a reasonable time to repair a serious danger. More than 30 days after notice is presumed unreasonable. The rent-escrow path is a court process and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 8-211 da un tiempo razonable. Más de 30 días se presume irrazonable. No es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Md. Code, Real Prop. § 8-211", sourceName: "Maryland General Assembly", sourceUrl: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=grp&section=8-211&enactments=false" }),
  info({ id: "MD-8-208.1", jurisdiction: "MD", topic: "retaliation", topics: ["retaliation", "represalia"], titleEn: "Maryland retaliatory action", titleEs: "Acción de represalia en Maryland", summaryEn: `Section 8-208.1 prohibits a possession action, an arbitrary rent increase, a service cut, or ending a periodic tenancy because of listed tenant acts. An act more than six months later is not deemed retaliatory under this section. It is not a finding. Checked ${CHECKED}.`, summaryEs: `La sección 8-208.1 cubre seis meses. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "Md. Code, Real Prop. § 8-208.1", sourceName: "Maryland General Assembly", sourceUrl: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=grp&section=8-208.1&enactments=false" }),
  info({ id: "MD-8-209", jurisdiction: "MD", topic: "rent-increase", topics: ["rent increase", "aumento de renta"], titleEn: "Maryland rent-increase notice", titleEs: "Aviso de aumento en Maryland", summaryEn: `Section 8-209 requires 90, 60, 7, or 21 days' written notice depending on the tenancy length. The length was not entered, so no period was graded. There is no statewide percentage cap. Montgomery County and Takoma Park rent stabilization were not applied. Checked ${CHECKED}.`, summaryEs: `La sección 8-209 exige un aviso según el plazo. No se calificó. No se aplicó Montgomery County ni Takoma Park. Revisado el ${CHECKED_ES}.`, citation: "Md. Code, Real Prop. § 8-209", sourceName: "Maryland General Assembly", sourceUrl: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=grp&section=8-209&enactments=false" }),
  info({ id: "MN-504B.178", jurisdiction: "MN", topic: "deposit", topics: ["security deposit", "deposito", "depósito"], titleEn: "Minnesota security deposit", titleEs: "Depósito en Minnesota", summaryEn: `Section 504B.178 requires return or a written statement within three weeks after termination, after the landlord receives a mailing address. The opened section states no maximum number of months. Interest is one percent simple interest. Checked ${CHECKED}.`, summaryEs: `La sección 504B.178 da tres semanas después de recibir una dirección. No fija un máximo de meses. Revisado el ${CHECKED_ES}.`, citation: "Minn. Stat. § 504B.178", sourceName: "Minnesota Office of the Revisor of Statutes", sourceUrl: "https://www.revisor.mn.gov/statutes/cite/504B.178" }),
  info({ id: "MN-504B.161", jurisdiction: "MN", topic: "repair", topics: ["repair", "habitability", "reparacion", "reparación", "heat"], titleEn: "Minnesota covenants of repair", titleEs: "Reparación en Minnesota", summaryEn: `Section 504B.161 requires fit premises and reasonable repair, and heat of at least 68 degrees from October 1 through April 30. It states no repair day count and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 504B.161 no fija un plazo de reparación y exige 68 grados en la temporada de calor. Revisado el ${CHECKED_ES}.`, citation: "Minn. Stat. § 504B.161", sourceName: "Minnesota Office of the Revisor of Statutes", sourceUrl: "https://www.revisor.mn.gov/statutes/cite/504B.161" }),
  info({ id: "MN-504B.212", jurisdiction: "MN", topic: "retaliation", topics: ["retaliation", "represalia"], titleEn: "Minnesota retaliation burden", titleEs: "Carga de la represalia en Minnesota", summaryEn: `Section 504B.212 prohibits a retaliatory rent increase, service cut, or possession action after listed tenant acts. Within 90 days the landlord has the burden of proof. It is not a finding. Checked ${CHECKED}.`, summaryEs: `La sección 504B.212 pone la carga en el propietario dentro de 90 días. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "Minn. Stat. § 504B.212", sourceName: "Minnesota Office of the Revisor of Statutes", sourceUrl: "https://www.revisor.mn.gov/statutes/cite/504B.212" }),
  info({ id: "MN-504B.147", jurisdiction: "MN", topic: "rent-increase", topics: ["rent increase", "aumento de renta"], titleEn: "Minnesota rent-increase notice", titleEs: "Aviso de aumento en Minnesota", summaryEn: `Section 504B.147 does not set a statewide percentage cap or a fixed number of days. A landlord's increase notice cannot be shorter than the tenant's quit notice in the lease. Those periods were not entered. St. Paul and Minneapolis rent stabilization were not applied. Checked ${CHECKED}.`, summaryEs: `La sección 504B.147 no fija un tope ni un número de días. No se aplicó St. Paul ni Minneapolis. Revisado el ${CHECKED_ES}.`, citation: "Minn. Stat. § 504B.147", sourceName: "Minnesota Office of the Revisor of Statutes", sourceUrl: "https://www.revisor.mn.gov/statutes/cite/504B.147" }),
  info({ id: "WI-704.28", jurisdiction: "WI", topic: "deposit", topics: ["security deposit", "deposito", "depósito"], titleEn: "Wisconsin security deposit", titleEs: "Depósito en Wisconsin", summaryEn: `Section 704.28 requires the deposit, less lawful withholdings, within 21 days after one of three events. Normal wear and tear may not be withheld. The opened section states no maximum number of months. Checked ${CHECKED}.`, summaryEs: `La sección 704.28 da 21 días desde uno de tres hechos. No fija un máximo de meses. Revisado el ${CHECKED_ES}.`, citation: "Wis. Stat. § 704.28", sourceName: "Wisconsin Legislature", sourceUrl: "https://docs.legis.wisconsin.gov/document/statutes/704.28" }),
  info({ id: "WI-704.07", jurisdiction: "WI", topic: "repair", topics: ["repair", "habitability", "reparacion", "reparación"], titleEn: "Wisconsin repair duty", titleEs: "Deber de reparación en Wisconsin", summaryEn: `Section 704.07 requires reasonable repair of premises and equipment the landlord controls, structural repairs, and compliance with a local housing code. It states no day count and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 704.07 no fija días y no es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Wis. Stat. § 704.07", sourceName: "Wisconsin Legislature", sourceUrl: "https://docs.legis.wisconsin.gov/document/statutes/704.07" }),
  info({ id: "WI-704.45", jurisdiction: "WI", topic: "retaliation", topics: ["retaliation", "represalia"], titleEn: "Wisconsin retaliatory conduct", titleEs: "Conducta de represalia en Wisconsin", summaryEn: `Section 704.45 prohibits a retaliatory rent increase, service cut, possession action, or nonrenewal. It states no number of days. A tenant-caused defect and unpaid rent are exceptions. It is not a finding. Checked ${CHECKED}.`, summaryEs: `La sección 704.45 no fija días. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "Wis. Stat. § 704.45", sourceName: "Wisconsin Legislature", sourceUrl: "https://docs.legis.wisconsin.gov/document/statutes/704.45" }),
  info({ id: "WI-704.19", jurisdiction: "WI", topic: "rent-increase", topics: ["rent increase", "aumento de renta"], titleEn: "Wisconsin periodic termination notice", titleEs: "Aviso para terminar en Wisconsin", summaryEn: `Chapter 704, as opened on ${CHECKED}, states no statewide percentage cap and no rent-increase notice period. Section 704.19 generally requires 28 days to end a periodic tenancy. That notice was not graded as a rent increase. Checked ${CHECKED}.`, summaryEs: `El capítulo abierto no fija un tope ni un aviso de aumento. La sección 704.19 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`, citation: "Wis. Stat. § 704.19", sourceName: "Wisconsin Legislature", sourceUrl: "https://docs.legis.wisconsin.gov/document/statutes/704.19" }),
];
