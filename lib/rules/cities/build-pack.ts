import type { OrdinanceRecord } from "@/lib/rules/cities/catalog";
import { ORDINANCES } from "@/lib/rules/cities/catalog";
import type { CityPack } from "@/lib/rules/cities/types";
import { rule } from "@/lib/rules/define";

const CHART = "https://oag.ca.gov/rentcaps";
const RETRIEVED = "2026-10-12";

export function effectiveSentence(record: OrdinanceRecord): string {
  if (record.effectiveDate) return `The official source dates this ordinance ${record.effectiveDate}.`;
  if (record.adoptedNote) return record.adoptedNote;
  return "The effective date is unsure.";
}

export function buildPack(record: OrdinanceRecord): CityPack {
  const effective = effectiveSentence(record);
  const detail = record.detail ? ` ${record.detail}` : "";
  let summaryEn: string;
  let summaryEs: string;
  let reasonEn: string;
  let reasonEs: string;

  if (record.capStatus === "published" && record.figure && record.window) {
    summaryEn =
      `${record.name} (${record.citation}). ${effective} The California Attorney General's local rent-cap chart (${CHART}), retrieved ${RETRIEVED}, publishes ${record.figure} for ${record.window}. That window is the one printed on the chart. This library does not state a figure for a later period, and it does not apply that figure as a particular unit's allowed rent, because coverage is not confirmed.${detail} Official page: ${record.sourceUrl}. Placeholder pending clinic review.`;
    summaryEs =
      `${record.name} (${record.citation}). ${record.effectiveDate ? `La fuente oficial fecha esta ordenanza el ${record.effectiveDate}.` : "La fecha de vigencia está marcada unsure."} La tabla del Procurador General de California (${CHART}), consultada el ${RETRIEVED}, publica ${record.figure} para ${record.window}. Esta biblioteca no aplica esa cifra como la renta permitida de una unidad en particular, porque la cobertura no está confirmada. Ficha provisional pendiente de revisión clínica.`;
    reasonEn = `A chart figure of ${record.figure} for ${record.window} is quoted from the Attorney General chart retrieved ${RETRIEVED}. Coverage of this unit is not confirmed, so no single allowed rent is stated.`;
    reasonEs = `Se cita la cifra de ${record.figure} para ${record.window} de la tabla del Procurador General consultada el ${RETRIEVED}. La cobertura de esta unidad no está confirmada, así que no se indica una sola renta permitida.`;
  } else if (record.capStatus === "unsure") {
    const percentLine =
      record.id === "los-gatos"
        ? "The current computed percentage for a dated window is unsure."
        : "This entry does not state a percentage to apply.";
    summaryEn =
      `${record.name} (${record.citation}). ${effective} The allowable local increase is unsure. ${percentLine}${detail} Read the official page: ${record.sourceUrl}. Placeholder pending clinic review.`;
    summaryEs =
      `${record.name} (${record.citation}). La fecha de vigencia está marcada unsure. El aumento local permitido está marcado unsure. Esta ficha no indica un porcentaje para aplicar. Lea la página oficial: ${record.sourceUrl}. Ficha provisional pendiente de revisión clínica.`;
    reasonEn = `The allowable local increase is unsure. No percentage is applied. Read ${record.sourceUrl}.`;
    reasonEs = "El aumento local permitido está marcado unsure. No se aplica un porcentaje.";
  } else {
    summaryEn =
      `${record.name} (${record.citation}). ${effective} This library did not find a local percentage rent cap in the official source. Statewide AB 1482 may still apply to a covered unit.${detail} Official page: ${record.sourceUrl}. Placeholder pending clinic review.`;
    summaryEs =
      `${record.name} (${record.citation}). ${record.effectiveDate ? `La fuente oficial fecha esta ordenanza el ${record.effectiveDate}.` : "La fecha de vigencia está marcada unsure."} Esta biblioteca no encontró un tope local de porcentaje. La ley estatal todavía puede aplicar a una unidad cubierta. Ficha provisional pendiente de revisión clínica.`;
    reasonEn = "No local percentage rent cap is stated. Statewide rules may still apply. Coverage is not confirmed.";
    reasonEs = "No se indica un tope local de porcentaje. Las reglas estatales todavía pueden aplicar. La cobertura no está confirmada.";
  }

  const id = `LOCAL-${record.id.toUpperCase().replace(/-/g, "_")}`;
  return {
    id: record.id,
    jurisdiction: record.id,
    name: record.name,
    places: record.places,
    zips: record.zips,
    area: record.area,
    housingName: record.housingName,
    housingUrl: record.housingUrl,
    match: record.match,
    county: record.county,
    capStatus: record.capStatus,
    rules: [
      rule({
        id,
        jurisdiction: "LOCAL",
        topic: record.topic,
        topics: [record.name.toLowerCase(), record.county.toLowerCase(), record.topic, record.citation.toLowerCase()],
        titleEn: `${record.name} local tenant ordinance`,
        titleEs: `Ordenanza local de inquilinos de ${record.name}`,
        summaryEn,
        summaryEs,
        citation: record.citation,
        sourceName: record.sourceName,
        sourceUrl: record.sourceUrl,
        findingLabel: "informational",
        confidence: record.capStatus === "published" ? "medium" : "low",
        reasonEn,
        reasonEs,
        patterns: [],
      }),
    ],
  };
}

export const CATALOG_PACKS: CityPack[] = ORDINANCES.map(buildPack);
