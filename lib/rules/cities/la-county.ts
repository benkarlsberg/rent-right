import { rule } from "@/lib/rules/define";
import type { CityPack } from "@/lib/rules/cities/types";

export const pack: CityPack = {
  id: "la-county-unincorporated",
  jurisdiction: "la_county_unincorporated",
  name: "Unincorporated Los Angeles County",
  places: [],
  zips: [],
  area: "los_angeles_orange",
  housingName: "LA County Department of Consumer and Business Affairs",
  housingUrl: "https://dcba.lacounty.gov/rentstabilizationprogram/",
  rules: [
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
  })
  ],
};
