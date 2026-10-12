import { checkIncrease, suggestPlace } from "@/lib/actions";
import { Alert, ClinicNote, Disclaimer } from "@/components/ui";
import { latestRentCheck, primaryUnit, unitAddress } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { percentLabel } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function IncreasePage({ searchParams }: { searchParams: Promise<{ error?: string; suggestion?: string; note?: string }> }) {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale = user.locale;
  const params = await searchParams;
  const saved = latestRentCheck(user.id, unit.id);
  const result = saved?.result;
  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl">{tx(locale, "Rent increase checker", "Revisión de aumento de renta")}</h1>
      <p className="mt-2 text-sm text-mute">{unitAddress(unit)}. {tx(locale, "Caps are read from the dated library. If coverage is unknown, the checker does not pick a single allowed rent.", "Los topes se leen de la biblioteca con fechas. Si la cobertura es desconocida, la herramienta no elige una sola renta permitida.")}</p>
      <div className="mt-3 space-y-3">
        <Alert locale={locale} error={params.error} />
        {params.note && <p className="note-pine text-sm" role="status">{params.note}</p>}
        <ClinicNote locale={locale} />
      </div>
      <form action={suggestPlace} className="card mt-4 p-5">
        <label htmlFor="address">{tx(locale, "Look up an address", "Buscar una dirección")}</label>
        <input id="address" name="address" className="mt-1" defaultValue={unitAddress(unit)} />
        <button className="btn btn-ghost mt-3" type="submit">{tx(locale, "Suggest jurisdiction", "Sugerir jurisdicción")}</button>
        <p className="mt-2 text-xs text-mute">{tx(locale, "Uses the U.S. Census geocoder when it is reachable. You still choose the jurisdiction. City of LA RSO status is on", "Usa el geocodificador del Censo de EE. UU. cuando está disponible. Usted igual elige la jurisdicción. El estado RSO de la Ciudad de LA está en")} <a className="underline" href="https://zimas.lacity.org/">ZIMAS</a>.</p>
      </form>
      <form action={checkIncrease} className="card mt-4 p-5">
        <div className="field">
          <label htmlFor="jurisdiction">{tx(locale, "Jurisdiction", "Jurisdicción")}</label>
          <select id="jurisdiction" name="jurisdiction" defaultValue={params.suggestion || unit.jurisdiction}>
            <option value="city_la">City of Los Angeles</option>
            <option value="la_county_unincorporated">Unincorporated LA County</option>
            <option value="city_sd">City of San Diego</option>
            <option value="other_ca">Other California</option>
            <option value="unsure">{tx(locale, "Not sure", "No sé")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="rsoStatus">{tx(locale, "RSO status, if City of LA", "Estado RSO, si es Ciudad de LA")}</label>
          <select id="rsoStatus" name="rsoStatus" defaultValue={unit.rsoStatus}><option value="unsure">Unsure</option><option value="covered">Covered</option><option value="not_covered">Not covered</option></select>
        </div>
        <div className="field">
          <label htmlFor="rstpoTier">{tx(locale, "County tier, if unincorporated", "Categoría del condado, si no está incorporado")}</label>
          <select id="rstpoTier" name="rstpoTier" defaultValue={unit.rstpoTier}>
            <option value="unsure">Unsure</option>
            <option value="fully_covered">Fully covered (1.919%)</option>
            <option value="small_landlord">Small landlord (2.919%)</option>
            <option value="luxury">Luxury (3.919%)</option>
            <option value="not_covered">Not covered</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="countyArea">{tx(locale, "Statewide chart area, if not LA or SD city", "Área de la tabla estatal, si no es la ciudad de LA o SD")}</label>
          <select id="countyArea" name="countyArea" defaultValue="los_angeles_orange">
            <option value="los_angeles_orange">Los Angeles / Orange</option>
            <option value="san_diego">San Diego</option>
            <option value="riverside_san_bernardino">Riverside / San Bernardino</option>
            <option value="san_francisco_bay">SF Bay counties</option>
            <option value="other_ca">Other counties</option>
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="field"><label htmlFor="lowest">{tx(locale, "Lowest rent in the prior 12 months", "Renta más baja en los 12 meses anteriores")}</label><input id="lowest" name="lowest" required defaultValue={unit.rentCents != null ? String(unit.rentCents / 100) : ""} /></div>
          <div className="field"><label htmlFor="proposed">{tx(locale, "Proposed rent", "Renta propuesta")}</label><input id="proposed" name="proposed" required /></div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="field"><label htmlFor="noticeDate">{tx(locale, "Notice date", "Fecha del aviso")}</label><input id="noticeDate" name="noticeDate" type="date" /></div>
          <div className="field"><label htmlFor="effectiveDate">{tx(locale, "Effective date", "Fecha de vigencia")}</label><input id="effectiveDate" name="effectiveDate" type="date" required /></div>
          <div className="field"><label htmlFor="lastIncreaseDate">{tx(locale, "Last increase", "Último aumento")}</label><input id="lastIncreaseDate" name="lastIncreaseDate" type="date" /></div>
        </div>
        <label className="check mb-3"><input type="checkbox" name="claimsExemption" />{tx(locale, "A possible exemption was claimed. This checker cannot verify it.", "Se mencionó una posible exención. Esta herramienta no puede verificarla.")}</label>
        <button className="btn btn-primary" type="submit">{tx(locale, "Check", "Revisar")}</button>
      </form>
      {result && (
        <section className="card mt-4 p-5" aria-live="polite">
          <p className="kicker">{tx(locale, "General information", "Información general")}</p>
          <h2 className="mt-1 text-3xl">{result.applicable.status === "over_cap" ? tx(locale, "Above the stricter published figure", "Por encima de la cifra publicada más estricta") : result.applicable.status === "within_cap" ? tx(locale, "At or under the stricter published figure", "En o bajo la cifra publicada más estricta") : tx(locale, "Unsure which cap controls", "No se puede precisar qué tope manda")}</h2>
          <p className="mt-2">{locale === "es" ? result.applicable.reasonEs : result.applicable.reason}</p>
          <p className="mt-2 text-sm">{tx(locale, "Increase", "Aumento")}: {result.percentLabel}. {tx(locale, "Notice", "Aviso")}: {result.notice.givenDays} {tx(locale, "days given", "días dados")}, {result.notice.requiredDays} {tx(locale, "required", "requeridos")} ({result.notice.ok ? "ok" : tx(locale, "short", "corto")}). Rule {result.notice.ruleId}.</p>
          <p className="text-sm">{result.notice.computation}</p>
          <p className="mt-2 text-sm">{result.frequency.computation}</p>
          {result.applicable.maxRentCents != null && <p className="mt-2 font-semibold">{tx(locale, "Stricter max in this library", "Máximo más estricto en esta biblioteca")}: {formatMoney(result.applicable.maxRentCents, locale)} {result.applicable.ppm != null ? `(${percentLabel(result.applicable.ppm)})` : ""} · {result.applicable.ruleId}</p>}
          {result.ab1482 && <p className="mt-2 text-sm">AB 1482: {result.ab1482.unsure ? tx(locale, "unsure", "no se puede precisar") : percentLabel(result.ab1482.ppm || 0)} — {locale === "es" ? result.ab1482.noteEs : result.ab1482.note}</p>}
          {result.local && <p className="mt-2 text-sm">{tx(locale, "Local", "Local")}: {result.local.unsure ? tx(locale, "unsure", "no se puede precisar") : percentLabel(result.local.ppm || 0)} — {locale === "es" ? result.local.noteEs : result.local.note}</p>}
          <p className="mt-2 text-sm">{locale === "es" ? result.jurisdictionNoteEs : result.jurisdictionNote}</p>
          {result.utilityNote && <p className="mt-2 text-sm">{result.utilityNote}</p>}
          {result.exemptionUnverified && <p className="note-clay mt-3 text-sm">{tx(locale, "You marked a possible exemption. The comparison above is only for a unit where no exemption applies.", "Marcó una posible exención. La comparación de arriba es solo para una unidad sin exención.")}</p>}
          <ul className="mt-3 list-disc pl-5 text-sm">{(locale === "es" ? result.exemptionsToConfirmEs : result.exemptionsToConfirm).map((item) => <li key={item}>{item}</li>)}</ul>
          <Disclaimer locale={locale} />
        </section>
      )}
    </div>
  );
}
