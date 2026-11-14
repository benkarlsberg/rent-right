import { addDays } from "@/lib/rules/dates";
import { rule, type Rule } from "@/lib/rules/define";

const CHECKED = "Nov 14, 2026";
const CHECKED_ES = "14 de noviembre de 2026";
export const RETRY_STATES = ["AL", "MO", "OK", "UT"] as const;
export type RetryState = (typeof RETRY_STATES)[number];

type Stamp = {
  dueDate: string | null;
  ruleId: string;
  citation: string;
  explanation: string;
  explanationEs: string;
  computation: string;
  unsure: boolean;
};

export function isRetry(state: string): state is RetryState {
  return (RETRY_STATES as readonly string[]).includes(state);
}

function percent(lowestCents: number, proposedCents: number): string {
  const value = Math.round(((proposedCents - lowestCents) * 1_000_000) / lowestCents);
  return (value / 10_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function info(input: {
  id: string; jurisdiction: RetryState; topic: string; topics: string[];
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

export function retryDeposit(state: string, triggerDate: string): Stamp | null {
  if (!isRetry(state)) return null;
  if (state === "AL") {
    const due = addDays(triggerDate, 60);
    return {
      dueDate: due, ruleId: "AL-35-9A-201", citation: "Ala. Code § 35-9A-201", unsure: true,
      computation: `${triggerDate} + 60 days = ${due}. The statute also requires delivery of possession and a forwarding address.`,
      explanation: `Section 35-9A-201 limits a security deposit to one month's periodic rent, with separate amounts allowed for pets, changes to the premises, or increased liability. The itemized list and the amount due are delivered 60 days after termination and delivery of possession. Using ${triggerDate}, the date is ${due}. It is unsure because delivery of possession and the forwarding address were not entered separately. If no forwarding address is given, the landlord mails to the last known address. An unclaimed deposit is forfeited after 90 days. Checked ${CHECKED}.`,
      explanationEs: `La sección 35-9A-201 limita el depósito a un mes y da 60 días. La fecha es incierta. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MO") {
    const due = addDays(triggerDate, 30);
    return {
      dueDate: due, ruleId: "MO-535.300", citation: "Mo. Rev. Stat. § 535.300", unsure: false,
      computation: `${triggerDate} + 30 days = ${due}.`,
      explanation: `Section 535.300 limits a security deposit to two months' rent. Within 30 days after termination, the landlord shall return the deposit or mail a written itemized list of damages and the balance to the last known address. Using ${triggerDate} as termination, the date is ${due}. Ordinary wear and tear is excluded. A pet deposit is not a security deposit under this section. The tenant may not apply the deposit in place of rent. Checked ${CHECKED}.`,
      explanationEs: `La sección 535.300 limita el depósito a dos meses y da 30 días después de la terminación. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "OK") {
    const due = addDays(triggerDate, 45);
    return {
      dueDate: due, ruleId: "OK-41-115", citation: "Okla. Stat. tit. 41, § 115", unsure: true,
      computation: `${triggerDate} + 45 days = ${due}. The clock also requires delivery of possession and a written demand.`,
      explanation: `Section 115, as published on OSCN for 2026, returns any balance within 45 days after termination, delivery of possession, and a written demand by the tenant. Using ${triggerDate} as that point, the date is ${due}. It is unsure because possession and the written demand were not entered separately. If the tenant does not demand the deposit within six months after termination, it reverts to the landlord. The opened section does not state a maximum number of months. No interest is paid. Checked ${CHECKED}.`,
      explanationEs: `La sección 115 da 45 días después de la terminación, la entrega y un requerimiento escrito. La fecha es incierta. Revisado el ${CHECKED_ES}.`,
    };
  }
  const due = addDays(triggerDate, 30);
  return {
    dueDate: due, ruleId: "UT-57-17-3", citation: "Utah Code § 57-17-3", unsure: true,
    computation: `${triggerDate} + 30 days = ${due}. The statute counts from the day the renter vacates and returns possession.`,
    explanation: `Section 57-17-3 says the owner shall mail or deliver the balance of any deposit and prepaid rent, with a written itemization of each deduction, no later than 30 days after the day the renter vacates and returns possession. Using ${triggerDate} as that day, the date is ${due}. It is unsure because return of possession was not entered separately. Deductions may cover rent, damage beyond reasonable wear and tear, contracted costs, or cleaning. The opened chapter does not state a maximum number of months. A nonrefundable part must be stated in writing when the deposit is taken. Checked ${CHECKED}.`,
    explanationEs: `La sección 57-17-3 da 30 días después de que el inquilino entrega la vivienda. La fecha es incierta. Revisado el ${CHECKED_ES}.`,
  };
}

export function retryRepair(state: string, requestDate: string): Stamp | null {
  if (!isRetry(state)) return null;
  const base = { dueDate: null as string | null, unsure: true, computation: `Notice ${requestDate}. No single repair date was stored.` };
  if (state === "AL") return { ...base, ruleId: "AL-35-9A-204", citation: "Ala. Code § 35-9A-204", explanation: `Section 35-9A-204 requires a habitable premises and maintenance of supplied facilities, heat, and hot water. It states no repair day count. Section 35-9A-404 is a 14-day notice before ending the agreement when essential services are not supplied. That path was not stored as a repair deadline from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 35-9A-204 no fija un plazo. El aviso de 14 días es para terminar el contrato. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  if (state === "MO") return { ...base, ruleId: "MO-441.234", citation: "Mo. Rev. Stat. § 441.234", explanation: `Section 441.234 lets a tenant who has lived in the home for six consecutive months, stayed current on rent, and cured any written lease notice deduct the cost of a code violation that affects habitability, after 14 days' written notice, and only up to the lesser of $300 or one month's rent, with receipts. Those prerequisites were not entered, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 441.234 es un descuento limitado después de 14 días y solo si se cumplen varias condiciones. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  if (state === "OK") return { ...base, ruleId: "OK-41-118", citation: "Okla. Stat. tit. 41, § 118", explanation: `Section 118, as published on OSCN for 2026, requires the landlord to keep the dwelling fit and habitable and to maintain supplied systems. It states no repair day count, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 118 no fija días. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  return { ...base, ruleId: "UT-57-22-6", citation: "Utah Code § 57-22-6", explanation: `Section 57-22-3 requires a unit fit for human habitation, with electrical, heating, plumbing, and hot and cold water. Section 57-22-6 sets a corrective period of three calendar days for a habitability standard and 10 calendar days for a rental-agreement requirement, and 24 hours to start work on a dangerous condition. Those periods lead to rent abatement that ends the agreement, or to repair and deduct, only after a written notice that chooses the remedy and only if the renter is current under section 57-22-5. No date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `Los plazos de tres y diez días son remedios con requisitos previos. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
}

export function retryRetaliation(state: string, _activityDate: string, _noticeDate: string, daysSince: number): (Stamp & { flagged: boolean; daysSince: number }) | null {
  if (!isRetry(state)) return null;
  const common = { flagged: false as const, daysSince, dueDate: null as string | null, unsure: true };
  if (state === "AL") return { ...common, ruleId: "AL-35-9A-501", citation: "Ala. Code § 35-9A-501", computation: "No day count. Section 35-9A-501 does not state a number of days.", explanation: `Section 35-9A-501 says a landlord may not retaliate by discriminatorily increasing rent, decreasing services, or bringing or threatening a possession action after a code complaint, a complaint under section 35-9A-204, or tenant organizing. It states no number of days, so no date was flagged. Listed exceptions, including nonpayment, were not decided. It is not a finding. Checked ${CHECKED}.`, explanationEs: `La sección 35-9A-501 no fija días, así que no se marcó una fecha. No es una conclusión. Revisado el ${CHECKED_ES}.` };
  if (state === "MO") return { ...common, ruleId: "MO-441", citation: "Mo. Rev. Stat. ch. 441", computation: "No general day count in the residential sections opened.", explanation: `The residential sections opened on ${CHECKED}, including sections 441.060, 441.233, 441.234, and 535.300, do not state a general retaliation period, so no date was flagged. Section 441.920 protects a victim of domestic violence, sexual assault, or stalking and was not applied to an ordinary complaint. Section 213.040 is housing discrimination and was not used as a repair-complaint clock. It is not a finding. Checked ${CHECKED}.`, explanationEs: `Las secciones residenciales abiertas no fijan un plazo general de represalia. No se marcó una fecha. Revisado el ${CHECKED_ES}.` };
  if (state === "OK") return { ...common, ruleId: "OK-41-113.3", citation: "Okla. Stat. tit. 41, § 113.3", computation: "No general day count in the 2026 Residential Landlord and Tenant Act index.", explanation: `The 2026 OSCN index of the Residential Landlord and Tenant Act, sections 101 through 136 and 201, does not contain a general retaliation section, so no date was flagged. Section 113.3 says a landlord shall not retaliate because an applicant or tenant ended a prior agreement as a victim of domestic violence, sexual violence, or stalking. That section was not applied to an ordinary complaint. It is not a finding. Checked ${CHECKED}.`, explanationEs: `La ley de 2026 no tiene una sección general de represalia. La sección 113.3 no se aplicó a una queja ordinaria. Revisado el ${CHECKED_ES}.` };
  return { ...common, ruleId: "UT-57-22", citation: "Utah Code tit. 57, chs. 17 and 22", computation: "No general day count in the residential chapters opened.", explanation: `Title 57, chapters 17 and 22, as opened on ${CHECKED}, do not state a general retaliation period, so no date was flagged. Section 57-22-5.1 says an owner may not penalize or evict a renter for a reasonable request for help from a public safety agency. That limit was not applied to an ordinary repair complaint. It is not a finding. Checked ${CHECKED}.`, explanationEs: `Los capítulos residenciales abiertos no fijan un plazo general de represalia. No se marcó una fecha. Revisado el ${CHECKED_ES}.` };
}

export function retryRent(state: string, lowestCents: number, proposedCents: number) {
  if (!isRetry(state)) return null;
  const amount = percent(lowestCents, proposedCents);
  const base = { abovePublishedMax: false as const };
  const entered = `The increase from the amounts entered is about ${amount}%.`;
  if (state === "AL") return { ...base, headlineEn: "Alabama rent increase", headlineEs: "Aumento de renta en Alabama", ruleId: "AL-35-9A-161", detailEn: `${entered} Section 35-9A-161 lets the agreement set the rent and states no percentage cap and no rent-increase notice. No notice period was graded. A retaliatory increase is a separate limit under section 35-9A-501. Section 35-9A-121 says the chapter is statewide and that a county or municipality may not enact a residential landlord-tenant ordinance. Building and health codes that also apply to owner-occupied homes may still be enforced. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. La sección 35-9A-161 no fija un tope ni un aviso de aumento. Revisado el ${CHECKED_ES}.` };
  if (state === "MO") return { ...base, headlineEn: "Missouri rent increase", headlineEs: "Aumento de renta en Misuri", ruleId: "MO-441.060", detailEn: `${entered} The residential sections opened on ${CHECKED} do not state a percentage cap or a rent-increase notice. Section 441.060 requires one month's written notice to end a month-to-month tenancy. That notice ends the tenancy and was not graded as a rent increase. Section 215.314 applies to subsidized multifamily projects and was not applied. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. No hay un tope estatal. La sección 441.060 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.` };
  if (state === "OK") return { ...base, headlineEn: "Oklahoma rent increase", headlineEs: "Aumento de renta en Oklahoma", ruleId: "OK-41-109", detailEn: `${entered} Section 109, as published on OSCN for 2026, says rent is the amount agreed, or fair rental value if there is no agreement. It states no percentage cap and no rent-increase notice. Section 111 requires at least 30 days' written notice to end a month-to-month tenancy and at least 7 days when the tenancy is shorter. Those periods end the tenancy and were not graded as a rent increase. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. La sección 109 no fija un tope. La sección 111 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.` };
  return { ...base, headlineEn: "Utah rent increase", headlineEs: "Aumento de renta en Utah", ruleId: "UT-57-22-4", detailEn: `${entered} The Fit Premises Act, as opened on ${CHECKED}, does not state a percentage cap or a rent-increase notice. No notice period was graded. A 15-day notice applies only when a month-to-month agreement adds a fee that was not in the agreement. A late fee may not exceed the greater of 10 percent of the rent or $75, and that limit was not used as a rent cap. Section 57-22-7 says a county or municipality may not adopt an ordinance inconsistent with the chapter or change the corrective periods. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. El capítulo no fija un tope ni un aviso de aumento. Revisado el ${CHECKED_ES}.` };
}

export function retryRepairLetter(state: string, locale: "en" | "es"): string | null {
  if (!isRetry(state)) return null;
  const en: Record<RetryState, string> = {
    AL: "I am asking you to address this repair. Alabama Code § 35-9A-204 does not set a repair deadline. This letter is not a 14-day termination notice and it is not a notice that I am withholding rent. I confirm this message before it is sent.",
    MO: "I am asking you to address this repair. This letter is not a 14-day repair-and-deduct notice and it is not a notice that I am withholding rent. I confirm this message before it is sent.",
    OK: "I am asking you to address this repair. Oklahoma Statutes title 41, § 118 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
    UT: "I am asking you to address this repair. This letter does not choose a rent-abatement or repair-and-deduct remedy and it is not a notice that I am withholding rent. I confirm this message before it is sent.",
  };
  const es: Record<RetryState, string> = {
    AL: "Le pido que atienda esta reparación. Esta carta no es un aviso de 14 días para terminar el contrato ni un aviso de que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    MO: "Le pido que atienda esta reparación. Esta carta no es un aviso de 14 días para reparar y descontar ni un aviso de que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    OK: "Le pido que atienda esta reparación. El estatuto de Oklahoma no fija un número de días. Esta carta no avisa que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    UT: "Le pido que atienda esta reparación. Esta carta no elige un remedio de reducir la renta ni de reparar y descontar. Confirmo este mensaje antes de enviarlo.",
  };
  return locale === "es" ? es[state] : en[state];
}

const depositTopics = ["security deposit", "deposito", "depósito"];
const repairTopics = ["repair", "habitability", "reparacion", "reparación"];
const retalTopics = ["retaliation", "represalia"];
const rentTopics = ["rent increase", "aumento de renta"];

export const RETRY_RULES: Rule[] = [
  info({ id: "AL-35-9A-201", jurisdiction: "AL", topic: "deposit", topics: depositTopics, titleEn: "Alabama security deposit", titleEs: "Depósito en Alabama", summaryEn: `Section 35-9A-201 limits a deposit to one month's rent, with separate pet and premises-change amounts, and returns it 60 days after termination and delivery of possession. A forwarding address is required. Checked ${CHECKED}.`, summaryEs: `La sección 35-9A-201 limita el depósito a un mes y da 60 días. Revisado el ${CHECKED_ES}.`, citation: "Ala. Code § 35-9A-201", sourceName: "Alabama Legislature", sourceUrl: "https://alison.legislature.state.al.us/code-of-alabama?section=35-9A-201" }),
  info({ id: "AL-35-9A-204", jurisdiction: "AL", topic: "repair", topics: repairTopics, titleEn: "Alabama landlord maintenance", titleEs: "Mantenimiento en Alabama", summaryEn: `Section 35-9A-204 requires a habitable premises and maintenance of supplied facilities. It states no day count. The 14-day essential-services path ends the agreement and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 35-9A-204 no fija un plazo. No es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Ala. Code § 35-9A-204", sourceName: "Alabama Legislature", sourceUrl: "https://alison.legislature.state.al.us/code-of-alabama?section=35-9A-204" }),
  info({ id: "AL-35-9A-501", jurisdiction: "AL", topic: "retaliation", topics: retalTopics, titleEn: "Alabama retaliatory conduct", titleEs: "Conducta de represalia en Alabama", summaryEn: `Section 35-9A-501 prohibits a retaliatory rent increase, service cut, or possession action after a listed complaint or tenant organizing. It states no number of days. It is not a finding. Checked ${CHECKED}.`, summaryEs: `La sección 35-9A-501 no fija días. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "Ala. Code § 35-9A-501", sourceName: "Alabama Legislature", sourceUrl: "https://alison.legislature.state.al.us/code-of-alabama?section=35-9A-501" }),
  info({ id: "AL-35-9A-161", jurisdiction: "AL", topic: "rent-increase", topics: rentTopics, titleEn: "Alabama rent terms", titleEs: "Renta en Alabama", summaryEn: `Section 35-9A-161 lets the agreement set the rent and states no percentage cap or rent-increase notice. Section 35-9A-121 makes the chapter statewide and bars local residential landlord-tenant ordinances. Checked ${CHECKED}.`, summaryEs: `La sección 35-9A-161 no fija un tope ni un aviso de aumento. Revisado el ${CHECKED_ES}.`, citation: "Ala. Code § 35-9A-161", sourceName: "Alabama Legislature", sourceUrl: "https://alison.legislature.state.al.us/code-of-alabama?section=35-9A-161" }),
  info({ id: "MO-535.300", jurisdiction: "MO", topic: "deposit", topics: depositTopics, titleEn: "Missouri security deposit", titleEs: "Depósito en Misuri", summaryEn: `Section 535.300 limits a deposit to two months' rent and requires return or an itemized list within 30 days after termination. Ordinary wear and tear is excluded. A pet deposit is separate. Checked ${CHECKED}.`, summaryEs: `La sección 535.300 limita el depósito a dos meses y da 30 días. Revisado el ${CHECKED_ES}.`, citation: "Mo. Rev. Stat. § 535.300", sourceName: "Missouri Revisor of Statutes", sourceUrl: "https://revisor.mo.gov/main/OneSection.aspx?section=535.300" }),
  info({ id: "MO-441.234", jurisdiction: "MO", topic: "repair", topics: repairTopics, titleEn: "Missouri repair deduction", titleEs: "Deducción por reparación en Misuri", summaryEn: `Section 441.234 is a limited repair-and-deduct path after 14 days for a tenant who has lived there six months and stayed current. It is not a general repair deadline and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 441.234 es un descuento limitado. No es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Mo. Rev. Stat. § 441.234", sourceName: "Missouri Revisor of Statutes", sourceUrl: "https://revisor.mo.gov/main/OneSection.aspx?section=441.234" }),
  info({ id: "MO-441", jurisdiction: "MO", topic: "retaliation", topics: retalTopics, titleEn: "Missouri retaliation", titleEs: "Represalia en Misuri", summaryEn: `The residential landlord-tenant sections opened do not state a general retaliation period. Section 441.920 applies to victims of domestic violence, sexual assault, or stalking and was not applied to an ordinary complaint. Checked ${CHECKED}.`, summaryEs: `Las secciones abiertas no fijan un plazo general de represalia. Revisado el ${CHECKED_ES}.`, citation: "Mo. Rev. Stat. ch. 441", sourceName: "Missouri Revisor of Statutes", sourceUrl: "https://revisor.mo.gov/main/OneSection.aspx?section=441.920" }),
  info({ id: "MO-441.060", jurisdiction: "MO", topic: "rent-increase", topics: rentTopics, titleEn: "Missouri rent change", titleEs: "Cambio de renta en Misuri", summaryEn: `The residential sections opened do not state a percentage cap or a rent-increase notice. Section 441.060's one-month notice ends a month-to-month tenancy and was not graded as a rent increase. Checked ${CHECKED}.`, summaryEs: `No hay un tope estatal. La sección 441.060 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`, citation: "Mo. Rev. Stat. § 441.060", sourceName: "Missouri Revisor of Statutes", sourceUrl: "https://revisor.mo.gov/main/OneSection.aspx?section=441.060" }),
  info({ id: "OK-41-115", jurisdiction: "OK", topic: "deposit", topics: depositTopics, titleEn: "Oklahoma security deposit", titleEs: "Depósito en Oklahoma", summaryEn: `The 2026 text of section 115 returns a balance within 45 days after termination, delivery of possession, and a written demand. It states no maximum number of months. A demand not made within six months ends the tenant's interest. Checked ${CHECKED}.`, summaryEs: `La sección 115 de 2026 da 45 días después del requerimiento. No fija un máximo de meses. Revisado el ${CHECKED_ES}.`, citation: "Okla. Stat. tit. 41, § 115", sourceName: "Oklahoma State Courts Network", sourceUrl: "https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=71764" }),
  info({ id: "OK-41-118", jurisdiction: "OK", topic: "repair", topics: repairTopics, titleEn: "Oklahoma landlord duties", titleEs: "Deberes del propietario en Oklahoma", summaryEn: `The 2026 text of section 118 requires a fit and habitable dwelling and maintenance of supplied systems. It states no day count and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 118 de 2026 no fija días y no es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Okla. Stat. tit. 41, § 118", sourceName: "Oklahoma State Courts Network", sourceUrl: "https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=71767" }),
  info({ id: "OK-41-113.3", jurisdiction: "OK", topic: "retaliation", topics: retalTopics, titleEn: "Oklahoma retaliation", titleEs: "Represalia en Oklahoma", summaryEn: `The 2026 act index has no general retaliation section. Section 113.3 applies when a victim ended a prior agreement and was not applied to an ordinary complaint. Checked ${CHECKED}.`, summaryEs: `La ley de 2026 no tiene una sección general de represalia. Revisado el ${CHECKED_ES}.`, citation: "Okla. Stat. tit. 41, § 113.3", sourceName: "Oklahoma State Courts Network", sourceUrl: "https://www.oscn.net/applications/oscn/index.asp?ftdb=STOKST41&level=1" }),
  info({ id: "OK-41-109", jurisdiction: "OK", topic: "rent-increase", topics: rentTopics, titleEn: "Oklahoma rent", titleEs: "Renta en Oklahoma", summaryEn: `The 2026 text of section 109 sets rent by agreement and states no percentage cap or increase notice. Section 111's 30-day and 7-day notices end a tenancy and were not graded as a rent increase. Checked ${CHECKED}.`, summaryEs: `La sección 109 de 2026 no fija un tope. La sección 111 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`, citation: "Okla. Stat. tit. 41, § 109", sourceName: "Oklahoma State Courts Network", sourceUrl: "https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=71756" }),
  info({ id: "UT-57-17-3", jurisdiction: "UT", topic: "deposit", topics: depositTopics, titleEn: "Utah renter deposit", titleEs: "Depósito en Utah", summaryEn: `Section 57-17-3 returns the deposit and an itemization no later than 30 days after the renter vacates and returns possession. The opened chapter states no maximum number of months. Checked ${CHECKED}.`, summaryEs: `La sección 57-17-3 da 30 días después de la entrega. No fija un máximo de meses. Revisado el ${CHECKED_ES}.`, citation: "Utah Code § 57-17-3", sourceName: "Utah Legislature", sourceUrl: "https://le.utah.gov/xcode/Title57/Chapter17/C57-17_1800010118000101.pdf" }),
  info({ id: "UT-57-22-6", jurisdiction: "UT", topic: "repair", topics: repairTopics, titleEn: "Utah fit premises", titleEs: "Vivienda habitable en Utah", summaryEn: `Sections 57-22-3 and 57-22-4 require a habitable unit. The corrective periods in section 57-22-6 are rent-abatement or repair-and-deduct remedies with prerequisites, not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `Los plazos de la sección 57-22-6 son remedios con requisitos. No son permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Utah Code § 57-22-6", sourceName: "Utah Legislature", sourceUrl: "https://le.utah.gov/xcode/Title57/Chapter22/C57-22_1800010118000101.pdf" }),
  info({ id: "UT-57-22", jurisdiction: "UT", topic: "retaliation", topics: retalTopics, titleEn: "Utah retaliation", titleEs: "Represalia en Utah", summaryEn: `Title 57, chapters 17 and 22 do not state a general retaliation period. The public-safety assistance limit in section 57-22-5.1 was not applied to an ordinary repair complaint. Checked ${CHECKED}.`, summaryEs: `Los capítulos abiertos no fijan un plazo general de represalia. Revisado el ${CHECKED_ES}.`, citation: "Utah Code tit. 57, chs. 17 and 22", sourceName: "Utah Legislature", sourceUrl: "https://le.utah.gov/xcode/Title57/Chapter22/C57-22_1800010118000101.pdf" }),
  info({ id: "UT-57-22-4", jurisdiction: "UT", topic: "rent-increase", topics: rentTopics, titleEn: "Utah rent change", titleEs: "Cambio de renta en Utah", summaryEn: `The Fit Premises Act does not state a percentage cap or a rent-increase notice. A 15-day notice applies to a new month-to-month fee, and the late-fee limit was not used as a rent cap. Checked ${CHECKED}.`, summaryEs: `El capítulo no fija un tope ni un aviso de aumento. Revisado el ${CHECKED_ES}.`, citation: "Utah Code § 57-22-4", sourceName: "Utah Legislature", sourceUrl: "https://le.utah.gov/xcode/Title57/Chapter22/C57-22_1800010118000101.pdf" }),
];
