import { addDays, addMonths } from "@/lib/rules/dates";
import { rule, type Rule } from "@/lib/rules/define";

const CHECKED = "Nov 14, 2026";
const CHECKED_ES = "14 de noviembre de 2026";
export const BATCH3_STATES = ["IN", "SC", "CT", "IA"] as const;
export type Batch3State = (typeof BATCH3_STATES)[number];

type Stamp = {
  dueDate: string | null;
  ruleId: string;
  citation: string;
  explanation: string;
  explanationEs: string;
  computation: string;
  unsure: boolean;
};

export function isBatch3(state: string): state is Batch3State {
  return (BATCH3_STATES as readonly string[]).includes(state);
}

function percent(lowestCents: number, proposedCents: number): string {
  const value = Math.round(((proposedCents - lowestCents) * 1_000_000) / lowestCents);
  return (value / 10_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function info(input: {
  id: string; jurisdiction: Batch3State; topic: string; topics: string[];
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

export function batch3Deposit(state: string, triggerDate: string): Stamp | null {
  if (!isBatch3(state)) return null;
  if (state === "IN") {
    const due = addDays(triggerDate, 45);
    return {
      dueDate: due, ruleId: "IN-32-31-3-12", citation: "Ind. Code § 32-31-3-12", unsure: true,
      computation: `${triggerDate} + 45 days = ${due}. The statute also requires delivery of possession and a written mailing address.`,
      explanation: `IC 32-31-3-12 says the landlord shall return the security deposit, minus itemized accrued rent, damages, and unpaid utility or sewer charges the tenant owes, not more than 45 days after termination of the rental agreement and delivery of possession. The landlord is not liable under the chapter until the tenant supplies a written mailing address. Using ${triggerDate} as termination and delivery of possession, the date is ${due}. It is unsure because the written address was not entered. The opened section does not state a maximum number of months. A tenant is not entitled to apply the deposit to rent unless otherwise agreed. Checked ${CHECKED}.`,
      explanationEs: `IC 32-31-3-12 da 45 días después de la terminación y la entrega, y exige una dirección por escrito. La fecha es incierta. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "SC") {
    const due = addDays(triggerDate, 30);
    return {
      dueDate: due, ruleId: "SC-27-40-410", citation: "S.C. Code § 27-40-410", unsure: true,
      computation: `${triggerDate} + 30 days = ${due}. The statute uses the later of termination plus delivery of possession, and the tenant's demand.`,
      explanation: `Section 27-40-410 says any deduction must be itemized with the amount due within 30 days after termination of the tenancy and delivery of possession and demand by the tenant, whichever is later. Using ${triggerDate} as that later event, the date is ${due}. It is unsure because the other events were not entered separately. If the tenant gives no forwarding address, damages under the subsection are unavailable when the landlord had no notice of the tenant's whereabouts and mailed the notice to the last known address. The opened section does not state a maximum number of months. Checked ${CHECKED}.`,
      explanationEs: `La sección 27-40-410 da 30 días después del hecho más tardío entre la terminación con entrega y el requerimiento. La fecha es incierta. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "CT") {
    const afterEnd = addDays(triggerDate, 21);
    const afterAddress = addDays(triggerDate, 15);
    return {
      dueDate: null, ruleId: "CT-47a-21", citation: "Conn. Gen. Stat. § 47a-21", unsure: true,
      computation: `Termination ${triggerDate} plus 21 days would be ${afterEnd}. Fifteen days after a forwarding-address notice would be ${afterAddress} if that notice were given the same day. The statute uses whichever is later.`,
      explanation: `Section 47a-21(d) says the landlord shall deliver the deposit and accrued interest, or the balance with an itemized statement, not later than 21 days after termination or 15 days after written notice of a forwarding address, whichever is later. No single date was stored. A tenant under 62 may be charged no more than two months' rent. A tenant 62 or older may be charged no more than one month's rent. Age was not entered, so no cap was applied as a finding. Interest uses the deposit index and was not calculated. Checked ${CHECKED}.`,
      explanationEs: `La sección 47a-21 usa 21 días después de la terminación o 15 días después de la dirección, lo que sea después. No se guardó una sola fecha. El tope depende de la edad y no se aplicó. Revisado el ${CHECKED_ES}.`,
    };
  }
  const due = addDays(triggerDate, 30);
  return {
    dueDate: due, ruleId: "IA-562A.12", citation: "Iowa Code § 562A.12", unsure: true,
    computation: `${triggerDate} + 30 days = ${due}. The clock also waits for the tenant's mailing address or delivery instructions.`,
    explanation: `Section 562A.12 limits a security deposit to two months' rent. The landlord shall, within 30 days from termination and receipt of the tenant's mailing address or delivery instructions, return the deposit or furnish a written statement of the specific reason for withholding. Using ${triggerDate} as termination, the date is ${due}. It is unsure because receipt of the address was not entered. Ordinary wear and tear is excluded. If no address is provided within one year, the deposit reverts to the landlord. Checked ${CHECKED}.`,
    explanationEs: `La sección 562A.12 limita el depósito a dos meses y da 30 días después de la terminación y de recibir una dirección. La fecha es incierta. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch3Repair(state: string, requestDate: string): Stamp | null {
  if (!isBatch3(state)) return null;
  const base = { dueDate: null as string | null, unsure: true, computation: `Notice ${requestDate}. No single repair date was stored.` };
  if (state === "IN") return { ...base, ruleId: "IN-32-31-8-5", citation: "Ind. Code § 32-31-8-5", explanation: `IC 32-31-8-5 requires a safe, clean, and habitable rental premises, compliance with health and housing codes, and maintenance of supplied systems. IC 32-31-8-6 says a court action requires notice and a reasonable amount of time to repair. It states no number of days, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `IC 32-31-8 no fija un número de días. No se guardó una fecha. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  if (state === "SC") return { ...base, ruleId: "SC-27-40-440", citation: "S.C. Code § 27-40-440", explanation: `Section 27-40-440 requires the landlord to keep the premises fit and habitable and to maintain supplied facilities. It states no repair day count. Section 27-40-610 is a 14-day written notice before the tenant may end the agreement, and section 27-40-630 says the essential-services section does not authorize the tenant to make repairs and deduct the cost. Neither path was stored as a repair deadline from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 27-40-440 no fija un plazo. El aviso de 14 días es para terminar el contrato, no un permiso para descontar. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  if (state === "CT") return { ...base, ruleId: "CT-47a-7", citation: "Conn. Gen. Stat. § 47a-7", explanation: `Section 47a-7 requires the landlord to keep the premises fit and habitable and to maintain supplied facilities. It states no repair day count. Section 47a-12 lets a tenant end the agreement if a material health or safety breach is not remedied within 15 days after notice. Section 47a-13 is a separate essential-services path. Neither was stored as a repair deadline from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 47a-7 no fija un plazo de reparación. El aviso de 15 días es para terminar el contrato. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
  return { ...base, ruleId: "IA-562A.15", citation: "Iowa Code § 562A.15", explanation: `Section 562A.15 requires the landlord to comply with building and housing codes that materially affect health and safety and to keep the premises fit and habitable. It states no repair day count, so no date was stored from ${requestDate}. ${NOT} Checked ${CHECKED}.`, explanationEs: `La sección 562A.15 no fija un número de días. No se guardó una fecha. ${NOT_ES} Revisado el ${CHECKED_ES}.` };
}

export function batch3Retaliation(state: string, activityDate: string, noticeDate: string, daysSince: number): (Stamp & { flagged: boolean; daysSince: number }) | null {
  if (!isBatch3(state)) return null;
  if (state === "CT") {
    const end = addMonths(activityDate, 6);
    const flagged = daysSince >= 0 && noticeDate <= end;
    return {
      flagged, daysSince, dueDate: null, ruleId: "CT-47a-20", citation: "Conn. Gen. Stat. § 47a-20", unsure: false,
      computation: `${activityDate} plus six months = ${end}.`,
      explanation: flagged
        ? `The later date is inside six months (${end}). Section 47a-20 says a landlord shall not bring a possession action, demand a rent increase, or decrease services within six months after a listed tenant act, including a good-faith repair request. It is not a finding. Section 47a-20a lists acts that are not retaliatory, including nonpayment and a notice given before the complaint. Those were not decided. Checked ${CHECKED}.`
        : `The later date is outside six months (${end}). Being outside section 47a-20 is not a finding that the act was lawful. Checked ${CHECKED}.`,
      explanationEs: flagged
        ? `La fecha posterior está dentro de seis meses (${end}). No es una conclusión. Revisado el ${CHECKED_ES}.`
        : `La fecha posterior está fuera de seis meses (${end}). Estar fuera no significa que el acto sea lícito. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "IA") {
    const end = addMonths(activityDate, 12);
    const flagged = daysSince >= 0 && noticeDate <= end;
    return {
      flagged, daysSince, dueDate: null, ruleId: "IA-562A.36", citation: "Iowa Code § 562A.36", unsure: false,
      computation: `${activityDate} plus one year = ${end}.`,
      explanation: flagged
        ? `The later date is inside one year (${end}). Section 562A.36 says a good-faith complaint within one year before the alleged act creates a presumption of retaliation. The presumption does not arise if the complaint came after notice of a proposed rent increase. A cost increase can rebut the presumption when the rent increase matches it. It is not a finding. Checked ${CHECKED}.`
        : `The later date is outside one year (${end}). Being outside the presumption is not a finding that the act was lawful. Checked ${CHECKED}.`,
      explanationEs: flagged
        ? `La fecha posterior está dentro de un año (${end}). Hay una presunción, no una conclusión. Revisado el ${CHECKED_ES}.`
        : `La fecha posterior está fuera de un año (${end}). Estar fuera no significa que el acto sea lícito. Revisado el ${CHECKED_ES}.`,
    };
  }
  if (state === "IN") {
    return {
      flagged: false, daysSince, dueDate: null, ruleId: "IN-32-31-8.5-5", citation: "Ind. Code § 32-31-8.5-5", unsure: true,
      computation: "No day count. IC 32-31-8.5 does not state a number of days.",
      explanation: `IC 32-31-8.5-5 says a landlord may not engage in a retaliatory act, including a rent increase, a service cut, or a possession action, in response to a listed protected activity. The chapter states no number of days, so no date was flagged. A landlord may still raise rent to comparable market rentals and may decline to renew at the end of the term. Those exceptions were not decided. IC 32-31-8.5-6 says a local unit may not regulate retaliatory acts. It is not a finding. Checked ${CHECKED}.`,
      explanationEs: `IC 32-31-8.5 no fija días, así que no se marcó una fecha. No es una conclusión. Revisado el ${CHECKED_ES}.`,
    };
  }
  return {
    flagged: false, daysSince, dueDate: null, ruleId: "SC-27-40-910", citation: "S.C. Code § 27-40-910", unsure: true,
    computation: "No general day count. A 75-day possession limit applies only to a retaliatory refusal to renew.",
    explanation: `Section 27-40-910 says a landlord shall not retaliate by raising rent above fair-market value, decreasing essential services, or bringing a possession action after a code complaint or a complaint under the chapter. It states no general number of days, so no date was flagged. If the landlord refuses to renew because of protected conduct and the tenant is not in default, the landlord may not recover possession for 75 days. That path was not applied because a refusal to renew was not entered. A uniform increase, or an increase that does not exceed fair-market value, is not presumed retaliatory for a landlord of more than four adjoining units. It is not a finding. Checked ${CHECKED}.`,
    explanationEs: `La sección 27-40-910 no fija un plazo general, así que no se marcó una fecha. El límite de 75 días es solo para no renovar por represalia. Revisado el ${CHECKED_ES}.`,
  };
}

export function batch3Rent(state: string, lowestCents: number, proposedCents: number) {
  if (!isBatch3(state)) return null;
  const amount = percent(lowestCents, proposedCents);
  const base = { abovePublishedMax: false as const };
  if (state === "IN") return { ...base, headlineEn: "Indiana rent increase", headlineEs: "Aumento de renta en Indiana", ruleId: "IN-32-31-5-4", detailEn: `The increase from the amounts entered is about ${amount}%. The chapters opened on ${CHECKED} do not state a statewide percentage cap. IC 32-31-5-4 says that, unless a written rental agreement provides otherwise, the landlord shall give at least 30 days' written notice before modifying the rental agreement. Whether the agreement sets a different notice was not entered, so no notice period was graded. A retaliatory increase is a separate limit under IC 32-31-8.5. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. No hay un tope estatal. El aviso de 30 días no se calificó porque el contrato puede fijar otro plazo. Revisado el ${CHECKED_ES}.` };
  if (state === "SC") return { ...base, headlineEn: "South Carolina rent increase", headlineEs: "Aumento de renta en Carolina del Sur", ruleId: "SC-27-40-310", detailEn: `The increase from the amounts entered is about ${amount}%. Chapter 27-40, as opened on ${CHECKED}, does not state a statewide percentage cap or a rent-increase notice period. No notice period was graded. Section 27-40-770 lets either party end a week-to-week tenancy with at least 7 days' written notice and a month-to-month tenancy with at least 30 days' written notice. Those periods were not graded as a rent increase. A retaliatory increase above fair-market value is a separate limit under section 27-40-910. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. El capítulo no fija un tope ni un aviso de aumento. La sección 27-40-770 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.` };
  if (state === "CT") return { ...base, headlineEn: "Connecticut rent increase", headlineEs: "Aumento de renta en Connecticut", ruleId: "CT-47a-4e", detailEn: `The increase from the amounts entered is about ${amount}%. Section 47a-4e says a rent increase is not effective unless the landlord gives written notice at least 45 days before the proposed effective date, or, for a lease of one month or less, a number of days equal to a full term. The lease length was not entered, so no notice period was graded. The section states no percentage cap and does not allow an increase during the term of a rental agreement. Failure to answer the notice is not agreement to the increase. A retaliatory demand is a separate limit under section 47a-20. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. La sección 47a-4e exige 45 días, o el plazo del contrato si es de un mes o menos. No se calificó porque no se indicó el plazo. Revisado el ${CHECKED_ES}.` };
  return { ...base, headlineEn: "Iowa rent increase", headlineEs: "Aumento de renta en Iowa", ruleId: "IA-562A.13", detailEn: `The increase from the amounts entered is about ${amount}%. Section 562A.13(5) says each tenant shall be notified in writing of any rent increase at least 30 days before the effective date, and that date shall not be sooner than the expiration of the original rental agreement or any renewal or extension. The expiration date was not entered, so no notice period was graded. The section states no percentage cap. A retaliatory increase is a separate limit under section 562A.36. Checked ${CHECKED}.`, detailEs: `El aumento es de alrededor del ${amount}%. La sección 562A.13 exige 30 días y que la fecha no sea antes del fin del contrato. No se calificó. Revisado el ${CHECKED_ES}.` };
}

export function batch3RepairLetter(state: string, locale: "en" | "es"): string | null {
  if (!isBatch3(state)) return null;
  const en: Record<Batch3State, string> = {
    IN: "I am asking you to address this repair. Indiana Code § 32-31-8-5 does not set a number of days. This letter is not a court filing and it is not a notice that I am withholding rent. I confirm this message before it is sent.",
    SC: "I am asking you to address this repair. South Carolina Code § 27-40-440 does not set a repair deadline. This letter is not a 14-day termination notice and it is not a notice that I will repair and deduct. I confirm this message before it is sent.",
    CT: "I am asking you to address this repair. Connecticut General Statutes § 47a-7 does not set a repair deadline. This letter is not a notice that I am ending the tenancy or withholding rent. I confirm this message before it is sent.",
    IA: "I am asking you to address this repair. Iowa Code § 562A.15 does not set a number of days. This letter is not a notice that I am withholding rent or ending the tenancy. I confirm this message before it is sent.",
  };
  const es: Record<Batch3State, string> = {
    IN: "Le pido que atienda esta reparación. El código de Indiana no fija un número de días. Esta carta no es una demanda ni un aviso de que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    SC: "Le pido que atienda esta reparación. Esta carta no es un aviso de 14 días para terminar el contrato ni un aviso de que repararé y descontaré. Confirmo este mensaje antes de enviarlo.",
    CT: "Le pido que atienda esta reparación. El estatuto de Connecticut no fija un plazo de reparación. Esta carta no avisa que termino el arrendamiento ni que retengo la renta. Confirmo este mensaje antes de enviarlo.",
    IA: "Le pido que atienda esta reparación. El código de Iowa no fija un número de días. Esta carta no avisa que retengo la renta ni que termino el arrendamiento. Confirmo este mensaje antes de enviarlo.",
  };
  return locale === "es" ? es[state] : en[state];
}

export const BATCH3_RULES: Rule[] = [
  info({ id: "IN-32-31-3-12", jurisdiction: "IN", topic: "deposit", topics: ["security deposit", "deposito", "depósito"], titleEn: "Indiana security deposit", titleEs: "Depósito en Indiana", summaryEn: `IC 32-31-3-12 requires an itemized return not more than 45 days after termination and delivery of possession. The landlord is not liable until the tenant gives a written mailing address. The section states no maximum number of months. Checked ${CHECKED}.`, summaryEs: `IC 32-31-3-12 da 45 días y exige una dirección por escrito. No fija un máximo de meses. Revisado el ${CHECKED_ES}.`, citation: "Ind. Code § 32-31-3-12", sourceName: "Indiana General Assembly", sourceUrl: "https://iga.in.gov/ic/2026/Title_32/Article_31/Chapter_3.pdf" }),
  info({ id: "IN-32-31-8-5", jurisdiction: "IN", topic: "repair", topics: ["repair", "habitability", "reparacion", "reparación"], titleEn: "Indiana landlord obligations", titleEs: "Obligaciones del propietario en Indiana", summaryEn: `IC 32-31-8-5 requires a safe, clean, and habitable premises and maintenance of supplied systems. A court action under IC 32-31-8-6 requires notice and a reasonable time. No day count is stated, and the time is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `IC 32-31-8 no fija días y no es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Ind. Code § 32-31-8-5", sourceName: "Indiana General Assembly", sourceUrl: "https://iga.in.gov/ic/2026/Title_32/Article_31/Chapter_8.pdf" }),
  info({ id: "IN-32-31-8.5-5", jurisdiction: "IN", topic: "retaliation", topics: ["retaliation", "represalia"], titleEn: "Indiana retaliatory acts", titleEs: "Actos de represalia en Indiana", summaryEn: `IC 32-31-8.5-5 prohibits a retaliatory rent increase, service cut, or possession action after a protected activity. It states no number of days. A comparable market increase is not prohibited. Local units may not regulate retaliatory acts. Checked ${CHECKED}.`, summaryEs: `IC 32-31-8.5 no fija días. Un aumento al precio de mercado comparable no está prohibido. Revisado el ${CHECKED_ES}.`, citation: "Ind. Code § 32-31-8.5-5", sourceName: "Indiana General Assembly", sourceUrl: "https://iga.in.gov/ic/2026/Title_32/Article_31/Chapter_8.5.pdf" }),
  info({ id: "IN-32-31-5-4", jurisdiction: "IN", topic: "rent-increase", topics: ["rent increase", "aumento de renta"], titleEn: "Indiana notice to modify a rental agreement", titleEs: "Aviso para modificar el contrato en Indiana", summaryEn: `IC 32-31-5-4 requires at least 30 days' written notice before modifying a rental agreement unless the written agreement provides otherwise. The opened chapters state no percentage cap. The notice was not graded. Checked ${CHECKED}.`, summaryEs: `IC 32-31-5-4 exige 30 días salvo que el contrato escrito diga otra cosa. No hay un tope estatal. Revisado el ${CHECKED_ES}.`, citation: "Ind. Code § 32-31-5-4", sourceName: "Indiana General Assembly", sourceUrl: "https://iga.in.gov/ic/2026/Title_32/Article_31/Chapter_5.pdf" }),
  info({ id: "SC-27-40-410", jurisdiction: "SC", topic: "deposit", topics: ["security deposit", "deposito", "depósito"], titleEn: "South Carolina security deposit", titleEs: "Depósito en Carolina del Sur", summaryEn: `Section 27-40-410 requires an itemized notice within 30 days after the later of termination and delivery of possession, and the tenant's demand. The opened section states no maximum number of months. Checked ${CHECKED}.`, summaryEs: `La sección 27-40-410 da 30 días después del hecho más tardío. No fija un máximo de meses. Revisado el ${CHECKED_ES}.`, citation: "S.C. Code § 27-40-410", sourceName: "South Carolina Legislature", sourceUrl: "https://www.scstatehouse.gov/code/t27c040.php" }),
  info({ id: "SC-27-40-440", jurisdiction: "SC", topic: "repair", topics: ["repair", "habitability", "reparacion", "reparación"], titleEn: "South Carolina fit premises", titleEs: "Vivienda habitable en Carolina del Sur", summaryEn: `Section 27-40-440 requires fit and habitable premises. Section 27-40-610 is a 14-day notice before termination, and section 27-40-630 says the tenant may not repair and deduct. Neither was stored as permission. Checked ${CHECKED}.`, summaryEs: `La sección 27-40-440 no fija un plazo. No se autoriza reparar y descontar. Revisado el ${CHECKED_ES}.`, citation: "S.C. Code § 27-40-440", sourceName: "South Carolina Legislature", sourceUrl: "https://www.scstatehouse.gov/code/t27c040.php" }),
  info({ id: "SC-27-40-910", jurisdiction: "SC", topic: "retaliation", topics: ["retaliation", "represalia"], titleEn: "South Carolina retaliatory conduct", titleEs: "Conducta de represalia en Carolina del Sur", summaryEn: `Section 27-40-910 prohibits a retaliatory rent increase above fair-market value, a cut in essential services, or a possession action after a listed complaint. It states no general day count. A 75-day limit applies only to a retaliatory refusal to renew. Checked ${CHECKED}.`, summaryEs: `La sección 27-40-910 no fija un plazo general. El límite de 75 días es solo para no renovar. Revisado el ${CHECKED_ES}.`, citation: "S.C. Code § 27-40-910", sourceName: "South Carolina Legislature", sourceUrl: "https://www.scstatehouse.gov/code/t27c040.php" }),
  info({ id: "SC-27-40-310", jurisdiction: "SC", topic: "rent-increase", topics: ["rent increase", "aumento de renta"], titleEn: "South Carolina rent change", titleEs: "Cambio de renta en Carolina del Sur", summaryEn: `Chapter 27-40 does not state a statewide percentage cap or a rent-increase notice. Section 27-40-770's 7-day and 30-day notices end a periodic tenancy and were not graded as a rent increase. Checked ${CHECKED}.`, summaryEs: `El capítulo no fija un tope ni un aviso de aumento. La sección 27-40-770 no se usó para calificar un aumento. Revisado el ${CHECKED_ES}.`, citation: "S.C. Code § 27-40-310", sourceName: "South Carolina Legislature", sourceUrl: "https://www.scstatehouse.gov/code/t27c040.php" }),
  info({ id: "CT-47a-21", jurisdiction: "CT", topic: "deposit", topics: ["security deposit", "deposito", "depósito"], titleEn: "Connecticut security deposit", titleEs: "Depósito en Connecticut", summaryEn: `Section 47a-21 limits a deposit to two months' rent, or one month if the tenant is 62 or older. Return is the later of 21 days after termination and 15 days after a forwarding address. Age was not applied as a cap. Interest was not calculated. Checked ${CHECKED}.`, summaryEs: `La sección 47a-21 limita el depósito según la edad y usa 21 o 15 días, lo que sea después. No se aplicó un tope. Revisado el ${CHECKED_ES}.`, citation: "Conn. Gen. Stat. § 47a-21", sourceName: "Connecticut General Assembly", sourceUrl: "https://www.cga.ct.gov/current/pub/chap_831.htm" }),
  info({ id: "CT-47a-7", jurisdiction: "CT", topic: "repair", topics: ["repair", "habitability", "reparacion", "reparación"], titleEn: "Connecticut landlord responsibilities", titleEs: "Deberes del propietario en Connecticut", summaryEn: `Section 47a-7 requires fit and habitable premises and maintenance of supplied facilities. It states no repair day count. The 15-day and 48-hour paths in sections 47a-12 and 47a-13 were not stored as permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 47a-7 no fija un plazo de reparación. No es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Conn. Gen. Stat. § 47a-7", sourceName: "Connecticut General Assembly", sourceUrl: "https://www.cga.ct.gov/current/pub/chap_830.htm" }),
  info({ id: "CT-47a-20", jurisdiction: "CT", topic: "retaliation", topics: ["retaliation", "represalia"], titleEn: "Connecticut retaliatory action", titleEs: "Acción de represalia en Connecticut", summaryEn: `Section 47a-20 bars a possession action, a rent increase demand, or a service cut within six months after a listed tenant act. Section 47a-20a names exceptions, including nonpayment. A date inside six months is not a finding. Checked ${CHECKED}.`, summaryEs: `La sección 47a-20 cubre seis meses. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "Conn. Gen. Stat. § 47a-20", sourceName: "Connecticut General Assembly", sourceUrl: "https://www.cga.ct.gov/current/pub/chap_830.htm" }),
  info({ id: "CT-47a-4e", jurisdiction: "CT", topic: "rent-increase", topics: ["rent increase", "aumento de renta"], titleEn: "Connecticut rent-increase notice", titleEs: "Aviso de aumento en Connecticut", summaryEn: `Section 47a-4e requires written notice at least 45 days before a rent increase, or a period equal to the term if the lease is one month or less. It states no percentage cap and does not allow an increase during the term. The notice was not graded. Checked ${CHECKED}.`, summaryEs: `La sección 47a-4e exige 45 días, o el plazo si el contrato es de un mes o menos. No se calificó. Revisado el ${CHECKED_ES}.`, citation: "Conn. Gen. Stat. § 47a-4e", sourceName: "Connecticut General Assembly", sourceUrl: "https://www.cga.ct.gov/current/pub/chap_830.htm" }),
  info({ id: "IA-562A.12", jurisdiction: "IA", topic: "deposit", topics: ["security deposit", "deposito", "depósito"], titleEn: "Iowa rental deposit", titleEs: "Depósito en Iowa", summaryEn: `Section 562A.12 limits a deposit to two months' rent and requires return or a written statement within 30 days after termination and receipt of a mailing address. Ordinary wear and tear is excluded. Checked ${CHECKED}.`, summaryEs: `La sección 562A.12 limita el depósito a dos meses y da 30 días después de recibir una dirección. Revisado el ${CHECKED_ES}.`, citation: "Iowa Code § 562A.12", sourceName: "Iowa Legislature", sourceUrl: "https://www.legis.iowa.gov/docs/code/2026/562A.pdf" }),
  info({ id: "IA-562A.15", jurisdiction: "IA", topic: "repair", topics: ["repair", "habitability", "reparacion", "reparación"], titleEn: "Iowa fit premises", titleEs: "Vivienda habitable en Iowa", summaryEn: `Section 562A.15 requires the landlord to keep the premises fit and habitable and to comply with codes that materially affect health and safety. It states no day count and is not permission to withhold rent. Checked ${CHECKED}.`, summaryEs: `La sección 562A.15 no fija días y no es permiso para retener la renta. Revisado el ${CHECKED_ES}.`, citation: "Iowa Code § 562A.15", sourceName: "Iowa Legislature", sourceUrl: "https://www.legis.iowa.gov/docs/code/2026/562A.pdf" }),
  info({ id: "IA-562A.36", jurisdiction: "IA", topic: "retaliation", topics: ["retaliation", "represalia"], titleEn: "Iowa retaliatory conduct", titleEs: "Conducta de represalia en Iowa", summaryEn: `Section 562A.36 prohibits a retaliatory rent increase, service cut, or possession action. A good-faith complaint within one year creates a presumption, unless the complaint followed notice of a proposed increase. It is not a finding. Checked ${CHECKED}.`, summaryEs: `La sección 562A.36 crea una presunción dentro de un año. No es una conclusión. Revisado el ${CHECKED_ES}.`, citation: "Iowa Code § 562A.36", sourceName: "Iowa Legislature", sourceUrl: "https://www.legis.iowa.gov/docs/code/2026/562A.pdf" }),
  info({ id: "IA-562A.13", jurisdiction: "IA", topic: "rent-increase", topics: ["rent increase", "aumento de renta"], titleEn: "Iowa rent-increase notice", titleEs: "Aviso de aumento en Iowa", summaryEn: `Section 562A.13(5) requires written notice of a rent increase at least 30 days before the effective date, and that date may not be before the end of the agreement or any renewal. There is no percentage cap. The notice was not graded. Checked ${CHECKED}.`, summaryEs: `La sección 562A.13 exige 30 días y que la fecha no sea antes del fin del contrato. No se calificó. Revisado el ${CHECKED_ES}.`, citation: "Iowa Code § 562A.13", sourceName: "Iowa Legislature", sourceUrl: "https://www.legis.iowa.gov/docs/code/2026/562A.pdf" }),
];
