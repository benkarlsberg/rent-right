import { rule } from "@/lib/rules/define";
import type { CityPack } from "@/lib/rules/cities/types";

export const pack: CityPack = {
  id: "los-angeles",
  jurisdiction: "city_la",
  name: "Los Angeles",
  places: ["los angeles"],
  zips: ["90004", "90006", "90007", "90012", "90015", "90017", "90019", "90026", "90027", "90029", "90031", "90057", "90065"],
  area: "los_angeles_orange",
  housingName: "Los Angeles Housing Department",
  housingUrl: "https://housing.lacity.gov/renter-protections-2",
  rules: [
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
  })
  ],
};
