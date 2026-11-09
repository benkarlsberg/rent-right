import { addDays, addMonths, daysBetween } from "@/lib/rules/dates";
import { rule, type Rule } from "@/lib/rules/define";

const CHECKED = "Nov 9, 2026";
const CHECKED_ES = "9 de noviembre de 2026";

type Stamp = {
  dueDate: string | null;
  ruleId: string;
  citation: string;
  explanation: string;
  explanationEs: string;
  computation: string;
  unsure: boolean;
};

function ppm(lowestCents: number, proposedCents: number): string {
  const value = Math.round(((proposedCents - lowestCents) * 1_000_000) / lowestCents);
  return (value / 10_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function info(input: {
  id: string;
  jurisdiction: "TX" | "FL";
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

export function txDeposit(triggerDate: string): Stamp {
  const due = addDays(triggerDate, 30);
  return {
    dueDate: due,
    ruleId: "TX-PROP-92.103",
    citation: "Tex. Prop. Code § 92.103",
    unsure: false,
    computation: `${triggerDate} + 30 calendar days = ${due}. Weekends were not skipped.`,
    explanation: `Property Code § 92.103(a) says the landlord shall refund the security deposit on or before the 30th day after the tenant surrenders the premises. Using ${triggerDate} as that surrender date, the date is ${due}. § 92.107 says the landlord is not obligated to return the deposit or an itemization until the tenant gives a written forwarding address. That condition was not confirmed. § 92.102 defines a security deposit and does not state a maximum number of months. Checked ${CHECKED}. This is not a decision about what may be deducted.`,
    explanationEs: `El Código de Propiedad § 92.103(a) dice que el depósito se devuelve a más tardar el día 30 después de que el inquilino entrega la vivienda. Si ${triggerDate} es esa entrega, la fecha es ${due}. La sección 92.107 exige una dirección de reenvío por escrito antes de esa obligación. No se confirmó. Revisado el ${CHECKED_ES}.`,
  };
}

export function txRepair(requestDate: string): Stamp {
  const due = addDays(requestDate, 7);
  return {
    dueDate: due,
    ruleId: "TX-PROP-92.056",
    citation: "Tex. Prop. Code § 92.056",
    unsure: true,
    computation: `Receipt ${requestDate} + 7 calendar days = ${due}. This is the rebuttable presumption in § 92.056(d), not a fixed deadline.`,
    explanation: `Property Code § 92.056(d) says there is a rebuttable presumption that seven days is a reasonable time to repair or remedy after the landlord receives notice. Counted from ${requestDate}, that presumption date is ${due}. The statute says the date received, the severity, and the availability of materials, labor, and utilities must be considered to rebut it. This date is not permission to repair and deduct or to end the lease. Those remedies in § 92.056(e) and § 92.0561 require the rest of § 92.056(b), including the notice path, a diligent effort that was not made, and that rent was not delinquent when notice was given. Checked ${CHECKED}.`,
    explanationEs: `La sección 92.056(d) dice que hay una presunción refutable de que siete días es un tiempo razonable después de que el propietario recibe el aviso. Desde ${requestDate}, esa fecha es ${due}. No autoriza reparar y descontar ni terminar el contrato. Esos remedios exigen el resto de la sección 92.056(b). Revisado el ${CHECKED_ES}.`,
  };
}

export function txRetaliation(activityDate: string, noticeDate: string, daysSince: number): Stamp & { flagged: boolean; daysSince: number } {
  const end = addMonths(activityDate, 6);
  const flagged = daysSince >= 0 && noticeDate <= end;
  return {
    flagged,
    daysSince,
    dueDate: null,
    ruleId: "TX-PROP-92.331",
    citation: "Tex. Prop. Code § 92.331",
    unsure: false,
    computation: `${activityDate} plus six calendar months = ${end}.`,
    explanation: flagged
      ? `The later date is ${daysSince} days after the earlier one, and not after ${end}. § 92.331(b) says a landlord may not, within six months after a listed tenant act, retaliate by filing an eviction, cutting use or services, increasing rent, ending the lease, or a bad-faith course of conduct. § 92.332 lists acts that are not retaliation, including a utility, tax, or insurance escalation clause and a pattern of increases for a whole project, and several eviction grounds. A date inside six months is not a finding. Checked ${CHECKED}.`
      : `The later date is outside six calendar months after the earlier date (${end}). Being outside § 92.331(b) is not a finding that the act was lawful. Checked ${CHECKED}.`,
    explanationEs: flagged
      ? `La fecha posterior está dentro de seis meses (${end}). La sección 92.331(b) prohíbe ciertas represalias en ese período. No es una conclusión. Revisado el ${CHECKED_ES}.`
      : `La fecha posterior está fuera de seis meses (${end}). Estar fuera no significa que el acto sea lícito. Revisado el ${CHECKED_ES}.`,
  };
}

export function txRent(lowestCents: number, proposedCents: number) {
  const percent = ppm(lowestCents, proposedCents);
  return {
    headlineEn: "Texas rent increase",
    headlineEs: "Aumento de renta en Texas",
    ruleId: "TX-PROP-92.331",
    abovePublishedMax: false,
    detailEn: `The increase from the amounts entered is about ${percent}%. The Texas State Law Library page opened on ${CHECKED} says state law does not cap the amount of an increase once a lease term is over, and that rent cannot be raised during the term unless the tenant agrees. It does not state a statewide number of days for an increase notice. No notice period was graded. A retaliatory increase is a separate limit under Property Code § 92.331. Property Code § 214.902 allows a local rent-control ordinance only after a disaster and with the governor's approval. No such ordinance was researched, and no city ordinance was applied.`,
    detailEs: `El aumento es de alrededor del ${percent}%. La Biblioteca de Derecho del Estado dice que la ley estatal no limita el monto al terminar el contrato, y que no se puede subir la renta durante el plazo salvo acuerdo. No se calificó un plazo de aviso. No se aplicó una ordenanza local. Revisado el ${CHECKED_ES}.`,
  };
}

export function flDeposit(triggerDate: string): Stamp {
  const noClaim = addDays(triggerDate, 15);
  const claimNotice = addDays(triggerDate, 30);
  return {
    dueDate: null,
    ruleId: "FL-STAT-83.49",
    citation: "Fla. Stat. § 83.49",
    unsure: true,
    computation: `Termination ${triggerDate}. No-claim return would be ${noClaim}. A claim notice would be due ${claimNotice}. Neither date was stored because whether the landlord intends a claim was not entered.`,
    explanation: `Section 83.49(3)(a) gives two different clocks after termination of the rental agreement. If the landlord does not intend to impose a claim, the deposit must be returned within 15 days (${noClaim} if ${triggerDate} is the termination). If the landlord does intend a claim, written notice by certified mail or by the statute's e-mail method is due within 30 days (${claimNotice}). The tenant then has 15 days after receiving that notice to object. Which clock applies was not entered, so no single due date was stored. The opened section does not state a maximum number of months of deposit. If the tenant left early without the 7-day notice in § 83.49(5), the landlord's notice duty can change. Checked ${CHECKED}.`,
    explanationEs: `La sección 83.49(3)(a) tiene dos plazos después de la terminación: 15 días si no hay reclamo, y 30 días para avisar un reclamo. No se indicó cuál aplica, así que no se guardó una sola fecha. Revisado el ${CHECKED_ES}.`,
  };
}

export function flRepair(): Stamp {
  return {
    dueDate: null,
    ruleId: "FL-STAT-83.56",
    citation: "Fla. Stat. § 83.56",
    unsure: true,
    computation: "No calendar date stored. § 83.51 states maintenance duties without one day count. § 83.56(1) and § 83.201 are remedy paths with their own prerequisites.",
    explanation: `Section 83.51 requires the landlord to comply with building, housing, and health codes, or to maintain stated structural parts and plumbing where no code applies, with extra duties for a dwelling that is not a single-family home or duplex. It does not set one repair deadline. Section 83.56(1) lets the tenant terminate if the landlord materially fails to comply with § 83.51(1) or a material lease term within 7 days after delivery of a written notice that specifies the failure and says the tenant intends to terminate. Section 83.201 allows withholding rent only when the lease is silent on the repair procedure, expressly puts the repair on the landlord, the premises are wholly untenantable, and the tenant gives at least 20 days' written notice. Neither period was stored as a repair deadline, and neither is permission to withhold rent or end the tenancy unless those prerequisites are met. Checked ${CHECKED}.`,
    explanationEs: `La sección 83.51 no fija un solo plazo de reparación. La sección 83.56(1) permite terminar si hay un incumplimiento importante dentro de 7 días después de un aviso escrito que dice la intención de terminar. La sección 83.201 permite retener la renta solo con requisitos aparte y al menos 20 días. No se guardó una fecha como plazo general ni como permiso. Revisado el ${CHECKED_ES}.`,
  };
}

export function flRetaliation(daysSince: number): Stamp & { flagged: boolean; daysSince: number } {
  return {
    flagged: false,
    daysSince,
    dueDate: null,
    ruleId: "FL-STAT-83.64",
    citation: "Fla. Stat. § 83.64",
    unsure: true,
    computation: "No day count. § 83.64 does not state a number of days.",
    explanation: `Section 83.64 makes it unlawful to discriminatorily increase rent, decrease services, or bring or threaten a possession action primarily because of listed good-faith tenant acts. The section does not state a number of days, so no date was flagged. It does not apply if the landlord proves good cause, with examples that include nonpayment and a violation of the rental agreement. A date match is not a finding. Checked ${CHECKED}.`,
    explanationEs: `La sección 83.64 prohíbe un aumento discriminatorio, una reducción de servicios o una acción de posesión principalmente por represalia. No fija un número de días, así que no se marcó una fecha. Revisado el ${CHECKED_ES}.`,
  };
}

export function flRent(lowestCents: number, proposedCents: number) {
  const percent = ppm(lowestCents, proposedCents);
  return {
    headlineEn: "Florida rent increase",
    headlineEs: "Aumento de renta en Florida",
    ruleId: "FL-STAT-83.57",
    abovePublishedMax: false,
    detailEn: `The increase from the amounts entered is about ${percent}%. The Florida residential chapter opened on ${CHECKED} does not state a statewide percentage cap. Section 83.425 preempts local regulation of matters the part covers, including notice requirements. Section 83.57 is not a rent-increase rule. It is how either party terminates a tenancy without a specific term: at least 15 days before the end of a monthly period, 7 days for week to week, 45 days for quarter to quarter, and 3 months for year to year. Those periods were not graded as a rent-increase notice. A retaliatory increase is a separate limit under § 83.64. No city ordinance was applied.`,
    detailEs: `El aumento es de alrededor del ${percent}%. El capítulo residencial no fija un tope estatal. La sección 83.425 impide reglas locales sobre los temas que cubre, incluido el aviso. La sección 83.57 es para terminar un arrendamiento sin plazo fijo, no para calificar un aumento. No se aplicó una ordenanza local. Revisado el ${CHECKED_ES}.`,
  };
}

export function batchRepairLetter(state: "TX" | "FL", locale: "en" | "es"): string {
  if (state === "TX") {
    return locale === "es"
      ? "Le pido que atienda esta reparación. El Código de Propiedad de Texas § 92.056 tiene una presunción refutable de siete días como tiempo razonable después de recibir el aviso. Esta carta no es un aviso de que termino el contrato ni de que repararé y descontaré. Confirmo este mensaje antes de enviarlo."
      : "I am asking you to address this repair. Texas Property Code § 92.056 has a rebuttable presumption that seven days is a reasonable time after you receive notice. This letter is not a notice that I am ending the lease or repairing and deducting. I confirm this message before it is sent.";
  }
  return locale === "es"
    ? "Le pido que atienda esta reparación. El estatuto de Florida § 83.51 no fija un solo plazo. Esta carta no es un aviso de terminación bajo § 83.56 ni un aviso para retener la renta bajo § 83.201. Confirmo este mensaje antes de enviarlo."
    : "I am asking you to address this repair. Florida Statutes § 83.51 does not set one repair deadline. This letter is not a termination notice under § 83.56 and it is not a notice that I will withhold rent under § 83.201. I confirm this message before it is sent.";
}

export const TX_RULES: Rule[] = [
  info({
    id: "TX-PROP-92.103",
    jurisdiction: "TX",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "Texas security deposit refund",
    titleEs: "Devolución del depósito en Texas",
    summaryEn: `Property Code § 92.103(a) requires the refund on or before the 30th day after surrender. § 92.104 allows deductions for lawful damages and charges, not normal wear and tear, and requires an itemized description if any amount is kept. § 92.107 says the landlord is not obligated until the tenant gives a written forwarding address. § 92.102 does not state a maximum number of months. Checked ${CHECKED} on statutes.capitol.texas.gov.`,
    summaryEs: `La sección 92.103(a) exige la devolución a más tardar el día 30 después de la entrega. La sección 92.107 exige una dirección de reenvío por escrito. No se fijó un máximo de meses. Revisado el ${CHECKED_ES}.`,
    citation: "Tex. Prop. Code § 92.103",
    sourceName: "Texas Constitution and Statutes",
    sourceUrl: "https://statutes.capitol.texas.gov/GetStatute.aspx?Code=PR&Value=92.103",
  }),
  info({
    id: "TX-PROP-92.056",
    jurisdiction: "TX",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "Texas repair presumption",
    titleEs: "Presunción de reparación en Texas",
    summaryEn: `Property Code § 92.056(d) creates a rebuttable presumption that seven days is a reasonable time to repair after the landlord receives notice. The presumption considers the date received, severity, and availability of materials, labor, and utilities. Repair-and-deduct or termination under § 92.056(e) requires the rest of subsection (b), including the notice path and that rent was not delinquent. The seven days are not permission to take those steps. Checked ${CHECKED}.`,
    summaryEs: `La sección 92.056(d) crea una presunción refutable de siete días como tiempo razonable después de recibir el aviso. Reparar y descontar o terminar exige el resto de la sección. Revisado el ${CHECKED_ES}.`,
    citation: "Tex. Prop. Code § 92.056",
    sourceName: "Texas Constitution and Statutes",
    sourceUrl: "https://statutes.capitol.texas.gov/GetStatute.aspx?Code=PR&Value=92.056",
  }),
  info({
    id: "TX-PROP-92.331",
    jurisdiction: "TX",
    topic: "retaliation",
    topics: ["retaliation", "represalia", "rent increase"],
    titleEn: "Texas retaliation window",
    titleEs: "Ventana de represalia en Texas",
    summaryEn: `Property Code § 92.331(b) prohibits listed retaliatory acts within six months after a protected tenant act, including a repair notice, a good-faith code or utility complaint, or tenant organizing. Increasing rent and ending the lease are listed acts. § 92.332 names exceptions, including an escalation clause and a project-wide pattern, and several eviction grounds. A date inside six months is not a finding. The State Law Library says there is no statewide cap on the amount after a lease term ends, and no increase during the term unless the tenant agrees. Checked ${CHECKED}.`,
    summaryEs: `La sección 92.331(b) prohíbe actos de represalia enumerados dentro de seis meses, incluido subir la renta. La sección 92.332 nombra excepciones. No hay un tope estatal del monto al terminar el plazo. Revisado el ${CHECKED_ES}.`,
    citation: "Tex. Prop. Code § 92.331",
    sourceName: "Texas State Law Library",
    sourceUrl: "https://www.sll.texas.gov/faqs/rent-increase/",
  }),
];

export const FL_RULES: Rule[] = [
  info({
    id: "FL-STAT-83.49",
    jurisdiction: "FL",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "Florida security deposit clocks",
    titleEs: "Plazos del depósito en Florida",
    summaryEn: `Section 83.49(3)(a) requires return within 15 days after termination if the landlord does not intend a claim, and a certified-mail or statutory e-mail notice within 30 days if the landlord does intend a claim. The tenant has 15 days after receiving that notice to object. The section does not state a maximum number of months. Both clocks are stated because which one applies was not assumed. Checked ${CHECKED} on the Legislature's chapter 83 page.`,
    summaryEs: `La sección 83.49(3)(a) exige devolver en 15 días si no hay reclamo, y avisar en 30 días si lo hay. No se asumió cuál aplica. Revisado el ${CHECKED_ES}.`,
    citation: "Fla. Stat. § 83.49",
    sourceName: "Florida Legislature",
    sourceUrl: "https://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/0083.html",
  }),
  info({
    id: "FL-STAT-83.56",
    jurisdiction: "FL",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "Florida maintenance and notice paths",
    titleEs: "Mantenimiento y avisos en Florida",
    summaryEn: `Section 83.51 states the landlord's maintenance duties and does not set one repair deadline. Section 83.56(1) is a termination path: 7 days after delivery of a written notice that specifies the noncompliance and the intention to terminate. Section 83.201 is a withholding path only when the lease is silent, the repair duty is expressly the landlord's, the premises are wholly untenantable, and the tenant gives at least 20 days' notice. Neither path was stored as a general repair deadline or as permission. Checked ${CHECKED}.`,
    summaryEs: `La sección 83.51 no fija un solo plazo. La sección 83.56(1) es para terminar con un aviso de 7 días. La sección 83.201 es para retener la renta solo con requisitos aparte. Revisado el ${CHECKED_ES}.`,
    citation: "Fla. Stat. §§ 83.51, 83.56, 83.201",
    sourceName: "Florida Legislature",
    sourceUrl: "https://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/0083.html",
  }),
  info({
    id: "FL-STAT-83.64",
    jurisdiction: "FL",
    topic: "retaliation",
    topics: ["retaliation", "represalia"],
    titleEn: "Florida retaliatory conduct",
    titleEs: "Conducta de represalia en Florida",
    summaryEn: `Section 83.64 prohibits a discriminatory rent increase, a decrease in services, or a possession action primarily because of listed good-faith tenant acts. It states no number of days. It does not apply if the landlord proves good cause. A date match was not flagged. Checked ${CHECKED}.`,
    summaryEs: `La sección 83.64 prohíbe un aumento discriminatorio o una acción de posesión principalmente por represalia. No fija días. Revisado el ${CHECKED_ES}.`,
    citation: "Fla. Stat. § 83.64",
    sourceName: "Florida Legislature",
    sourceUrl: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/Sections/0083.64.html",
  }),
  info({
    id: "FL-STAT-83.57",
    jurisdiction: "FL",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta"],
    titleEn: "Florida rent change and periodic termination",
    titleEs: "Cambio de renta y terminación periódica en Florida",
    summaryEn: `The residential part opened on ${CHECKED} does not state a statewide percentage cap. Section 83.425 preempts local rules on covered matters, including notice. Section 83.57 tells either party how to end a tenancy without a specific term: 15 days before the end of a monthly period, 7 days for week to week, 45 days for a quarter, and 3 months for a year. It was not used as a rent-increase grade. Checked ${CHECKED}.`,
    summaryEs: `La parte residencial no fija un tope estatal. La sección 83.57 dice cómo terminar un arrendamiento sin plazo fijo. No se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`,
    citation: "Fla. Stat. § 83.57",
    sourceName: "Florida Legislature",
    sourceUrl: "https://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/0083.html",
  }),
];
