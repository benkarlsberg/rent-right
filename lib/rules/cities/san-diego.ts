import { rule } from "@/lib/rules/define";
import type { CityPack } from "@/lib/rules/cities/types";

export const pack: CityPack = {
  id: "san-diego",
  jurisdiction: "city_sd",
  name: "San Diego",
  places: ["san diego"],
  zips: ["92101", "92102", "92103", "92104", "92105", "92106", "92107", "92108", "92109", "92110", "92111", "92113", "92114", "92115", "92116", "92117"],
  area: "san_diego",
  housingName: "San Diego Housing Commission",
  housingUrl: "https://sdhc.org/housing-opportunities/tenant-protections/",
  rules: [
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
  })
  ],
};
