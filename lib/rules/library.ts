import { LIBRARY_VERSION } from "@/lib/disclaimer";

export type RuleJurisdiction = "CA" | "CITY_LA" | "LA_COUNTY" | "CITY_SD";
export type FindingLabel = "likely_unenforceable" | "check_this" | "looks_standard" | "informational";

export type Rule = {
  id: string;
  version: string;
  jurisdiction: RuleJurisdiction;
  topic: string;
  topics: string[];
  titleEn: string;
  titleEs: string;
  summaryEn: string;
  summaryEs: string;
  citation: string;
  sourceName: string;
  sourceUrl: string;
  clinicReview: "pending_clinic_review";
  spanishReview: "pending_volunteer_review";
  placeholder: true;
  findingLabel: FindingLabel;
  confidence: "high" | "medium" | "low";
  reasonEn: string;
  reasonEs: string;
  patterns: RegExp[];
};

const V = LIBRARY_VERSION;

function rule(partial: Omit<Rule, "version" | "clinicReview" | "spanishReview" | "placeholder">): Rule {
  return {
    ...partial,
    version: V,
    clinicReview: "pending_clinic_review",
    spanishReview: "pending_volunteer_review",
    placeholder: true,
  };
}

export const RULES: Rule[] = [
  rule({
    id: "CA-CC-1941",
    jurisdiction: "CA",
    topic: "habitability",
    topics: ["habitability", "repairs", "uninhabitable", "habitabilidad", "reparaciones"],
    titleEn: "Landlord duty to keep a unit habitable",
    titleEs: "Deber del propietario de mantener la vivienda habitable",
    summaryEn:
      "Civil Code §1941 requires a residential landlord to put a unit into a condition fit for human occupancy and to repair later dilapidations that make it untenantable, if the landlord is given notice and the tenant did not cause the damage. This is a summary of the statute, not a finding about a particular home.",
    summaryEs:
      "El Código Civil §1941 exige que el propietario ponga la vivienda en condiciones de habitación humana y repare después los deterioros que la hagan inhabitable, si se le avisa y el inquilino no causó el daño. Es un resumen de la ley, no una conclusión sobre una vivienda concreta.",
    citation: "Cal. Civ. Code §1941",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1941",
    findingLabel: "informational",
    confidence: "medium",
    reasonEn: "Background rule on the repair duty. It does not, by itself, grade a lease clause.",
    reasonEs: "Regla de contexto sobre el deber de reparar. Por sí sola no califica una cláusula.",
    patterns: [],
  }),
  rule({
    id: "CA-CC-1941.1",
    jurisdiction: "CA",
    topic: "habitability",
    topics: ["habitability", "heat", "water", "mold", "pests", "waterproof", "habitabilidad", "calefacción", "agua", "moho", "plagas"],
    titleEn: "What makes a unit untenantable",
    titleEs: "Qué hace que una vivienda sea inhabitable",
    summaryEn:
      "Civil Code §1941.1 lists conditions that make a dwelling untenantable, including effective waterproofing and weather protection, working plumbing and hot water, heat, electricity, clean grounds, enough trash receptacles, and floors, stairways, and railings in good repair. A unit with lead hazards, visible mold the landlord has notice of, or a gas facility that does not meet the law can also be untenantable. Local health and building codes still apply.",
    summaryEs:
      "El Código Civil §1941.1 enumera condiciones que hacen una vivienda inhabitable, entre ellas impermeabilización, plomería y agua caliente, calefacción, electricidad, áreas limpias, botes de basura suficientes, y pisos, escaleras y barandales en buen estado. El plomo, el moho visible del que el propietario tiene aviso, o una instalación de gas ilegal también pueden hacerla inhabitable. Los códigos locales de salud y construcción siguen aplicando.",
    citation: "Cal. Civ. Code §1941.1",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1941.1",
    findingLabel: "informational",
    confidence: "medium",
    reasonEn: "Background list of habitability conditions.",
    reasonEs: "Lista de contexto sobre condiciones de habitabilidad.",
    patterns: [],
  }),
  rule({
    id: "CA-CC-1942",
    jurisdiction: "CA",
    topic: "repairs",
    topics: ["repair and deduct", "30 days", "reasonable time", "reparar", "30 días", "plazo razonable"],
    titleEn: "Repair-and-deduct and a presumptively reasonable time",
    titleEs: "Reparar y descontar, y un plazo presuntamente razonable",
    summaryEn:
      "Civil Code §1942 allows a tenant, in limited cases and only twice in a 12-month period, to repair serious defects and deduct the cost (up to one month's rent) if the landlord fails to fix them within a reasonable time after notice. Thirty days is presumed reasonable. A shorter time can be reasonable if the condition is urgent. The statute has notice and good-faith conditions. Rent Right uses 30 days as the standard reminder and shorter reminder presets for urgent conditions. Those shorter presets are not statutory numbers of days.",
    summaryEs:
      "El Código Civil §1942 permite, en casos limitados y solo dos veces en 12 meses, que el inquilino repare defectos graves y descuente el costo (hasta un mes de renta) si el propietario no los arregla en un plazo razonable después del aviso. Se presumen razonables 30 días. Un plazo más corto puede ser razonable si la condición es urgente. La ley exige aviso y buena fe. Rent Right usa 30 días como recordatorio habitual y plazos más cortos solo como recordatorio para urgencias. Esos plazos cortos no son números fijados por la ley.",
    citation: "Cal. Civ. Code §1942",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1942",
    findingLabel: "informational",
    confidence: "high",
    reasonEn: "Used to compute repair reminders. Thirty days is the statutory presumption. Shorter reminders are product presets.",
    reasonEs: "Se usa para calcular recordatorios de reparación. Treinta días es la presunción de la ley. Los plazos más cortos son ajustes del producto.",
    patterns: [],
  }),
  rule({
    id: "CA-CC-1942.1",
    jurisdiction: "CA",
    topic: "habitability",
    topics: ["waiver", "as is", "no duty to repair", "renuncia", "sin deber de reparar"],
    titleEn: "Waiver of habitability or repair rights",
    titleEs: "Renuncia a la habitabilidad o al derecho de reparación",
    summaryEn:
      "Civil Code §1942.1 says an agreement by a residential tenant waiving or modifying rights under §1941 or §1942 is void as contrary to public policy.",
    summaryEs:
      "El Código Civil §1942.1 dice que un acuerdo del inquilino que renuncia o modifica los derechos de las secciones 1941 o 1942 es nulo por ser contrario al orden público.",
    citation: "Cal. Civ. Code §1942.1",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1942.1",
    findingLabel: "likely_unenforceable",
    confidence: "high",
    reasonEn:
      "This clause appears to waive the landlord's duty to provide a habitable unit or the tenant's repair rights. Civil Code §1942.1 says that kind of waiver is void. Whether this sentence does that depends on the surrounding lease. This is general information, not a ruling on your contract.",
    reasonEs:
      "Esta cláusula parece renunciar al deber de dar una vivienda habitable o a los derechos de reparación. El Código Civil §1942.1 dice que esa renuncia es nula. Si esta frase lo hace depende del resto del contrato. Es información general, no una decisión sobre su contrato.",
    patterns: [
      /waiv\w+[\s\S]{0,80}(habitab|repair)/i,
      /no duty to repair/i,
      /as[\s-]?is[\s\S]{0,50}(habitab|repair|condition)/i,
      /renunci\w+[\s\S]{0,80}(habitabil|repar)/i,
    ],
  }),
  rule({
    id: "CA-CC-1953",
    jurisdiction: "CA",
    topic: "waiver",
    topics: ["waiver", "right to sue", "procedural rights", "renuncia", "derecho a demandar"],
    titleEn: "Waiver of listed tenant rights",
    titleEs: "Renuncia a derechos enumerados del inquilino",
    summaryEn:
      "Civil Code §1953 says a dwelling lease clause in which the tenant waives certain listed rights is void as contrary to public policy. The statute names specific rights, including rights tied to other code sections, some future claims, legally required notice, and procedural rights in tenant litigation. A blanket sentence is not automatically the same as every item on that list.",
    summaryEs:
      "El Código Civil §1953 dice que es nula, por contraria al orden público, la cláusula de un arrendamiento de vivienda en la que el inquilino renuncia a ciertos derechos enumerados. La ley nombra derechos específicos, entre ellos derechos de otras secciones, algunas reclamaciones futuras, avisos exigidos por la ley y derechos procesales. Una frase general no es automáticamente cada punto de esa lista.",
    citation: "Cal. Civ. Code §1953",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1953",
    findingLabel: "check_this",
    confidence: "medium",
    reasonEn:
      "This clause appears to waive the tenant's right to sue or other rights. Civil Code §1953 voids waivers of specific listed rights. Compare the sentence to the statute before treating it as void. This is general information.",
    reasonEs:
      "Esta cláusula parece renunciar al derecho de demandar u a otros derechos. El Código Civil §1953 anula renuncias de derechos específicos que la ley enumera. Compare la frase con el estatuto antes de tratarla como nula. Es información general.",
    patterns: [/waiv\w+[\s\S]{0,60}(right to sue|right to bring|cause of action)/i, /renunci\w+[\s\S]{0,60}(demandar|derecho de acci)/i],
  }),
  rule({
    id: "CA-CC-1950.5",
    jurisdiction: "CA",
    topic: "deposit",
    topics: ["security deposit", "nonrefundable", "21 days", "itemized", "depósito", "depósito de seguridad", "no reembolsable", "21 días"],
    titleEn: "Security deposits are refundable; 21-day accounting",
    titleEs: "El depósito es reembolsable; cuenta en 21 días",
    summaryEn:
      "Civil Code §1950.5 is the security-deposit statute. A residential security deposit is not a fee the landlord simply keeps. Within 21 calendar days after the tenant moves out, the landlord must send an itemized statement of lawful deductions and return any remaining deposit. Lawful deductions are limited to things the statute lists, such as unpaid rent, cleaning needed to return the unit to the condition at move-in (ordinary wear excepted), and repair of tenant damage. The tenant's demand letter should cite this section. Rent Right does not send that letter.",
    summaryEs:
      "El Código Civil §1950.5 es la ley del depósito de seguridad. El depósito residencial no es una cuota que el propietario pueda quedarse sin más. Dentro de 21 días calendario después de que el inquilino se muda, el propietario debe enviar un desglose de las deducciones permitidas y devolver el resto. Las deducciones se limitan a lo que la ley enumera, como renta impaga, limpieza para volver a la condición de la entrada (salvo el desgaste normal) y reparación de daños del inquilino. La carta de reclamo del inquilino debe citar esta sección. Rent Right no envía esa carta.",
    citation: "Cal. Civ. Code §1950.5",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5",
    findingLabel: "likely_unenforceable",
    confidence: "high",
    reasonEn:
      "This clause calls a deposit non-refundable. Civil Code §1950.5 treats a residential security deposit as refundable after lawful deductions, with an itemized statement due in 21 calendar days after move-out. This is general information about the clause, not a decision about money you are owed.",
    reasonEs:
      "Esta cláusula llama al depósito no reembolsable. El Código Civil §1950.5 trata el depósito residencial como reembolsable después de deducciones permitidas, con un desglose a los 21 días calendario de la mudanza. Es información general sobre la cláusula, no una decisión sobre dinero que se le deba.",
    patterns: [/non-?refundable[\s\S]{0,40}(deposit|fee)/i, /no[\s-]?reembolsable[\s\S]{0,40}(dep[oó]sito|cuota)/i],
  }),
  rule({
    id: "CA-CC-1950.5-CAP",
    jurisdiction: "CA",
    topic: "deposit",
    topics: ["deposit cap", "one month", "ab 12", "ab12", "límite del depósito", "un mes"],
    titleEn: "Security-deposit cap (AB 12)",
    titleEs: "Límite del depósito de seguridad (AB 12)",
    summaryEn:
      "Assembly Bill 12 amended Civil Code §1950.5. For leases signed on or after July 1, 2024, a residential security deposit generally cannot exceed one month's rent. A small-landlord exception can allow up to two months' rent when the landlord is a natural person and owns no more than two residential rental properties that together have no more than four units. Confirm whether the exception is claimed and whether the dates match the statute. Amounts labeled as pet deposits or fees are generally part of the security deposit.",
    summaryEs:
      "El proyecto AB 12 reformó el Código Civil §1950.5. En contratos firmados a partir del 1 de julio de 2024, el depósito residencial en general no puede pasar de un mes de renta. Hay una excepción para pequeños propietarios, que puede permitir hasta dos meses si el propietario es una persona natural y no tiene más de dos propiedades de renta residencial que juntas sumen no más de cuatro unidades. Confirme si se invoca la excepción y si las fechas coinciden con la ley. Lo que se llama depósito o cuota de mascota en general forma parte del depósito.",
    citation: "Cal. Civ. Code §1950.5 (as amended by AB 12)",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB12",
    findingLabel: "check_this",
    confidence: "medium",
    reasonEn:
      "The deposit amount in this clause looks higher than one month of the rent stored on your profile. Civil Code §1950.5, as amended by AB 12, generally caps a residential deposit at one month's rent, with a small-landlord exception of up to two months. Confirm the exception and the lease date. This is general information.",
    reasonEs:
      "El monto del depósito en esta cláusula parece mayor que un mes de la renta guardada en su perfil. El Código Civil §1950.5, reformado por AB 12, en general limita el depósito residencial a un mes de renta, con una excepción de hasta dos meses para pequeños propietarios. Confirme la excepción y la fecha del contrato. Es información general.",
    patterns: [/(security deposit|dep[oó]sito)[\s\S]{0,80}(two months|2 months|dos meses)/i],
  }),
  rule({
    id: "CA-AB-2801",
    jurisdiction: "CA",
    topic: "deposit",
    topics: ["deposit photos", "move-in photos", "ab 2801", "fotos", "fotografías del depósito"],
    titleEn: "Move-in and deposit photos (AB 2801)",
    titleEs: "Fotos de entrada y del depósito (AB 2801)",
    summaryEn:
      "AB 2801 amended Civil Code §1950.5 to require landlords to take photographs for tenancies that start on or after July 1, 2025: at the start of the tenancy, and before and after repairs used to support a deposit deduction. Tenant photos are a separate record. They do not replace the landlord's duty. Confirm the current effective dates in the statute.",
    summaryEs:
      "AB 2801 reformó el Código Civil §1950.5 para exigir que el propietario tome fotografías en arrendamientos que empiezan a partir del 1 de julio de 2025: al inicio, y antes y después de las reparaciones que se usen para descontar del depósito. Las fotos del inquilino son un registro aparte. No reemplazan el deber del propietario. Confirme las fechas vigentes en la ley.",
    citation: "Cal. Civ. Code §1950.5 (as amended by AB 2801)",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2801",
    findingLabel: "informational",
    confidence: "medium",
    reasonEn: "Background rule for condition photos.",
    reasonEs: "Regla de contexto sobre fotos del estado de la vivienda.",
    patterns: [],
  }),
  rule({
    id: "CA-CC-1954",
    jurisdiction: "CA",
    topic: "entry",
    topics: ["entry", "24 hours", "notice to enter", "entrada", "24 horas", "aviso de entrada"],
    titleEn: "Landlord entry and 24-hour notice",
    titleEs: "Entrada del propietario y aviso de 24 horas",
    summaryEn:
      "Civil Code §1954 limits when a landlord may enter a dwelling: in an emergency; to make necessary or agreed repairs, decorations, or services; to show the unit to prospective tenants, buyers, or lenders; when the tenant has abandoned or surrendered the unit; or under a court order. Except in an emergency or when the tenant consents at the time of entry, the landlord must give reasonable notice in writing. Twenty-four hours is presumed reasonable. The tenant cannot be required to waive these limits in the ways the statute describes.",
    summaryEs:
      "El Código Civil §1954 limita cuándo el propietario puede entrar: en una emergencia; para reparaciones, mejoras o servicios necesarios o acordados; para mostrar la vivienda a posibles inquilinos, compradores o prestamistas; si el inquilino abandonó o entregó la unidad; o por orden judicial. Salvo emergencia o consentimiento del inquilino en el momento de la entrada, debe dar un aviso razonable por escrito. Se presumen razonables 24 horas. El inquilino no puede ser obligado a renunciar a estos límites en la forma que describe la ley.",
    citation: "Cal. Civ. Code §1954",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1954",
    findingLabel: "likely_unenforceable",
    confidence: "high",
    reasonEn:
      "This clause appears to allow entry at any time without notice. Civil Code §1954 generally requires reasonable written notice (24 hours is presumed reasonable) and limits the reasons for entry. Emergencies and a few other statutory situations are exceptions. This is general information.",
    reasonEs:
      "Esta cláusula parece permitir la entrada en cualquier momento sin aviso. El Código Civil §1954 en general exige un aviso escrito razonable (se presumen 24 horas) y limita los motivos de entrada. Las emergencias y otras situaciones de la ley son excepciones. Es información general.",
    patterns: [
      /enter[\s\S]{0,80}(any time|at will|without notice)/i,
      /without (?:prior |written )?notice[\s\S]{0,40}enter/i,
      /entrar[\s\S]{0,80}(cualquier momento|sin aviso)/i,
    ],
  }),
  rule({
    id: "CA-CC-1942.5",
    jurisdiction: "CA",
    topic: "retaliation",
    topics: ["retaliation", "180 days", "rent increase after complaint", "represalia", "180 días"],
    titleEn: "Retaliation after a complaint",
    titleEs: "Represalia después de una queja",
    summaryEn:
      "Civil Code §1942.5 restricts landlord retaliation. If a tenant complains about habitability, exercises a legal right, or the landlord learns of a complaint to a housing agency, the landlord generally may not, within 180 days, raise rent, cut services, or evict because of that complaint. The statute has exceptions, including nonpayment of rent and other good-faith reasons. A date match is not proof of retaliation. It is a reason to read the statute and talk with legal aid.",
    summaryEs:
      "El Código Civil §1942.5 limita las represalias del propietario. Si el inquilino se queja de la habitabilidad, ejerce un derecho legal, o el propietario se entera de una queja ante una agencia de vivienda, en general no puede, dentro de 180 días, subir la renta, recortar servicios o desalojar a causa de esa queja. La ley tiene excepciones, entre ellas la falta de pago y otros motivos de buena fe. Que las fechas coincidan no prueba una represalia. Es un motivo para leer la ley y hablar con asistencia legal.",
    citation: "Cal. Civ. Code §1942.5",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1942.5",
    findingLabel: "informational",
    confidence: "high",
    reasonEn:
      "A rent increase or eviction notice was logged within 180 days after a repair request or complaint in this unit. Civil Code §1942.5 is the retaliation statute. Rent Right does not decide whether this notice was retaliation.",
    reasonEs:
      "Se registró un aviso de aumento de renta o de desalojo dentro de los 180 días posteriores a una solicitud de reparación o queja en esta unidad. El Código Civil §1942.5 es la ley de represalias. Rent Right no decide si este aviso fue una represalia.",
    patterns: [],
  }),
  rule({
    id: "CA-CC-827",
    jurisdiction: "CA",
    topic: "rent-increase-notice",
    topics: ["rent increase notice", "30 days", "90 days", "aviso de aumento", "30 días", "90 días"],
    titleEn: "How much notice a rent increase needs",
    titleEs: "Cuánto aviso necesita un aumento de renta",
    summaryEn:
      "Civil Code §827 requires written notice before a residential rent increase. If the increase is 10 percent or less of the rent charged at any time in the prior 12 months, the notice is at least 30 days. If it is more than 10 percent, the notice is at least 90 days. Delivery rules are in the statute. Local rent limits can be stricter than this notice rule. The notice rule does not itself authorize the amount of the increase.",
    summaryEs:
      "El Código Civil §827 exige aviso escrito antes de un aumento de renta residencial. Si el aumento es del 10 por ciento o menos de la renta cobrada en cualquier momento de los 12 meses anteriores, el aviso es de al menos 30 días. Si es mayor del 10 por ciento, el aviso es de al menos 90 días. Las reglas de entrega están en la ley. Los límites locales pueden ser más estrictos que esta regla de aviso. La regla de aviso no autoriza por sí sola el monto del aumento.",
    citation: "Cal. Civ. Code §827",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=827",
    findingLabel: "informational",
    confidence: "high",
    reasonEn: "Used to check the notice period for a rent increase. It does not set the maximum amount.",
    reasonEs: "Se usa para revisar el plazo de aviso de un aumento. No fija el monto máximo.",
    patterns: [],
  }),
  rule({
    id: "CA-CC-1947.12",
    jurisdiction: "CA",
    topic: "rent-cap",
    topics: ["ab 1482", "rent cap", "tenant protection act", "5 percent", "cpi", "límite de renta", "tope"],
    titleEn: "Statewide rent cap (AB 1482)",
    titleEs: "Tope estatal de renta (AB 1482)",
    summaryEn:
      "Civil Code §1947.12 limits rent increases on covered units to the lower of 5 percent plus the percentage change in the cost of living, or 10 percent, compared with the lowest rent charged in the prior 12 months, and generally allows only two increases in that 12-month period that together stay under the cap. The Attorney General publishes the chart. For increases taking effect August 1, 2026 through July 31, 2027, that chart lists 8.7 percent for Los Angeles and Orange Counties and 8.2 percent for San Diego County. Many units are exempt, including some newer buildings, some single-family homes and condos when the owner gives the required notice, and deed-restricted affordable housing. A stricter local rule controls. If an exemption is uncertain, this checker says so.",
    summaryEs:
      "El Código Civil §1947.12 limita los aumentos en unidades cubiertas al menor entre 5 por ciento más el cambio en el costo de la vida, o 10 por ciento, comparado con la renta más baja cobrada en los 12 meses anteriores, y en general permite solo dos aumentos en ese período que juntos no pasen del tope. El Procurador General publica la tabla. Para aumentos que empiezan del 1 de agosto de 2026 al 31 de julio de 2027, esa tabla indica 8.7 por ciento en los condados de Los Ángeles y Orange, y 8.2 por ciento en el condado de San Diego. Muchas unidades están exentas, entre ellas algunos edificios nuevos, algunas casas unifamiliares y condominios si el dueño da el aviso exigido, y vivienda asequible con restricción. Si hay una regla local más estricta, esa manda. Si la exención es incierta, esta herramienta lo dice.",
    citation: "Cal. Civ. Code §1947.12",
    sourceName: "California Department of Justice, Limits on Rent Increases",
    sourceUrl: "https://oag.ca.gov/rentcaps",
    findingLabel: "likely_unenforceable",
    confidence: "medium",
    reasonEn:
      "This clause appears to waive statewide rent-cap or just-cause protections. Civil Code §1947.12 and §1946.2 limit waivers. Coverage and exemptions are fact-specific. This is general information.",
    reasonEs:
      "Esta cláusula parece renunciar al tope estatal de renta o a la causa justa. Los Códigos Civiles §1947.12 y §1946.2 limitan las renuncias. La cobertura y las exenciones dependen de los hechos. Es información general.",
    patterns: [/waiv\w+[\s\S]{0,80}(tenant protection act|ab\s*1482|rent cap)/i],
  }),
  rule({
    id: "CA-CC-1946.2",
    jurisdiction: "CA",
    topic: "just-cause",
    topics: ["just cause", "eviction", "ab 1482", "causa justa", "desalojo"],
    titleEn: "Statewide just cause (AB 1482)",
    titleEs: "Causa justa estatal (AB 1482)",
    summaryEn:
      "Civil Code §1946.2 requires just cause to end many residential tenancies after 12 months (including periods with prior tenants in some cases). Just cause is split into at-fault reasons, such as nonpayment, and no-fault reasons, such as an owner move-in, which can require relocation assistance. The statute lists exemptions that overlap with the rent cap, and it states that a waiver of rights under the section is void as contrary to public policy. City of Los Angeles and City of San Diego rules can protect a tenant sooner. This is not advice about an eviction case.",
    summaryEs:
      "El Código Civil §1946.2 exige causa justa para terminar muchos arrendamientos residenciales después de 12 meses (incluidos, en algunos casos, períodos con inquilinos anteriores). La causa justa se divide en motivos con culpa, como la falta de pago, y sin culpa, como la mudanza del dueño, que puede exigir ayuda de reubicación. La ley enumera exenciones parecidas a las del tope de renta y dice que una renuncia a los derechos de la sección es nula por contraria al orden público. Las reglas de la Ciudad de Los Ángeles y de la Ciudad de San Diego pueden proteger antes. Esto no es asesoramiento sobre un caso de desalojo.",
    citation: "Cal. Civ. Code §1946.2",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1946.2",
    findingLabel: "likely_unenforceable",
    confidence: "high",
    reasonEn:
      "This clause appears to waive just-cause eviction protections. Civil Code §1946.2 states that a waiver of rights under that section is void as contrary to public policy. Local ordinances may add protections. Coverage still depends on facts such as building age and notices. This is general information, not a prediction about an eviction.",
    reasonEs:
      "Esta cláusula parece renunciar a la protección de causa justa. El Código Civil §1946.2 dice que una renuncia a los derechos de esa sección es nula por ser contraria al orden público. Las ordenanzas locales pueden añadir protección. La cobertura igual depende de hechos como la edad del edificio y los avisos. Es información general, no un pronóstico sobre un desalojo.",
    patterns: [
      /waiv\w+[\s\S]{0,80}(just[\s-]?cause|eviction protection|tenant protection)/i,
      /renunci\w+[\s\S]{0,80}(causa justa|protecci[oó]n contra el desalojo)/i,
    ],
  }),
  rule({
    id: "CA-CC-1717",
    jurisdiction: "CA",
    topic: "attorney-fees",
    topics: ["attorney fees", "attorney's fees", "honorarios"],
    titleEn: "One-sided attorney-fee clauses",
    titleEs: "Cláusulas de honorarios de un solo lado",
    summaryEn:
      "Civil Code §1717 generally makes a one-sided attorney-fee clause in a contract reciprocal: if the contract says one party can recover fees for an action to enforce the contract, the prevailing party can recover fees whether or not that party is the one named in the clause. It does not ban fee clauses. Unlawful detainer has its own fee rules. Confirm how §1717 applies before relying on a clause.",
    summaryEs:
      "El Código Civil §1717 en general vuelve recíproca una cláusula de honorarios de un solo lado: si el contrato dice que una parte puede cobrar honorarios en una acción para hacer valer el contrato, la parte vencedora puede cobrarlos aunque no sea la nombrada en la cláusula. No prohíbe las cláusulas de honorarios. El desalojo (unlawful detainer) tiene sus propias reglas. Confirme cómo aplica la §1717 antes de apoyarse en una cláusula.",
    citation: "Cal. Civ. Code §1717",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1717",
    findingLabel: "check_this",
    confidence: "medium",
    reasonEn:
      "This clause shifts attorney fees toward the tenant. Civil Code §1717 often makes that kind of clause reciprocal; it does not automatically delete it. This is general information.",
    reasonEs:
      "Esta cláusula carga los honorarios de abogado al inquilino. El Código Civil §1717 a menudo vuelve recíproca esa cláusula; no la borra automáticamente. Es información general.",
    patterns: [/attorney'?s? fees/i, /honorarios de abogado/i],
  }),
  rule({
    id: "CA-CC-1671",
    jurisdiction: "CA",
    topic: "late-fee",
    topics: ["late fee", "penalty", "liquidated damages", "cuota por atraso", "penalidad"],
    titleEn: "Late fees and penalties",
    titleEs: "Cargos por atraso y penalidades",
    summaryEn:
      "Civil Code §1671 is the liquidated-damages statute. A preset late fee in a residential lease has to represent a reasonable estimate of the landlord's actual damages from late payment. A fee that works as a penalty can be challenged. There is no single statewide dollar cap in this library. The California Courts self-help housing pages discuss late fees as general information. Whether a particular fee is a penalty depends on the amount, the rent, and the facts.",
    summaryEs:
      "El Código Civil §1671 es la ley de daños liquidados. Un cargo fijo por atraso en un arrendamiento residencial debe representar una estimación razonable de los daños reales del propietario por el pago tardío. Un cargo que funciona como penalidad puede impugnarse. Esta biblioteca no tiene un tope único en dólares para todo el estado. Las páginas de autoayuda de las Cortes de California hablan de los cargos por atraso como información general. Si un cargo es una penalidad depende del monto, de la renta y de los hechos.",
    citation: "Cal. Civ. Code §1671",
    sourceName: "California Courts Self-Help",
    sourceUrl: "https://selfhelp.courts.ca.gov/housing",
    findingLabel: "check_this",
    confidence: "medium",
    reasonEn:
      "This late fee is written like a penalty or a percentage that may not track the landlord's actual loss. Civil Code §1671 requires liquidated damages to be a reasonable estimate, not a penalty. Rent Right does not decide whether this dollar amount is reasonable.",
    reasonEs:
      "Este cargo por atraso está escrito como penalidad o como un porcentaje que puede no corresponder a la pérdida real del propietario. El Código Civil §1671 exige que los daños liquidados sean una estimación razonable, no una penalidad. Rent Right no decide si este monto es razonable.",
    patterns: [/late fee[\s\S]{0,120}(penalty|%\s*of|percent of)/i, /cargo por (atraso|mora)[\s\S]{0,80}(penal|por ciento)/i],
  }),
  rule({
    id: "CA-CASE-GRAFTON",
    jurisdiction: "CA",
    topic: "jury",
    topics: ["jury", "jury trial", "jurado", "juicio por jurado"],
    titleEn: "Pre-dispute jury trial waiver",
    titleEs: "Renuncia anticipada al juicio por jurado",
    summaryEn:
      "In Grafton Partners L.P. v. Superior Court (2005) 36 Cal.4th 944, the California Supreme Court held that a predispute contractual waiver of the right to a jury trial is not enforceable under California civil procedure. The authority is the opinion, not a lease statute. Later cases and the wording of the clause can matter. Confirm with the opinion before you rely on it.",
    summaryEs:
      "En Grafton Partners L.P. v. Superior Court (2005) 36 Cal.4th 944, la Corte Suprema de California decidió que una renuncia contractual, hecha antes del conflicto, al derecho a un juicio por jurado no es exigible bajo el procedimiento civil de California. La fuente es la sentencia, no un estatuto del arrendamiento. Los casos posteriores y el texto de la cláusula pueden importar. Confirme con la sentencia antes de apoyarse en ella.",
    citation: "Grafton Partners L.P. v. Superior Court (2005) 36 Cal.4th 944",
    sourceName: "California Courts opinions",
    sourceUrl: "https://www.courts.ca.gov/opinions.htm",
    findingLabel: "likely_unenforceable",
    confidence: "high",
    reasonEn:
      "This clause waives a jury trial before any dispute exists. The California Supreme Court held in Grafton Partners that this kind of predispute waiver is not enforceable. This is general information about the clause, not a prediction about a case.",
    reasonEs:
      "Esta cláusula renuncia al juicio por jurado antes de que exista un conflicto. La Corte Suprema de California decidió en Grafton Partners que esa renuncia anticipada no es exigible. Es información general sobre la cláusula, no un pronóstico sobre un caso.",
    patterns: [/waiv\w+[\s\S]{0,40}jury/i, /renunci\w+[\s\S]{0,40}jurado/i],
  }),
  rule({
    id: "CA-CCP-1161",
    jurisdiction: "CA",
    topic: "notice",
    topics: ["3-day notice", "three-day", "pay or quit", "aviso de 3 días", "pagar o desalojar"],
    titleEn: "Three-day notices skip weekends and court holidays",
    titleEs: "Los avisos de 3 días saltan fines de semana y feriados judiciales",
    summaryEn:
      "Code of Civil Procedure §1161 sets out three-day notices used in many eviction cases, including a notice to pay rent or quit. The counting of those three days excludes Saturdays, Sundays, and other judicial holidays. Rent Right counts three non-excluded days starting the day after the service date you enter, using a placeholder holiday list. Confirm the notice, how it was served, and the court calendar. This is not advice about how to respond to a notice.",
    summaryEs:
      "El Código de Procedimiento Civil §1161 describe los avisos de tres días que se usan en muchos desalojos, incluido el aviso de pagar la renta o irse. Esos tres días no incluyen sábados, domingos ni otros feriados judiciales. Rent Right cuenta tres días no excluidos a partir del día siguiente a la fecha de entrega que usted anota, con una lista provisional de feriados. Confirme el aviso, cómo se entregó y el calendario del tribunal. Esto no es asesoramiento sobre cómo responder a un aviso.",
    citation: "Cal. Code Civ. Proc. §1161",
    sourceName: "California Legislative Information",
    sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=1161",
    findingLabel: "informational",
    confidence: "high",
    reasonEn: "Used only to count a 3-day notice. It does not say what to do about the notice.",
    reasonEs: "Se usa solo para contar un aviso de 3 días. No dice qué hacer con el aviso.",
    patterns: [],
  }),
  rule({
    id: "CA-GUIDE-ORDINARY-RENT",
    jurisdiction: "CA",
    topic: "rent",
    topics: ["rent due", "monthly rent", "renta mensual"],
    titleEn: "Ordinary promise to pay monthly rent",
    titleEs: "Promesa ordinaria de pagar la renta mensual",
    summaryEn:
      "A clause that only states the monthly rent and when it is due is a common lease term. The California Courts self-help housing materials describe rent as the tenant's basic payment obligation. This match means the library did not see waiver, penalty, or notice-stripping language in that clause. It says nothing about the rest of the lease, the amount of a future increase, or whether the rent itself is lawful.",
    summaryEs:
      "Una cláusula que solo indica la renta mensual y cuándo se paga es un término común. Los materiales de autoayuda de las Cortes de California describen la renta como la obligación básica de pago del inquilino. Esta coincidencia significa que la biblioteca no vio en esa cláusula un lenguaje de renuncia, penalidad o eliminación de avisos. No dice nada del resto del contrato, del monto de un aumento futuro, ni de si la renta misma es legal.",
    citation: "California Courts Self-Help, housing",
    sourceName: "California Courts Self-Help",
    sourceUrl: "https://selfhelp.courts.ca.gov/housing",
    findingLabel: "looks_standard",
    confidence: "medium",
    reasonEn:
      "This clause matches a common rent-payment term. No waiver or penalty language was detected in this clause. That does not clear the rest of the lease.",
    reasonEs:
      "Esta cláusula coincide con un término común de pago de renta. No se detectó lenguaje de renuncia o penalidad en esta cláusula. Eso no aprueba el resto del contrato.",
    patterns: [/\b(monthly rent|rent is due|shall pay rent|renta mensual|la renta se paga)\b/i],
  }),
  rule({
    id: "CA-SMALL-CLAIMS",
    jurisdiction: "CA",
    topic: "court",
    topics: ["small claims", "corte de reclamos menores", "demand letter"],
    titleEn: "Small claims is a self-help path",
    titleEs: "Reclamos menores es una vía de autoayuda",
    summaryEn:
      "California small claims court is a place individuals can sue for money without a lawyer. The courts publish the current dollar limit, filing fees, and forms. Do not rely on a remembered dollar cap; read the self-help page. A Rent Right evidence packet is a compilation of your records, not a small-claims filing and not a statement of who should win.",
    summaryEs:
      "La corte de reclamos menores de California es un lugar donde una persona puede demandar por dinero sin abogado. Las cortes publican el límite actual en dólares, las cuotas y los formularios. No se apoye en un tope recordado; lea la página de autoayuda. Un paquete de pruebas de Rent Right es una recopilación de sus registros, no una demanda ni una opinión sobre quién debe ganar.",
    citation: "California Courts Self-Help, small claims",
    sourceName: "California Courts Self-Help",
    sourceUrl: "https://selfhelp.courts.ca.gov/small-claims",
    findingLabel: "informational",
    confidence: "medium",
    reasonEn: "Pointer to the official small-claims page.",
    reasonEs: "Enlace a la página oficial de reclamos menores.",
    patterns: [],
  }),
  rule({
    id: "LA-RSO-2026-CAP",
    jurisdiction: "CITY_LA",
    topic: "rent-cap",
    topics: ["rso", "los angeles rent", "3 percent", "zimas", "control de renta", "los ángeles"],
    titleEn: "City of Los Angeles RSO annual increase",
    titleEs: "Aumento anual de la ordenanza RSO de la Ciudad de Los Ángeles",
    summaryEn:
      "The Los Angeles Housing Department says the annual allowable rent increase for units covered by the Rent Stabilization Ordinance is 3 percent from July 1, 2026 through June 30, 2027. The City changed the formula effective February 2, 2026 to a range of 1 to 4 percent. Coverage is not guessed from a street name. LAHD tells renters to check ZIMAS (zimas.lacity.org), Housing tab, or call 866-557-7368. RSO increases are generally once every 12 months. If the unit is covered, this local cap is stricter than the statewide AB 1482 percentage and is the one that matters. Registration, notices, and surcharges have extra rules on the LAHD site.",
    summaryEs:
      "El Departamento de Vivienda de Los Ángeles indica que el aumento anual permitido para unidades cubiertas por la ordenanza de estabilización de renta (RSO) es 3 por ciento del 1 de julio de 2026 al 30 de junio de 2027. La Ciudad cambió la fórmula a partir del 2 de febrero de 2026 a un rango de 1 a 4 por ciento. La cobertura no se adivina por el nombre de la calle. LAHD pide revisar ZIMAS (zimas.lacity.org), pestaña Housing, o llamar al 866-557-7368. Los aumentos de la RSO en general son una vez cada 12 meses. Si la unidad está cubierta, este tope local es más estricto que el porcentaje estatal de AB 1482 y es el que importa. El registro, los avisos y los recargos tienen reglas adicionales en el sitio de LAHD.",
    citation: "Los Angeles Rent Stabilization Ordinance; LAHD allowable-increase bulletin",
    sourceName: "Los Angeles Housing Department",
    sourceUrl: "https://housing.lacity.gov/renter-protections-2",
    findingLabel: "informational",
    confidence: "high",
    reasonEn: "Local cap used only when you tell Rent Right the unit is an RSO unit, and only inside a published date range.",
    reasonEs: "Tope local que se usa solo cuando usted indica que la unidad está en la RSO, y solo dentro de un período publicado.",
    patterns: [],
  }),
  rule({
    id: "LA-RSO-UTILITY",
    jurisdiction: "CITY_LA",
    topic: "rent-cap",
    topics: ["utility", "gas", "electric", "rso surcharge", "servicios", "gas y luz"],
    titleEn: "No extra RSO increase for utilities",
    titleEs: "Sin aumento extra de la RSO por servicios",
    summaryEn:
      "LAHD states that, effective February 2, 2026, a landlord of an RSO unit can no longer add an extra percentage increase for providing gas and electric utilities. Confirm on the current LAHD bulletin before you treat an add-on as unlawful.",
    summaryEs:
      "LAHD indica que, a partir del 2 de febrero de 2026, el propietario de una unidad RSO ya no puede añadir un porcentaje extra por proporcionar gas y electricidad. Confirme en el boletín vigente de LAHD antes de tratar un recargo como ilegal.",
    citation: "LAHD renter protections (utility add-on ended February 2, 2026)",
    sourceName: "Los Angeles Housing Department",
    sourceUrl: "https://housing.lacity.gov/renter-protections-2",
    findingLabel: "informational",
    confidence: "medium",
    reasonEn: "Noted on City of Los Angeles rent-increase results. It is not a guess that your unit is covered.",
    reasonEs: "Se anota en los resultados de aumento de la Ciudad de Los Ángeles. No es una suposición de que su unidad esté cubierta.",
    patterns: [],
  }),
  rule({
    id: "LA-JUST-CAUSE",
    jurisdiction: "CITY_LA",
    topic: "just-cause",
    topics: ["los angeles just cause", "rso eviction", "causa justa los ángeles"],
    titleEn: "City of Los Angeles just cause",
    titleEs: "Causa justa de la Ciudad de Los Ángeles",
    summaryEn:
      "Units covered by the City of Los Angeles Rent Stabilization Ordinance have local just-cause eviction rules and, in some cases, relocation assistance. They are not the same as waiting 12 months under statewide AB 1482. Coverage is a ZIMAS question. A lease clause that waives just cause should also be read against Civil Code §1946.2. Rent Right will not say whether a particular notice is a lawful eviction.",
    summaryEs:
      "Las unidades cubiertas por la ordenanza RSO de la Ciudad de Los Ángeles tienen reglas locales de desalojo por causa justa y, en algunos casos, ayuda de reubicación. No son lo mismo que esperar 12 meses bajo la ley estatal AB 1482. La cobertura se revisa en ZIMAS. Una cláusula que renuncia a la causa justa también debe leerse junto con el Código Civil §1946.2. Rent Right no dirá si un aviso concreto es un desalojo legal.",
    citation: "Los Angeles Rent Stabilization Ordinance (just cause); see LAHD",
    sourceName: "Los Angeles Housing Department",
    sourceUrl: "https://housing.lacity.gov/residents/rso-overview",
    findingLabel: "check_this",
    confidence: "medium",
    reasonEn:
      "Because this profile is in the City of Los Angeles, also read the local just-cause rules. Confirm RSO coverage on ZIMAS. This flag does not say an eviction is unlawful.",
    reasonEs:
      "Como este perfil está en la Ciudad de Los Ángeles, lea también las reglas locales de causa justa. Confirme la cobertura RSO en ZIMAS. Esta marca no dice que un desalojo sea ilegal.",
    patterns: [/waiv\w+[\s\S]{0,80}(just[\s-]?cause|eviction protection)/i],
  }),
  rule({
    id: "LAC-RSTPO-2026",
    jurisdiction: "LA_COUNTY",
    topic: "rent-cap",
    topics: ["rstpo", "unincorporated", "la county", "condado de los ángeles", "no incorporada"],
    titleEn: "Unincorporated LA County RSTPO increase",
    titleEs: "Aumento de la RSTPO del condado de Los Ángeles no incorporado",
    summaryEn:
      "The LA County Department of Consumer and Business Affairs publishes the Rent Stabilization and Tenant Protections Ordinance cap for fully covered units in unincorporated Los Angeles County. For July 1, 2026 through June 30, 2027 the published fully covered cap is 1.919 percent. Qualifying small-property landlords may add 1 percentage point (2.919 percent) and qualifying luxury units may add 2 percentage points (3.919 percent), if they meet the ordinance's registration and notice tests. This checker does not decide the tier. Confirm the property is actually in unincorporated county (not one of the 88 cities) on the county map, and read LACC Chapter 8.52.",
    summaryEs:
      "El Departamento de Asuntos del Consumidor y de Negocios del Condado de Los Ángeles publica el tope de la ordenanza de estabilización de renta y protección de inquilinos (RSTPO) para unidades plenamente cubiertas en el área no incorporada. Del 1 de julio de 2026 al 30 de junio de 2027 el tope publicado para unidades plenamente cubiertas es 1.919 por ciento. Los pequeños propietarios que califican pueden sumar 1 punto (2.919 por ciento) y las unidades de lujo que califican pueden sumar 2 puntos (3.919 por ciento), si cumplen el registro y los avisos de la ordenanza. Esta herramienta no decide la categoría. Confirme que la propiedad está de verdad en el área no incorporada (no en una de las 88 ciudades) en el mapa del condado, y lea el Capítulo 8.52 del código del condado.",
    citation: "L.A. County Code §8.52.050",
    sourceName: "LA County Department of Consumer and Business Affairs",
    sourceUrl: "https://dcba.lacounty.gov/rentstabilizationprogram/",
    findingLabel: "informational",
    confidence: "high",
    reasonEn: "Local cap used only for unincorporated LA County, inside the published dates, at the tier you select.",
    reasonEs: "Tope local que se usa solo para el área no incorporada del condado, dentro de las fechas publicadas, en la categoría que usted elige.",
    patterns: [],
  }),
  rule({
    id: "SD-TPG-JUST-CAUSE",
    jurisdiction: "CITY_SD",
    topic: "just-cause",
    topics: ["san diego", "tenant protection", "just cause", "sdmc", "causa justa san diego"],
    titleEn: "City of San Diego just cause",
    titleEs: "Causa justa de la Ciudad de San Diego",
    summaryEn:
      "The City of San Diego Residential Tenant Protections Ordinance, Municipal Code §§98.0701 through 98.0709, requires just cause to terminate a covered residential tenancy. It is not a citywide percentage rent cap. Statewide AB 1482 supplies the percentage cap for covered San Diego units unless another rule is stricter. The San Diego Housing Commission publishes a tenant protection guide and says that guide is informational and is not legal advice. Just cause under the ordinance is not delayed until month 12 the way the statewide rule is. Exemptions exist. A waiver of just cause in a lease should be read against both the ordinance and Civil Code §1946.2.",
    summaryEs:
      "La ordenanza de protecciones residenciales para inquilinos de la Ciudad de San Diego, Código Municipal §§98.0701 a 98.0709, exige causa justa para terminar un arrendamiento cubierto. No es un tope porcentual de renta para toda la ciudad. La ley estatal AB 1482 da el tope porcentual para las unidades cubiertas de San Diego, salvo que otra regla sea más estricta. La Comisión de Vivienda de San Diego publica una guía y dice que esa guía es informativa y no es asesoramiento legal. La causa justa de la ordenanza no espera al mes 12 como la regla estatal. Hay exenciones. Una renuncia a la causa justa en el contrato debe leerse junto con la ordenanza y el Código Civil §1946.2.",
    citation: "San Diego Municipal Code §§98.0701–98.0709",
    sourceName: "San Diego Housing Commission",
    sourceUrl: "https://sdhc.org/housing-opportunities/tenant-protections/",
    findingLabel: "check_this",
    confidence: "medium",
    reasonEn:
      "Because this profile is in the City of San Diego, a just-cause waiver should also be read against the Residential Tenant Protections Ordinance. The ordinance is not a local percentage rent cap. This is general information.",
    reasonEs:
      "Como este perfil está en la Ciudad de San Diego, una renuncia a la causa justa también debe leerse junto con la ordenanza de protecciones residenciales. La ordenanza no es un tope local de porcentaje de renta. Es información general.",
    patterns: [/waiv\w+[\s\S]{0,80}(just[\s-]?cause|eviction protection|tenant protection)/i],
  }),
];

const byId = new Map(RULES.map((item) => [item.id, item]));

export function getRule(id: string): Rule | undefined {
  return byId.get(id);
}

export function libraryIntegrityErrors(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of RULES) {
    if (ids.has(item.id)) errors.push(`duplicate ${item.id}`);
    ids.add(item.id);
    if (!item.placeholder) errors.push(`${item.id} placeholder`);
    if (item.clinicReview !== "pending_clinic_review") errors.push(`${item.id} clinic`);
    if (item.spanishReview !== "pending_volunteer_review") errors.push(`${item.id} spanish`);
    if (item.version !== LIBRARY_VERSION) errors.push(`${item.id} version`);
    if (!item.sourceUrl.startsWith("https://")) errors.push(`${item.id} url`);
    if (item.summaryEn.length < 40 || item.summaryEs.length < 40) errors.push(`${item.id} summary`);
    if (!item.citation || !item.titleEn || !item.titleEs) errors.push(`${item.id} labels`);
    if (item.findingLabel === "informational" && item.patterns.length > 0) {
      errors.push(`${item.id} informational pattern`);
    }
    if (item.findingLabel === "looks_standard" && item.patterns.length === 0) {
      errors.push(`${item.id} standard pattern`);
    }
  }
  return errors;
}
