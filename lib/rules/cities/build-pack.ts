import type { OrdinanceRecord } from "@/lib/rules/cities/catalog";
import { ORDINANCES } from "@/lib/rules/cities/catalog";
import type { CityPack } from "@/lib/rules/cities/types";
import { verificationFor } from "@/lib/rules/cities/verify";
import { rule } from "@/lib/rules/define";

const CHART = "https://oag.ca.gov/rentcaps";

export function effectiveSentence(record: OrdinanceRecord): string {
  if (record.effectiveDate) return `The official source dates this ordinance ${record.effectiveDate}.`;
  if (record.adoptedNote) return record.adoptedNote;
  return "The effective date is unsure.";
}

export function buildPack(record: OrdinanceRecord): CityPack {
  const verified = verificationFor(record);
  const applySentence = verified.coverage.apply
    ? "This checker applies a local figure only when the facts match the covered class on the official page. Otherwise it uses the statewide chart."
    : "This checker does not apply a local figure from this entry unless a later verified covered class says to. The statewide chart is the fallback.";
  const figureSentence = verified.figure && verified.window ? `Current figure on file: ${verified.figure} (${verified.window}).` : "";
  const sources = verified.coverage.sourceUrl === record.sourceUrl
    ? `Official page: ${record.sourceUrl}.`
    : `Official page: ${record.sourceUrl}. Coverage source: ${verified.coverage.sourceUrl}.`;
  const summaryEn = `${record.name} (${record.citation}). ${verified.effectiveNote} ${verified.capDetail} ${figureSentence} ${verified.coverage.summary} Retrieved ${verified.retrieved}. ${applySentence} ${sources} Chart: ${CHART}. General information checked Oct 12, 2026. Not legal advice.`;
  const summaryEs = verified.cap === "verified"
    ? `${record.name}. Hay una cifra local citada en la fuente oficial para la ventana indicada en inglés. Esta ficha aplica esa cifra solo si los datos coinciden con la clase cubierta. Si no, usa la tabla estatal. Información general revisada el 12 de octubre de 2026. No es asesoramiento legal.`
    : `${record.name}. El porcentaje local está marcado unsure o esta ordenanza no es un tope local. La herramienta usa la tabla estatal salvo que una clase cubierta confirmada diga otra cosa. Lea ${record.sourceUrl}. Información general revisada el 12 de octubre de 2026. No es asesoramiento legal.`;
  const reasonEn = verified.cap === "verified"
    ? "A local figure is on file from an official source. It is applied only when the facts match a covered class confirmed on a city or ordinance page."
    : "The current local percentage is unsure, or this ordinance is not a local percentage cap. The statewide chart is the fallback.";
  const reasonEs = "La cifra local se aplica solo cuando los datos coinciden con una clase cubierta confirmada. Si no, se usa la tabla estatal.";

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
    verification: verified,
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
        confidence: verified.cap === "verified" ? "medium" : "low",
        reasonEn,
        reasonEs,
        patterns: [],
      }),
    ],
  };
}

export const CATALOG_PACKS: CityPack[] = ORDINANCES.map(buildPack);
