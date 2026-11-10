import { addDays, addMonths } from "@/lib/rules/dates";
import { rule, type Rule } from "@/lib/rules/define";

const CHECKED = "Nov 10, 2026";
const CHECKED_ES = "10 de noviembre de 2026";

export const BATCH1B_STATES = ["NY", "IL", "MA", "NC", "PA", "OH", "DC"] as const;
export type Batch1bState = (typeof BATCH1B_STATES)[number];

type Stamp = {
  dueDate: string | null;
  ruleId: string;
  citation: string;
  explanation: string;
  explanationEs: string;
  computation: string;
  unsure: boolean;
};

type Severity =
  | "no_heat" | "no_water" | "no_electricity" | "gas_leak" | "sewage" | "flood" | "no_toilet"
  | "door" | "window" | "co_alarm" | "fire" | "wiring" | "leak" | "mold" | "pests" | "other";

export function isBatch1b(state: string): state is Batch1bState {
  return (BATCH1B_STATES as readonly string[]).includes(state);
}

function percent(lowestCents: number, proposedCents: number): string {
  const value = Math.round(((proposedCents - lowestCents) * 1_000_000) / lowestCents);
  return (value / 10_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function info(input: {
  id: string;
  jurisdiction: Batch1bState;
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

export function batch1bDeposit(state: string, triggerDate: string): Stamp | null {
  if (!isBatch1b(state)) return null;
  if (state === "NY") {
    const due = addDays(triggerDate, 14);
    return {
      dueDate: due,
      ruleId: "NY-GOL-7-108",
      citation: "N.Y. Gen. Oblig. Law § 7-108",
      unsure: true,
      computation: `${triggerDate} + 14 calendar days = ${due}. Stored as unsure because rent-stabilized deposits use § 7-107, which was not applied.`,
      explanation: `General Obligations Law § 7-108(1-a)(e) says that within 14 days after the tenant has vacated, the landlord shall give an itemized statement of any amount retained and return the rest. Using ${triggerDate} as the vacate date, that date is ${due}. Failure to do both forfeits the right to retain any portion. The opened section limits a deposit or advance to one month's rent, with seasonal-use and owner-occupied cooperative exceptions that were not decided. It does not apply to a unit covered by § 7-107, and subdivision 1-a excludes units under the city rent and rehabilitation law or the emergency housing rent control law. Whether this home is rent stabilized or rent controlled was not entered, so the date is not a finding. New York City rent stabilization was not applied. Checked ${CHECKED}.`,
      explanationEs: `La Ley de Obligaciones Generales § 7-108 da 14 días después de que el inquilino desocupa para el desglose y la devolución. Si ${triggerDate} es esa fecha, el día es ${due}. No se aplicó a una vivienda de renta estabilizada, que usa otra sección. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "IL") {
    const statement = addDays(triggerDate, 30);
    const fullReturn = addDays(triggerDate, 45);
    return {
      dueDate: null,
      ruleId: "IL-765-710",
      citation: "765 ILCS 710/1",
      unsure: true,
      computation: `A damage statement would be due ${statement}. A full return if no statement was furnished would be due ${fullReturn}. Neither was stored as the only date.`,
      explanation: `The Security Deposit Return Act, 765 ILCS 710/1, says a landlord may not withhold a deposit for property damage unless, within 30 days after the tenant vacated or the right of possession ended, whichever is later, the landlord delivers an itemized statement and receipts. If that statement is not furnished, the landlord shall return the deposit in full within 45 days after the tenant vacated. Using ${triggerDate}, those dates would be ${statement} and ${fullReturn}. Which duty applies was not entered, so no single date was stored. The opened section does not state a maximum number of months. If the tenant gives no mailing or email address, the damages and penalties in the section are not imposed. The Chicago Residential Landlord and Tenant Ordinance was not applied. Checked ${CHECKED}.`,
      explanationEs: `765 ILCS 710/1 tiene 30 días para un desglose y 45 días para devolver todo si no hay desglose. No se guardó una sola fecha. La ordenanza de Chicago no se aplicó. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MA") {
    const due = addDays(triggerDate, 30);
    return {
      dueDate: due,
      ruleId: "MA-186-15B",
      citation: "Mass. Gen. Laws ch. 186, § 15B",
      unsure: false,
      computation: `${triggerDate} + 30 calendar days = ${due}.`,
      explanation: `Chapter 186, § 15B(4) says the lessor shall, within 30 days after termination of occupancy under a tenancy at will or the end of the tenancy specified in a valid written lease, return the security deposit or any balance. A damage deduction requires an itemized list sworn under the penalties of perjury, within those 30 days. Using ${triggerDate} as that end date, the date is ${due}. At the start of the tenancy the section limits what may be required to the first month's rent, the last month's rent, a security deposit equal to the first month's rent, and a key and lock. A tenancy of 100 days or less for vacation or recreation is excluded and was not decided. Interest of 5 percent a year, or the lesser amount the bank paid, applies when the deposit is held one year or longer. Checked ${CHECKED}.`,
      explanationEs: `El capítulo 186, § 15B(4) exige devolver el depósito dentro de 30 días después del fin de la ocupación o del plazo del contrato escrito. Si ${triggerDate} es ese fin, la fecha es ${due}. El depósito de garantía no puede pasar de la renta del primer mes. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "NC") {
    const interim = addDays(triggerDate, 30);
    const finalAccounting = addDays(triggerDate, 60);
    return {
      dueDate: interim,
      ruleId: "NC-42-52",
      citation: "N.C. Gen. Stat. § 42-52",
      unsure: true,
      computation: `${triggerDate} + 30 calendar days = ${interim}. A final accounting, if the claim cannot be determined in 30 days, would be ${finalAccounting}.`,
      explanation: `G.S. 42-52 says the landlord shall itemize any damage and deliver the balance no later than 30 days after termination of the tenancy and delivery of possession. If the claim cannot be determined in 30 days, an interim accounting is due by that 30th day and a final accounting within 60 days. Using ${triggerDate} as termination and delivery of possession, those dates are ${interim} and ${finalAccounting}. The 30-day date was stored as unsure because it may be only an interim accounting. G.S. 42-51 limits a deposit to two weeks' rent for week to week, one and one-half months for month to month, and two months for a longer term. The term was not entered, so no cap was applied as a finding. Normal wear and tear may not be withheld. The General Assembly's posted text was opened; that site says the printed statutes are the official publication. Checked ${CHECKED}.`,
      explanationEs: `G.S. 42-52 da 30 días para el desglose y el saldo, o una cuenta final a los 60 días si el reclamo no se puede determinar antes. La fecha de 30 días se guardó como incierta. El tope depende del plazo y no se aplicó. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "PA") {
    const due = addDays(triggerDate, 30);
    return {
      dueDate: due,
      ruleId: "PA-1951-512",
      citation: "Landlord and Tenant Act of 1951 § 512",
      unsure: true,
      computation: `${triggerDate} + 30 calendar days = ${due}. The act uses the earlier of termination or surrender and acceptance.`,
      explanation: `Section 512(a) of the Landlord and Tenant Act of 1951 says that within 30 days of termination of a lease or upon surrender and acceptance of the premises, whichever first occurs, the landlord shall give a written list of damages claimed and pay the difference between the escrow and the actual damages caused by the tenant. Using ${triggerDate} as that earlier event, the date is ${due}. It was stored as unsure because the other event was not entered separately. Failure to give the list forfeits the right to withhold the escrow or to sue for damage to the premises. Section 512(e) says the tenant's failure to give a new address in writing relieves the landlord of liability under the section. That address was not confirmed. Section 511.1 limits escrow to two months' rent during the first year and one month's rent during the second and later years or a renewal. The year of the lease was not entered, so no cap was applied as a finding. Checked ${CHECKED}.`,
      explanationEs: `La sección 512 da 30 días desde la terminación o la entrega aceptada, lo que ocurra primero. Si ${triggerDate} es ese hecho, la fecha es ${due}, y se guardó como incierta. El tope de la sección 511.1 depende del año del contrato y no se aplicó. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "OH") {
    const due = addDays(triggerDate, 30);
    return {
      dueDate: due,
      ruleId: "OH-5321.16",
      citation: "Ohio Rev. Code § 5321.16",
      unsure: false,
      computation: `${triggerDate} + 30 calendar days = ${due}. Weekends were not skipped.`,
      explanation: `Section 5321.16(B) says any deduction shall be itemized in a written notice delivered with the amount due within 30 days after termination of the rental agreement and delivery of possession. Using ${triggerDate} as the day both had happened, the date is ${due}. If either was later, this date is too early. The tenant shall give a forwarding address in writing. If the tenant does not, the tenant is not entitled to damages or attorney fees under division (C). That address was not confirmed, and the damages path was not decided. The section does not state a maximum number of months. Interest of five percent a year is due on any amount over the greater of fifty dollars or one month's rent when the tenant stays six months or more. Checked ${CHECKED}.`,
      explanationEs: `La sección 5321.16(B) da 30 días después de la terminación y la entrega de la posesión. Si ${triggerDate} es ese día, la fecha es ${due}. La dirección de reenvío afecta los daños de la división (C) y no se confirmó. Revisado el ${CHECKED_ES}.`,
    };
  }
  const notice = addDays(triggerDate, 45);
  return {
    dueDate: null,
    ruleId: "DC-42-3502.17",
    citation: "D.C. Code § 42-3502.17",
    unsure: true,
    computation: `A written notice of alleged unpaid amounts would be due ${notice}. No single refund date was stored. The security-deposit regulations in 14 DCMR were not opened.`,
    explanation: `D.C. Code § 42-3502.17(e)(2) says that within 45 days after termination of the tenancy the housing provider shall notify the tenant in writing of alleged unpaid rent, damage beyond ordinary wear and tear, or removal of items left behind, with photographs or other documentation. Using ${triggerDate} as termination, that notice date would be ${notice}. The tenant then has 30 calendar days after the notice is served to dispute it. The service date was not entered, so neither date was stored as a refund deadline. Ordinary wear and tear may not be withheld. Subsection (d) is marked not funded and was not applied. The section also points to the Security Deposit Act in 14 DCMR, which was not opened. This section sits in the rent-stabilization subchapter. Whether the unit is covered by rent stabilization was not decided, and no rent-stabilization calculation was made. Checked ${CHECKED}.`,
    explanationEs: `D.C. Code § 42-3502.17(e) da 45 días después de la terminación para avisar montos alegados, y luego 30 días para disputarlos. No se guardó una sola fecha de devolución. La estabilización de renta no se aplicó. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch1bRepair(state: string, requestDate: string, severity: Severity): Stamp | null {
  if (!isBatch1b(state)) return null;
  const notPermission = "This is not permission to withhold rent, repair and deduct, or end the tenancy.";
  const notPermissionEs = "No es permiso para retener la renta, reparar y descontar, ni terminar el arrendamiento.";
  if (state === "NC" && severity === "co_alarm") {
    const due = addDays(requestDate, 15);
    return {
      dueDate: due,
      ruleId: "NC-42-42",
      citation: "N.C. Gen. Stat. § 42-42",
      unsure: false,
      computation: `Written notice ${requestDate} + 15 calendar days = ${due}, for a smoke or carbon monoxide alarm under G.S. 42-42(a)(5) or (a)(7).`,
      explanation: `G.S. 42-42(a)(7) says the landlord shall replace or repair a carbon monoxide alarm within 15 days of receipt of the tenant's written notification. The same 15-day receipt period is in (a)(5) for a smoke alarm. Counted from ${requestDate}, that date is ${due}. G.S. 42-44(c) says the tenant may not unilaterally withhold rent before a court decides that right. ${notPermission} Checked ${CHECKED}.`,
      explanationEs: `G.S. 42-42 da 15 días después de recibir el aviso escrito para reparar una alarma de humo o de monóxido. Desde ${requestDate}, la fecha es ${due}. G.S. 42-44(c) no permite retener la renta por cuenta propia. ${notPermissionEs} Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "NC") {
    return {
      dueDate: null,
      ruleId: "NC-42-42",
      citation: "N.C. Gen. Stat. § 42-42",
      unsure: true,
      computation: `Notice ${requestDate}. No calendar date stored. G.S. 42-42(a)(4) says promptly after written notice, and (a)(8) says a reasonable period for an imminently dangerous condition.`,
      explanation: `G.S. 42-42(a)(2) requires the landlord to keep the premises fit and habitable. Subdivision (a)(4) says to promptly repair facilities supplied by the landlord after written notice, except in an emergency. Subdivision (a)(8) says to repair an imminently dangerous condition within a reasonable period based on severity after actual knowledge or notice. Neither period is a fixed number of days, so no date was stored from ${requestDate}. Smoke and carbon monoxide alarms use 15 days and were not the condition entered. G.S. 42-44(c) says the tenant may not unilaterally withhold rent before a judicial determination. ${notPermission} Checked ${CHECKED}.`,
      explanationEs: `G.S. 42-42 no fija un solo número de días para una reparación general. No se guardó una fecha. El inquilino no puede retener la renta por cuenta propia. ${notPermissionEs} Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "OH") {
    const due = addDays(requestDate, 30);
    return {
      dueDate: due,
      ruleId: "OH-5321.07",
      citation: "Ohio Rev. Code § 5321.07",
      unsure: true,
      computation: `Receipt ${requestDate}. The outer bound in § 5321.07(B) is 30 days, which is ${due}. A reasonable time may be sooner.`,
      explanation: `Section 5321.04 requires the landlord to keep the premises fit and habitable and to maintain supplied plumbing, heating, and other fixtures. It does not set one repair day count. Section 5321.04(A)(8)'s 24 hours is a presumption for notice before entry, not a repair deadline. Section 5321.07(B) says that if, after receiving the tenant's written notice, the landlord fails to remedy the condition within a reasonable time considering severity and the time needed, or within 30 days, whichever is sooner, a tenant who is current in rent may deposit rent with the court clerk, ask the court for an order, or terminate. Counted from ${requestDate}, the 30-day outer bound is ${due}. It was stored as unsure because a reasonable time may be sooner. The court-deposit and termination paths are not private withholding. The section does not apply to a landlord of three or fewer units who gave the written notice in division (C), or to a student tenant. Those exclusions were not decided. ${notPermission} Checked ${CHECKED}.`,
      explanationEs: `La sección 5321.07 usa un tiempo razonable o 30 días, lo que ocurra primero, después de recibir el aviso. Desde ${requestDate}, el límite de 30 días es ${due} y puede ser antes. No es permiso para retener la renta en privado. ${notPermissionEs} Revisado el ${CHECKED_ES}.`,
    };
  }
  const text: Record<Exclude<Batch1bState, "NC" | "OH">, Stamp> = {
    NY: {
      dueDate: null,
      ruleId: "NY-RPP-235-B",
      citation: "N.Y. Real Prop. Law § 235-b",
      unsure: true,
      computation: `Notice ${requestDate}. Real Property Law § 235-b states no day count.`,
      explanation: `Real Property Law § 235-b deems a warranty that the premises and common areas are fit for human habitation and that occupants will not be subjected to conditions dangerous, hazardous, or detrimental to life, health, or safety. A condition caused by the tenant or someone under the tenant's control is not a breach. The section states no number of days, so no date was stored from ${requestDate}. ${notPermission} Multiple Dwelling Law repair sections were not opened. A rent reduction ordered by the state housing agency for a rent-regulated unit was not applied. Checked ${CHECKED}.`,
      explanationEs: `La Ley de Propiedad Inmobiliaria § 235-b es una garantía de habitabilidad y no fija días. No se guardó una fecha. ${notPermissionEs} Revisado el ${CHECKED_ES}.`,
    },
    IL: {
      dueDate: null,
      ruleId: "IL-765-742",
      citation: "765 ILCS 742/5",
      unsure: true,
      computation: `Notice ${requestDate}. The 14 days in 765 ILCS 742/5 are a repair-and-deduct path, not a stored deadline.`,
      explanation: `The Residential Tenants' Right to Repair Act, 765 ILCS 742/5, lets a tenant have a repair made and deduct the cost only if the reasonable cost does not exceed the lesser of $500 or one-half of the monthly rent, the tenant sends notice by registered or certified mail or another restricted delivery service, and the landlord fails to repair within 14 days after that notice, or more promptly in an emergency. The deduction also requires a paid bill from an unrelated tradesman and the limits in section 15. Those facts were not entered. The 14 days were not stored as a repair deadline from ${requestDate}, and they are not permission to deduct. A general statewide day count for every repair was not in the act. The Chicago ordinance was not applied. ${notPermission} Checked ${CHECKED}.`,
      explanationEs: `765 ILCS 742/5 permite reparar y descontar solo con un costo tope, un aviso por correo restringido y 14 días. Esos hechos no se anotaron, así que no se guardó una fecha ni un permiso. ${notPermissionEs} Revisado el ${CHECKED_ES}.`,
    },
    MA: {
      dueDate: null,
      ruleId: "MA-111-127L",
      citation: "Mass. Gen. Laws ch. 111, § 127L",
      unsure: true,
      computation: `Notice ${requestDate}. Chapter 111, § 127L requires a code certification before its 5-day and 14-day periods. Those periods were not stored.`,
      explanation: `Chapter 186, § 14 concerns willful failure to furnish required water, heat, and other listed services, and interference with quiet enjoyment. It states no repair day count. Chapter 111, § 127L allows repair and deduct, or treating the tenancy as ended, only after a board of health, code agency, or court certifies a violation that may endanger or materially impair health or safety, the owner has written notice, and the owner fails to begin repairs or contract for them within five days and to substantially complete them within fourteen days, unless a shorter order applies. The deduction is capped at four months' rent in a twelve-month period. The certification and the other prerequisites were not entered, so no date was stored from ${requestDate}. ${notPermission} Checked ${CHECKED}.`,
      explanationEs: `El capítulo 111, § 127L permite reparar y descontar solo después de una certificación oficial, un aviso escrito, 5 días para empezar y 14 días para terminar. Eso no se confirmó, así que no se guardó una fecha. ${notPermissionEs} Revisado el ${CHECKED_ES}.`,
    },
    PA: {
      dueDate: null,
      ruleId: "PA-1951-502A",
      citation: "Landlord and Tenant Act of 1951 § 502-A",
      unsure: true,
      computation: `Notice ${requestDate}. The 1951 act, as opened, states no repair day count.`,
      explanation: `Section 502-A of the Landlord and Tenant Act of 1951 places a duty of reasonable care for safety in the common stairways, passages, and other common facilities of a tenement or multiple dwelling. It states no number of days. The rest of the act that was opened does not set a general repair deadline. No date was stored from ${requestDate}. The City Rent Withholding Act is a different statute and was not opened, so it was not used as permission to pay rent into escrow. ${notPermission} Checked ${CHECKED}.`,
      explanationEs: `La sección 502-A exige cuidado razonable en las áreas comunes y no fija días. No se guardó una fecha. La ley de retención de renta de la ciudad no se abrió y no se usó como permiso. ${notPermissionEs} Revisado el ${CHECKED_ES}.`,
    },
    DC: {
      dueDate: null,
      ruleId: "DC-42-3509.08",
      citation: "D.C. Code § 42-3509.08",
      unsure: true,
      computation: `Notice ${requestDate}. The 30-day abatement added by D.C. Law 22-287 is marked not funded, so it was not used.`,
      explanation: `D.C. Code § 42-3509.08 lets the Mayor inspect rental housing. Subsections (e) and (f), the 30-day abatement after a notice of violation and the Mayor's power to extend it, are marked not funded. The code says the amendment by D.C. Law 22-287 has not been implemented. That 30-day period was not used. Section 42-3505.51 requires 48 hours' written notice before a housing provider enters, which is an entry rule, not a repair deadline. The housing-code timeframes in 14 DCMR were not opened. No date was stored from ${requestDate}. ${notPermission} Rent stabilization was not applied. Checked ${CHECKED}.`,
      explanationEs: `El plazo de 30 días para corregir una citación en § 42-3509.08 está marcado como no financiado y no se usó. Las 48 horas de § 42-3505.51 son para entrar, no para reparar. No se guardó una fecha. ${notPermissionEs} Revisado el ${CHECKED_ES}.`,
    },
  };
  return text[state];
}

export function batch1bRetaliation(state: string, activityDate: string, noticeDate: string, daysSince: number): (Stamp & { flagged: boolean; daysSince: number }) | null {
  if (!isBatch1b(state)) return null;
  if (state === "OH") {
    return {
      flagged: false,
      daysSince,
      dueDate: null,
      ruleId: "OH-5321.02",
      citation: "Ohio Rev. Code § 5321.02",
      unsure: true,
      computation: "No day count. § 5321.02 does not state a number of days.",
      explanation: `Section 5321.02(A) says a landlord may not retaliate by increasing rent, decreasing services, or bringing or threatening a possession action because the tenant complained to an agency about a health or safety code violation, complained to the landlord about § 5321.04, or joined with other tenants to negotiate. The section states no number of days, so no date was flagged. Section 5321.03 lists possession grounds that apply notwithstanding § 5321.02, including nonpayment, a tenant-caused violation, a code repair that would deprive the tenant of the unit, and holdover. Division (C) allows a rent increase that reflects improvements or higher operating costs. Those exceptions were not decided. A date match is not a finding. Checked ${CHECKED}.`,
      explanationEs: `La sección 5321.02 prohíbe represalias y no fija días, así que no se marcó una fecha. Las excepciones de la sección 5321.03 no se decidieron. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "PA") {
    return {
      flagged: false,
      daysSince,
      dueDate: null,
      ruleId: "PA-1951-501",
      citation: "Landlord and Tenant Act of 1951",
      unsure: true,
      computation: "No day count. The 1951 act, as opened, has no general retaliation period.",
      explanation: `The Landlord and Tenant Act of 1951, as opened on ${CHECKED}, does not state a general number of days for retaliatory conduct. No date was flagged. The Manufactured Home Community Rights Act has a six-month presumption for a manufactured-home community, and that act was not applied to a dwelling. A date match is not a finding. Checked ${CHECKED}.`,
      explanationEs: `La ley de 1951 no fija un plazo general de represalia, así que no se marcó una fecha. La presunción de seis meses de las comunidades de casas prefabricadas no se aplicó. Revisado el ${CHECKED_ES}.`,
    };
  }
  const months = state === "MA" || state === "DC" ? 6 : 12;
  const end = addMonths(activityDate, months);
  const flagged = daysSince >= 0 && noticeDate <= end;
  const within = flagged
    ? `The later date is inside ${months === 6 ? "six months" : "one year"} (${end}).`
    : `The later date is outside ${months === 6 ? "six months" : "one year"} (${end}).`;
  const withinEs = flagged
    ? `La fecha posterior está dentro del plazo (${end}).`
    : `La fecha posterior está fuera del plazo (${end}).`;
  if (state === "NY") {
    return {
      flagged,
      daysSince,
      dueDate: null,
      ruleId: "NY-RPP-223-B",
      citation: "N.Y. Real Prop. Law § 223-b",
      unsure: false,
      computation: `${activityDate} plus one year = ${end}.`,
      explanation: `${within} Real Property Law § 223-b(5) creates a rebuttable presumption if the landlord served a notice to quit, started a possession case, or tried to substantially alter the terms of the tenancy within one year after a listed protected act. The landlord then must show a non-retaliatory motive by a preponderance of the evidence. It is not a finding. The section does not apply to an owner-occupied dwelling with fewer than four units, or where the condition was caused by the tenant or a household member or guest, or where a tenancy ended because of a bona fide transfer of ownership. Those exceptions were not decided. Checked ${CHECKED}.`,
      explanationEs: `${withinEs} La sección 223-b crea una presunción refutable dentro de un año. No es una conclusión. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "IL") {
    return {
      flagged,
      daysSince,
      dueDate: null,
      ruleId: "IL-765-721",
      citation: "765 ILCS 721/20",
      unsure: false,
      computation: `${activityDate} plus one year = ${end}.`,
      explanation: `${within} The Landlord Retaliation Act, 765 ILCS 721/5, says a landlord may not knowingly terminate a tenancy, increase rent, decrease services, sue or threaten to sue for possession, or refuse to renew because of a listed good-faith tenant act. Section 20 creates a rebuttable presumption when the protected conduct was within one year before the alleged retaliation. The presumption does not arise if the protected activity started after the alleged act. Section 15 says an action is not retaliatory if the landlord proves a legitimate basis or began it before the protected activity. It is not a finding. The old Retaliatory Eviction Act, 765 ILCS 720, was repealed effective January 1, 2025. The Chicago ordinance was not applied. Checked ${CHECKED}.`,
      explanationEs: `${withinEs} 765 ILCS 721/20 crea una presunción refutable dentro de un año. No es una conclusión. La ordenanza de Chicago no se aplicó. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MA") {
    return {
      flagged,
      daysSince,
      dueDate: null,
      ruleId: "MA-186-18",
      citation: "Mass. Gen. Laws ch. 186, § 18",
      unsure: false,
      computation: `${activityDate} plus six months = ${end}.`,
      explanation: `${within} Chapter 186, § 18 says that a notice of termination, except for nonpayment of rent, a rent increase, or a substantial alteration of the terms within six months after a listed protected act creates a rebuttable presumption of reprisal. The presumption is rebutted only by clear and convincing evidence of an independent justification. It is not a finding. Checked ${CHECKED}.`,
      explanationEs: `${withinEs} El capítulo 186, § 18 crea una presunción refutable dentro de seis meses. No es una conclusión. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "NC") {
    return {
      flagged,
      daysSince,
      dueDate: null,
      ruleId: "NC-42-37.1",
      citation: "N.C. Gen. Stat. § 42-37.1",
      unsure: true,
      computation: `${activityDate} plus 12 months = ${end}. The statute is a defense to a summary ejectment action.`,
      explanation: `${within} G.S. 42-37.1(b) says that in a summary ejectment action the tenant may show that the action is substantially in response to a protected act within 12 months before the filing. The later date was not confirmed to be the filing of a summary ejectment, so the flag is not a finding. Subsection (c) lists grounds on which the landlord may still prevail, including nonpayment or another substantial lease breach, holdover at the end of a fixed term, a tenant-caused violation, and a good-faith notice to quit delivered before the protected act. Those were not decided. Checked ${CHECKED}.`,
      explanationEs: `${withinEs} G.S. 42-37.1 es una defensa en un desalojo sumario dentro de 12 meses. No se confirmó que la fecha posterior sea esa demanda. No es una conclusión. Revisado el ${CHECKED_ES}.`,
    };
  }
  return {
    flagged,
    daysSince,
    dueDate: null,
    ruleId: "DC-42-3505.02",
    citation: "D.C. Code § 42-3505.02",
    unsure: false,
    computation: `${activityDate} plus six months = ${end}.`,
    explanation: `${within} D.C. Code § 42-3505.02(b) says the trier of fact shall presume retaliatory action, unless the housing provider rebuts it by clear and convincing evidence, if within the six months before the action the tenant did a listed act. Listed acts include a witnessed repair request, a complaint to the District about housing-code violations, legally withholding rent after reasonable notice, and tenant organizing. It is not a finding, and it is not permission to withhold rent. Rent stabilization was not applied. Checked ${CHECKED}.`,
    explanationEs: `${withinEs} D.C. Code § 42-3505.02 presume represalia dentro de seis meses, salvo prueba clara y convincente. No es una conclusión ni permiso para retener la renta. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch1bRent(state: string, lowestCents: number, proposedCents: number) {
  if (!isBatch1b(state)) return null;
  const amount = percent(lowestCents, proposedCents);
  const common = {
    abovePublishedMax: false as const,
  };
  if (state === "NY") {
    return {
      ...common,
      headlineEn: "New York rent increase",
      headlineEs: "Aumento de renta en Nueva York",
      ruleId: "NY-RPP-226-C",
      detailEn: `The increase from the amounts entered is about ${amount}%. Real Property Law § 226-c requires written notice when a landlord offers to renew with an increase equal to or greater than five percent above the current rent, or does not intend to renew. The notice is at least 30 days if the tenant has occupied the unit for less than one year and does not have a lease term of at least one year, 60 days if occupancy or the lease term is at least one year and less than two, and 90 days if occupancy or the lease term is at least two years. Occupancy and the lease term were not entered, so no notice period was graded. Until June 15, 2034, the notice also has to include the statements about article 6-A, the good cause eviction law. Whether the unit is subject to that article, and any local rent standard, was not decided. New York City rent stabilization and rent control were not applied. A cooperative-corporation exception is in the section and was not decided. Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${amount}%. La sección 226-c exige aviso escrito para una renovación con un aumento de al menos 5%, o si no habrá renovación: 30, 60 o 90 días según la ocupación o el plazo. Eso no se calificó. La estabilización de la ciudad de Nueva York y la ley de buena causa no se decidieron. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "IL") {
    return {
      ...common,
      headlineEn: "Illinois rent increase",
      headlineEs: "Aumento de renta en Illinois",
      ruleId: "IL-50-825",
      detailEn: `The increase from the amounts entered is about ${amount}%. The Rent Control Preemption Act, 50 ILCS 825/5, says a unit of local government shall not enact, maintain, or enforce an ordinance that controls the amount of rent for private residential property. The opened act does not state a statewide percentage cap or a number of days for an increase notice. No notice period was graded. A retaliatory increase is a separate limit under the Landlord Retaliation Act. The Chicago Residential Landlord and Tenant Ordinance was not applied. Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${amount}%. 50 ILCS 825 prohíbe el control local del monto de la renta y no fija un tope estatal ni un plazo de aviso. No se calificó un plazo. La ordenanza de Chicago no se aplicó. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "MA") {
    return {
      ...common,
      headlineEn: "Massachusetts rent increase",
      headlineEs: "Aumento de renta en Massachusetts",
      ruleId: "MA-40P-4",
      detailEn: `The increase from the amounts entered is about ${amount}%. Chapter 40P, the Massachusetts Rent Control Prohibition Act, says no city or town may enact, maintain, or enforce rent control, except a narrow voluntary program under § 4 that was not applied. The chapter does not state a statewide percentage cap. Chapter 186, § 12 says how either party determines an estate at will: three months' written notice, or, if rent is payable at shorter periods, notice equal to the interval between payments or 30 days, whichever is longer. That notice may include an offer of a new tenancy on different terms. It was not graded as a rent-increase deadline. A retaliatory increase is a separate limit under chapter 186, § 18. Mobile-home rent control is excluded from the chapter 40P definition and was not applied. Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${amount}%. El capítulo 40P prohíbe el control de renta municipal, con una excepción voluntaria que no se aplicó. El capítulo 186, § 12 es para terminar un arrendamiento a voluntad y no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "NC") {
    return {
      ...common,
      headlineEn: "North Carolina rent increase",
      headlineEs: "Aumento de renta en Carolina del Norte",
      ruleId: "NC-42-14.1",
      detailEn: `The increase from the amounts entered is about ${amount}%. G.S. 42-14.1 says no county or city may regulate the amount of rent for privately owned residential rental property, with listed exceptions for the government's own property and some subsidized or incentivized housing that were not decided. The opened chapter does not state a statewide percentage cap or a general rent-increase notice period. No notice period was graded. G.S. 42-14 is a notice to quit: one month for year to year, seven days for month to month, and two days for week to week. A manufactured-home space uses 60 days. Those periods were not graded as a rent increase, and the manufactured-home space period was not applied to a dwelling. Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${amount}%. G.S. 42-14.1 impide que una ciudad o condado regule el monto de la renta. No hay un tope estatal en el capítulo abierto. G.S. 42-14 es un aviso para terminar y no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "PA") {
    return {
      ...common,
      headlineEn: "Pennsylvania rent increase",
      headlineEs: "Aumento de renta en Pensilvania",
      ruleId: "PA-1951-501",
      detailEn: `The increase from the amounts entered is about ${amount}%. The Landlord and Tenant Act of 1951, as opened on ${CHECKED}, does not state a statewide percentage cap or a rent-increase notice period. No notice period was graded. Section 501 is a notice to quit before a landlord repossesses: 15 days from service when the lease is for one year or less or for an indeterminate time, 30 days when the lease is for more than one year, and 10 days for unpaid rent. A mobile-home park uses different periods in the same section, and those were not applied. The tenant may agree to less time in the lease. Those periods were not graded as a rent increase. Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${amount}%. La ley de 1951 no fija un tope estatal ni un aviso de aumento. La sección 501 es un aviso para recuperar la posesión y no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "OH") {
    return {
      ...common,
      headlineEn: "Ohio rent increase",
      headlineEs: "Aumento de renta en Ohio",
      ruleId: "OH-5321.19",
      detailEn: `The increase from the amounts entered is about ${amount}%. Section 5321.19 says no political subdivision may impose rent control or rent stabilization on rental agreements regulated by chapter 5321, with exceptions for housing codes, housing the subdivision owns or operates, and voluntary incentive agreements. The chapter does not state a statewide percentage cap or a rent-increase notice period. No notice period was graded. Section 5321.17 is termination of a periodic tenancy: at least seven days before the termination date for week to week, and at least 30 days before the periodic rental date for month to month. It was not graded as a rent-increase deadline. Section 5321.06 lets the agreement set the rent if the term is not inconsistent with the chapter. A retaliatory increase is a separate limit under § 5321.02. Checked ${CHECKED}.`,
      detailEs: `El aumento es de alrededor del ${amount}%. La sección 5321.19 impide el control y la estabilización de renta locales. No hay un tope estatal. La sección 5321.17 es para terminar un arrendamiento periódico y no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`,
    };
  }
  return {
    ...common,
    headlineEn: "District of Columbia rent increase",
    headlineEs: "Aumento de renta en el Distrito de Columbia",
    ruleId: "DC-42-3502.08",
    detailEn: `The increase from the amounts entered is about ${amount}%. D.C. Code § 42-3502.08 is the rent-stabilization section on increases above base rent. Rent Right did not apply that section, did not use a published adjustment, and did not decide whether the unit is exempt. No percentage comparison was made. A retaliatory increase is a separate limit under § 42-3505.02. Checked ${CHECKED}.`,
    detailEs: `El aumento es de alrededor del ${amount}%. La sección 42-3502.08 es la de estabilización de renta. No se aplicó ni se comparó un porcentaje. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch1bRepairLetter(state: string, locale: "en" | "es"): string | null {
  if (!isBatch1b(state)) return null;
  const en: Record<Batch1bState, string> = {
    NY: "I am asking you to address this repair. New York Real Property Law § 235-b warrants that the premises are fit for habitation and does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
    IL: "I am asking you to address this repair. This letter is not a notice under the Illinois Residential Tenants' Right to Repair Act and it is not permission to repair and deduct. I confirm this message before it is sent.",
    MA: "I am asking you to address this repair. This letter is not a repair-and-deduct notice under Massachusetts General Laws chapter 111, § 127L. I confirm this message before it is sent.",
    NC: "I am asking you to address this repair. North Carolina G.S. 42-44 says a tenant may not unilaterally withhold rent before a court decides that right. This letter is not that kind of notice. I confirm this message before it is sent.",
    PA: "I am asking you to address this repair. This letter is not a notice that I will pay rent into escrow or withhold rent. I confirm this message before it is sent.",
    OH: "I am asking you to address this repair. Ohio Revised Code § 5321.07 describes a court rent-deposit and termination path after a reasonable time, and not later than 30 days after you receive notice. This letter is not that court filing and it is not a notice that I am withholding rent. I confirm this message before it is sent.",
    DC: "I am asking you to address this repair. This letter is not a notice that I am withholding rent. District rent stabilization was not used to write it. I confirm this message before it is sent.",
  };
  const es: Record<Batch1bState, string> = {
    NY: "Le pido que atienda esta reparación. La ley de Nueva York § 235-b no fija un número de días. Esta carta no avisa que retengo la renta ni que termino el arrendamiento. Confirmo este mensaje antes de enviarlo.",
    IL: "Le pido que atienda esta reparación. Esta carta no es un aviso bajo la ley de Illinois para reparar y descontar. Confirmo este mensaje antes de enviarlo.",
    MA: "Le pido que atienda esta reparación. Esta carta no es un aviso para reparar y descontar según la ley de Massachusetts. Confirmo este mensaje antes de enviarlo.",
    NC: "Le pido que atienda esta reparación. La ley de Carolina del Norte no permite retener la renta por cuenta propia antes de una decisión judicial. Esta carta no es ese aviso. Confirmo este mensaje antes de enviarlo.",
    PA: "Le pido que atienda esta reparación. Esta carta no avisa que pagaré la renta en depósito judicial ni que la retendré. Confirmo este mensaje antes de enviarlo.",
    OH: "Le pido que atienda esta reparación. Esta carta no es una demanda judicial ni un aviso de que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    DC: "Le pido que atienda esta reparación. Esta carta no avisa que retengo la renta. No usé la estabilización de renta del Distrito. Confirmo este mensaje antes de enviarlo.",
  };
  return locale === "es" ? es[state] : en[state];
}

export const BATCH1B_RULES: Rule[] = [
  info({
    id: "NY-GOL-7-108",
    jurisdiction: "NY",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "New York security deposit for a non-stabilized unit",
    titleEs: "Depósito en Nueva York fuera de renta estabilizada",
    summaryEn: `General Obligations Law § 7-108 limits a deposit or advance for a covered non-stabilized unit to one month's rent and requires an itemized statement and the remaining deposit within 14 days after the tenant vacates. Rent-stabilized deposits are § 7-107 and were not applied. Checked ${CHECKED}.`,
    summaryEs: `La sección 7-108 limita el depósito a un mes de renta y exige el desglose y el saldo dentro de 14 días después de desocupar. No se aplicó a renta estabilizada. Revisado el ${CHECKED_ES}.`,
    citation: "N.Y. Gen. Oblig. Law § 7-108",
    sourceName: "New York State Senate Open Legislation",
    sourceUrl: "https://legislation.nysenate.gov/pdf/laws/GOB7-108?full=true",
  }),
  info({
    id: "NY-RPP-235-B",
    jurisdiction: "NY",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "New York warranty of habitability",
    titleEs: "Garantía de habitabilidad en Nueva York",
    summaryEn: `Real Property Law § 235-b warrants that residential premises are fit for human habitation and free of conditions dangerous to life, health, or safety. It states no day count. It is not permission to withhold rent. Checked ${CHECKED}.`,
    summaryEs: `La sección 235-b garantiza que la vivienda es habitable y no fija días. No es permiso para retener la renta. Revisado el ${CHECKED_ES}.`,
    citation: "N.Y. Real Prop. Law § 235-b",
    sourceName: "New York State Senate Open Legislation",
    sourceUrl: "https://legislation.nysenate.gov/pdf/laws/RPP235-B?full=true",
  }),
  info({
    id: "NY-RPP-223-B",
    jurisdiction: "NY",
    topic: "retaliation",
    topics: ["retaliation", "represalia"],
    titleEn: "New York retaliation presumption",
    titleEs: "Presunción de represalia en Nueva York",
    summaryEn: `Real Property Law § 223-b creates a rebuttable presumption when a notice to quit, a possession case, or a substantial change in terms comes within one year after a protected complaint, enforcement of rights, or tenant organizing. It is not a finding. An owner-occupied dwelling with fewer than four units is excluded and was not decided. Checked ${CHECKED}.`,
    summaryEs: `La sección 223-b crea una presunción refutable dentro de un año. No es una conclusión. Revisado el ${CHECKED_ES}.`,
    citation: "N.Y. Real Prop. Law § 223-b",
    sourceName: "New York State Senate Open Legislation",
    sourceUrl: "https://legislation.nysenate.gov/pdf/laws/RPP223-B?full=true",
  }),
  info({
    id: "NY-RPP-226-C",
    jurisdiction: "NY",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta", "percent"],
    titleEn: "New York rent-increase notice",
    titleEs: "Aviso de aumento en Nueva York",
    summaryEn: `Real Property Law § 226-c requires 30, 60, or 90 days' written notice for a renewal increase of at least five percent, or for a non-renewal, based on occupancy or lease length. Those facts were not graded. Good cause under article 6-A and New York City rent stabilization were not applied. Checked ${CHECKED}.`,
    summaryEs: `La sección 226-c exige 30, 60 o 90 días de aviso para un aumento de al menos 5% en una renovación. No se calificó. La estabilización de la ciudad no se aplicó. Revisado el ${CHECKED_ES}.`,
    citation: "N.Y. Real Prop. Law § 226-c",
    sourceName: "New York State Senate Open Legislation",
    sourceUrl: "https://legislation.nysenate.gov/pdf/laws/RPP226-C?full=true",
  }),
  info({
    id: "IL-765-710",
    jurisdiction: "IL",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "Illinois security deposit return",
    titleEs: "Devolución del depósito en Illinois",
    summaryEn: `765 ILCS 710/1 requires an itemized damage statement within 30 days after the tenant vacates or possession ends, whichever is later, and a full return within 45 days if that statement is not furnished. No single date was stored. The Chicago ordinance was not applied. Checked ${CHECKED}.`,
    summaryEs: `765 ILCS 710/1 da 30 días para el desglose y 45 días para devolver todo si no hay desglose. No se guardó una sola fecha. Revisado el ${CHECKED_ES}.`,
    citation: "765 ILCS 710/1",
    sourceName: "Illinois General Assembly",
    sourceUrl: "https://www.ilga.gov/documents/legislation/ilcs/documents/076507100K1.htm",
  }),
  info({
    id: "IL-765-742",
    jurisdiction: "IL",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "Illinois repair-and-deduct limits",
    titleEs: "Límites para reparar y descontar en Illinois",
    summaryEn: `765 ILCS 742/5 allows repair and deduct only after restricted-delivery notice and a 14-day failure to repair, and only up to the lesser of $500 or half a month's rent. Those steps were not treated as permission. Checked ${CHECKED}.`,
    summaryEs: `765 ILCS 742/5 permite reparar y descontar solo tras un aviso restringido y 14 días, y solo hasta $500 o la mitad de la renta. No se trató como permiso. Revisado el ${CHECKED_ES}.`,
    citation: "765 ILCS 742/5",
    sourceName: "Illinois General Assembly",
    sourceUrl: "https://www.ilga.gov/documents/legislation/ilcs/documents/076507420K5.htm",
  }),
  info({
    id: "IL-765-721",
    jurisdiction: "IL",
    topic: "retaliation",
    topics: ["retaliation", "represalia"],
    titleEn: "Illinois landlord retaliation",
    titleEs: "Represalia del propietario en Illinois",
    summaryEn: `765 ILCS 721 prohibits knowing retaliation, including a rent increase, for listed good-faith tenant acts. Section 20 creates a rebuttable presumption for protected conduct within the prior year. It is not a finding. The former 765 ILCS 720 was repealed. Checked ${CHECKED}.`,
    summaryEs: `765 ILCS 721 prohíbe represalias a sabiendas. La sección 20 crea una presunción dentro del año anterior. No es una conclusión. Revisado el ${CHECKED_ES}.`,
    citation: "765 ILCS 721/20",
    sourceName: "Illinois General Assembly",
    sourceUrl: "https://www.ilga.gov/documents/legislation/ilcs/documents/076507210K20.htm",
  }),
  info({
    id: "IL-50-825",
    jurisdiction: "IL",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta"],
    titleEn: "Illinois rent-control preemption",
    titleEs: "Prohibición del control de renta en Illinois",
    summaryEn: `50 ILCS 825 prohibits a local government from controlling the amount of rent for private residential property. It states no statewide cap and no increase-notice period. No notice period was graded. The Chicago ordinance was not applied. Checked ${CHECKED}.`,
    summaryEs: `50 ILCS 825 prohíbe el control local del monto de la renta. No fija un tope estatal ni un plazo de aviso. Revisado el ${CHECKED_ES}.`,
    citation: "50 ILCS 825/5",
    sourceName: "Illinois General Assembly",
    sourceUrl: "https://ilga.gov/legislation/ilcs/ilcs3.asp?ActID=748&ChapterID=11",
  }),
  info({
    id: "MA-186-15B",
    jurisdiction: "MA",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "Massachusetts security deposit",
    titleEs: "Depósito de garantía en Massachusetts",
    summaryEn: `Chapter 186, § 15B limits a security deposit to the first month's rent and requires the balance returned within 30 days after the tenancy ends, with a sworn itemized list if damage is deducted. A vacation occupancy of 100 days or less is excluded. Checked ${CHECKED}.`,
    summaryEs: `El capítulo 186, § 15B limita el depósito a la renta del primer mes y exige devolverlo dentro de 30 días. Revisado el ${CHECKED_ES}.`,
    citation: "Mass. Gen. Laws ch. 186, § 15B",
    sourceName: "Massachusetts General Court",
    sourceUrl: "https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section15B",
  }),
  info({
    id: "MA-111-127L",
    jurisdiction: "MA",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "Massachusetts certified-repair path",
    titleEs: "Reparación certificada en Massachusetts",
    summaryEn: `Chapter 111, § 127L allows repair and deduct only after an official certification, written notice, a failure to begin within five days, and a failure to substantially complete within fourteen days. It was not stored as permission. Chapter 186, § 14 states no repair day count. Checked ${CHECKED}.`,
    summaryEs: `El capítulo 111, § 127L permite reparar y descontar solo tras una certificación y plazos de 5 y 14 días. No se guardó como permiso. Revisado el ${CHECKED_ES}.`,
    citation: "Mass. Gen. Laws ch. 111, § 127L",
    sourceName: "Massachusetts General Court",
    sourceUrl: "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter111/Section127L",
  }),
  info({
    id: "MA-186-18",
    jurisdiction: "MA",
    topic: "retaliation",
    topics: ["retaliation", "represalia"],
    titleEn: "Massachusetts reprisal presumption",
    titleEs: "Presunción de represalia en Massachusetts",
    summaryEn: `Chapter 186, § 18 creates a rebuttable presumption when a termination notice, a rent increase, or a substantial change in terms comes within six months after a protected act. Clear and convincing evidence is required to rebut it. It is not a finding. Checked ${CHECKED}.`,
    summaryEs: `El capítulo 186, § 18 crea una presunción refutable dentro de seis meses. No es una conclusión. Revisado el ${CHECKED_ES}.`,
    citation: "Mass. Gen. Laws ch. 186, § 18",
    sourceName: "Massachusetts General Court",
    sourceUrl: "https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section18",
  }),
  info({
    id: "MA-40P-4",
    jurisdiction: "MA",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta"],
    titleEn: "Massachusetts rent-control prohibition",
    titleEs: "Prohibición del control de renta en Massachusetts",
    summaryEn: `Chapter 40P prohibits municipal rent control except a narrow voluntary program that was not applied. It states no statewide percentage cap. Chapter 186, § 12 notice for an estate at will was not graded as a rent increase. Checked ${CHECKED}.`,
    summaryEs: `El capítulo 40P prohíbe el control municipal de renta. No hay un tope estatal. El aviso del capítulo 186, § 12 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`,
    citation: "Mass. Gen. Laws ch. 40P, § 4",
    sourceName: "Massachusetts General Court",
    sourceUrl: "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter40P/Section4",
  }),
  info({
    id: "NC-42-52",
    jurisdiction: "NC",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "North Carolina security deposit accounting",
    titleEs: "Cuenta del depósito en Carolina del Norte",
    summaryEn: `G.S. 42-52 requires an itemized accounting and the balance within 30 days after termination and delivery of possession, or a final accounting within 60 days if the claim cannot be determined sooner. G.S. 42-51 states the deposit limits by tenancy length. The 30-day date was stored as unsure. Checked ${CHECKED}.`,
    summaryEs: `G.S. 42-52 exige la cuenta a los 30 días, o la cuenta final a los 60. El tope depende del plazo. Revisado el ${CHECKED_ES}.`,
    citation: "N.C. Gen. Stat. § 42-52",
    sourceName: "North Carolina General Assembly",
    sourceUrl: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_42/GS_42-52.html",
  }),
  info({
    id: "NC-42-42",
    jurisdiction: "NC",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "North Carolina fit premises",
    titleEs: "Vivienda habitable en Carolina del Norte",
    summaryEn: `G.S. 42-42 requires fit premises and prompt repair after written notice. Smoke and carbon monoxide alarms use 15 days after receipt. Other conditions use a prompt or reasonable period, not a stored date. G.S. 42-44(c) bars unilateral rent withholding before a court decision. Checked ${CHECKED}.`,
    summaryEs: `G.S. 42-42 exige una vivienda habitable. Las alarmas tienen 15 días. Otra reparación no tiene una fecha fija. No se puede retener la renta por cuenta propia. Revisado el ${CHECKED_ES}.`,
    citation: "N.C. Gen. Stat. § 42-42",
    sourceName: "North Carolina General Assembly",
    sourceUrl: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_42/GS_42-42.html",
  }),
  info({
    id: "NC-42-37.1",
    jurisdiction: "NC",
    topic: "retaliation",
    topics: ["retaliation", "represalia"],
    titleEn: "North Carolina retaliatory-eviction defense",
    titleEs: "Defensa de desalojo por represalia en Carolina del Norte",
    summaryEn: `G.S. 42-37.1 makes retaliatory eviction a defense in a summary ejectment action when the filing is substantially in response to a protected act within the prior 12 months. It is not a finding, and the exceptions in subsection (c) were not decided. Checked ${CHECKED}.`,
    summaryEs: `G.S. 42-37.1 es una defensa en un desalojo sumario dentro de 12 meses. No es una conclusión. Revisado el ${CHECKED_ES}.`,
    citation: "N.C. Gen. Stat. § 42-37.1",
    sourceName: "North Carolina General Assembly",
    sourceUrl: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_42/GS_42-37.1.html",
  }),
  info({
    id: "NC-42-14.1",
    jurisdiction: "NC",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta"],
    titleEn: "North Carolina rent-amount preemption",
    titleEs: "Límite local de renta en Carolina del Norte",
    summaryEn: `G.S. 42-14.1 preempts city and county regulation of the amount of rent for private residential property. The opened chapter states no statewide cap and no general increase-notice period. G.S. 42-14 quit notices were not graded as a rent increase. Checked ${CHECKED}.`,
    summaryEs: `G.S. 42-14.1 impide que una ciudad regule el monto de la renta. No hay un tope estatal. El aviso de G.S. 42-14 no se usó para un aumento. Revisado el ${CHECKED_ES}.`,
    citation: "N.C. Gen. Stat. § 42-14.1",
    sourceName: "North Carolina General Assembly",
    sourceUrl: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_42/GS_42-14.1.html",
  }),
  info({
    id: "PA-1951-512",
    jurisdiction: "PA",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "Pennsylvania escrow return",
    titleEs: "Devolución del depósito en Pensilvania",
    summaryEn: `Section 512 of the Landlord and Tenant Act of 1951 requires a written damage list and the balance within 30 days of termination or surrender and acceptance, whichever is first. Section 511.1 limits the escrow by the year of the lease. The year was not applied as a finding. Checked ${CHECKED}.`,
    summaryEs: `La sección 512 da 30 días para la lista y el saldo. El tope de la sección 511.1 depende del año del contrato. Revisado el ${CHECKED_ES}.`,
    citation: "Landlord and Tenant Act of 1951 § 512",
    sourceName: "Pennsylvania General Assembly",
    sourceUrl: "https://www.legis.state.pa.us/WU01/LI/LI/US/HTM/1951/0/0020.005.000.012.000..HTM",
  }),
  info({
    id: "PA-1951-502A",
    jurisdiction: "PA",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "Pennsylvania common-area duty",
    titleEs: "Deber sobre áreas comunes en Pensilvania",
    summaryEn: `Section 502-A requires reasonable care for safety in common facilities of a tenement or multiple dwelling and states no day count. The opened act does not authorize withholding rent. The City Rent Withholding Act was not opened. Checked ${CHECKED}.`,
    summaryEs: `La sección 502-A exige cuidado razonable en áreas comunes y no fija días. No autoriza retener la renta. Revisado el ${CHECKED_ES}.`,
    citation: "Landlord and Tenant Act of 1951 § 502-A",
    sourceName: "Pennsylvania General Assembly",
    sourceUrl: "https://www.legis.state.pa.us/WU01/LI/LI/US/HTM/1951/0/0020..HTM",
  }),
  info({
    id: "PA-1951-501",
    jurisdiction: "PA",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta", "retaliation", "represalia"],
    titleEn: "Pennsylvania notice to quit",
    titleEs: "Aviso para desocupar en Pensilvania",
    summaryEn: `The 1951 act states no statewide rent cap, no rent-increase notice period, and no general retaliation day count. Section 501's 15-day, 30-day, and 10-day notices are for repossession and were not graded as a rent increase. Checked ${CHECKED}.`,
    summaryEs: `La ley de 1951 no fija un tope de renta ni un plazo general de represalia. La sección 501 es para recuperar la posesión. Revisado el ${CHECKED_ES}.`,
    citation: "Landlord and Tenant Act of 1951 § 501",
    sourceName: "Pennsylvania General Assembly",
    sourceUrl: "https://www.legis.state.pa.us/WU01/LI/LI/US/HTM/1951/0/0020..HTM",
  }),
  info({
    id: "OH-5321.16",
    jurisdiction: "OH",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "Ohio security deposit",
    titleEs: "Depósito de garantía en Ohio",
    summaryEn: `Section 5321.16(B) requires an itemized notice and the amount due within 30 days after termination and delivery of possession. A missing forwarding address affects damages and fees under division (C). The section states no maximum number of months. Checked ${CHECKED}.`,
    summaryEs: `La sección 5321.16(B) da 30 días después de la terminación y la entrega. No fija un máximo de meses. Revisado el ${CHECKED_ES}.`,
    citation: "Ohio Rev. Code § 5321.16",
    sourceName: "Ohio Laws",
    sourceUrl: "https://codes.ohio.gov/ohio-revised-code/section-5321.16",
  }),
  info({
    id: "OH-5321.07",
    jurisdiction: "OH",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "Ohio repair remedies",
    titleEs: "Remedios de reparación en Ohio",
    summaryEn: `Section 5321.04 requires fit premises. Section 5321.07 gives a reasonable time or 30 days, whichever is sooner, after written notice, and then a court deposit, a court order, or termination if the tenant is current in rent. It is not private withholding. Checked ${CHECKED}.`,
    summaryEs: `La sección 5321.07 da un tiempo razonable o 30 días, lo que ocurra primero. Luego permite un depósito judicial, no retener la renta en privado. Revisado el ${CHECKED_ES}.`,
    citation: "Ohio Rev. Code § 5321.07",
    sourceName: "Ohio Laws",
    sourceUrl: "https://codes.ohio.gov/ohio-revised-code/section-5321.07",
  }),
  info({
    id: "OH-5321.02",
    jurisdiction: "OH",
    topic: "retaliation",
    topics: ["retaliation", "represalia"],
    titleEn: "Ohio retaliatory acts",
    titleEs: "Actos de represalia en Ohio",
    summaryEn: `Section 5321.02 prohibits a retaliatory rent increase, decrease in services, or possession action after listed complaints or tenant organizing. It states no day count, so no date was flagged. Section 5321.03 states exceptions that were not decided. Checked ${CHECKED}.`,
    summaryEs: `La sección 5321.02 prohíbe represalias y no fija días. No se marcó una fecha. Revisado el ${CHECKED_ES}.`,
    citation: "Ohio Rev. Code § 5321.02",
    sourceName: "Ohio Laws",
    sourceUrl: "https://codes.ohio.gov/ohio-revised-code/section-5321.02",
  }),
  info({
    id: "OH-5321.19",
    jurisdiction: "OH",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta"],
    titleEn: "Ohio rent-control preemption",
    titleEs: "Prohibición del control de renta en Ohio",
    summaryEn: `Section 5321.19 preempts local rent control and rent stabilization for tenancies regulated by the chapter. The chapter states no statewide cap and no increase-notice period. Section 5321.17's termination notices were not graded as a rent increase. Checked ${CHECKED}.`,
    summaryEs: `La sección 5321.19 impide el control local de renta. No hay un tope estatal. La sección 5321.17 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`,
    citation: "Ohio Rev. Code § 5321.19",
    sourceName: "Ohio Laws",
    sourceUrl: "https://codes.ohio.gov/ohio-revised-code/section-5321.19",
  }),
  info({
    id: "DC-42-3502.17",
    jurisdiction: "DC",
    topic: "deposit",
    topics: ["security deposit", "deposito", "depósito"],
    titleEn: "District of Columbia security deposit notice",
    titleEs: "Aviso del depósito en el Distrito de Columbia",
    summaryEn: `D.C. Code § 42-3502.17(e) requires a written notice of alleged unpaid amounts within 45 days after termination, and gives the tenant 30 calendar days after service to dispute it. No single refund date was stored. Ordinary wear and tear may not be withheld. 14 DCMR was not opened. Checked ${CHECKED}.`,
    summaryEs: `La sección 42-3502.17(e) da 45 días para avisar montos alegados y 30 días para disputarlos. No se guardó una sola fecha de devolución. Revisado el ${CHECKED_ES}.`,
    citation: "D.C. Code § 42-3502.17",
    sourceName: "Council of the District of Columbia",
    sourceUrl: "https://code.dccouncil.gov/us/dc/council/code/sections/42-3502.17",
  }),
  info({
    id: "DC-42-3509.08",
    jurisdiction: "DC",
    topic: "repair",
    topics: ["repair", "habitability", "reparacion", "reparación"],
    titleEn: "District of Columbia inspection and repairs",
    titleEs: "Inspección y reparaciones en el Distrito de Columbia",
    summaryEn: `D.C. Code § 42-3509.08 authorizes inspections. Its 30-day abatement subsections are marked not funded and were not used. Section 42-3505.51's 48 hours are for entry, not a repair deadline. No date was stored, and the period is not permission to withhold rent. Checked ${CHECKED}.`,
    summaryEs: `El plazo de 30 días de § 42-3509.08 no está financiado y no se usó. No se guardó una fecha ni un permiso para retener la renta. Revisado el ${CHECKED_ES}.`,
    citation: "D.C. Code § 42-3509.08",
    sourceName: "Council of the District of Columbia",
    sourceUrl: "https://code.dccouncil.gov/us/dc/council/code/sections/42-3509.08",
  }),
  info({
    id: "DC-42-3505.02",
    jurisdiction: "DC",
    topic: "retaliation",
    topics: ["retaliation", "represalia"],
    titleEn: "District of Columbia retaliatory action",
    titleEs: "Acción de represalia en el Distrito de Columbia",
    summaryEn: `D.C. Code § 42-3505.02 presumes retaliation, rebuttable by clear and convincing evidence, when a listed tenant act occurred within the six months before the housing provider's action. It is not a finding and not permission to withhold rent. Checked ${CHECKED}.`,
    summaryEs: `La sección 42-3505.02 presume represalia dentro de seis meses. No es una conclusión ni permiso para retener la renta. Revisado el ${CHECKED_ES}.`,
    citation: "D.C. Code § 42-3505.02",
    sourceName: "Council of the District of Columbia",
    sourceUrl: "https://code.dccouncil.gov/us/dc/council/code/sections/42-3505.02",
  }),
  info({
    id: "DC-42-3502.08",
    jurisdiction: "DC",
    topic: "rent-increase",
    topics: ["rent increase", "aumento de renta", "rent stabilization"],
    titleEn: "District of Columbia rent stabilization not applied",
    titleEs: "Estabilización de renta del Distrito no aplicada",
    summaryEn: `D.C. Code § 42-3502.08 is the rent-stabilization increase section. It was not applied, no published adjustment was used, and no percentage comparison was made. Checked ${CHECKED}.`,
    summaryEs: `La sección 42-3502.08 es la de estabilización de renta. No se aplicó ni se comparó un porcentaje. Revisado el ${CHECKED_ES}.`,
    citation: "D.C. Code § 42-3502.08",
    sourceName: "Council of the District of Columbia",
    sourceUrl: "https://code.dccouncil.gov/us/dc/council/code/sections/42-3502.08",
  }),
];
