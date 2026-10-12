import { reviewSample, reviewUpload, sendFeedback } from "@/lib/actions";
import { Alert, ClinicNote, Disclaimer, findingPill } from "@/components/ui";
import { LIBRARY_VERSION, type Locale } from "@/lib/disclaimer";
import { listLeaseReviews, primaryUnit } from "@/lib/db";
import { formatTimestamp } from "@/lib/format";
import { LEASE_REVIEW_MONTHLY_CAP } from "@/lib/lease/review";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function LeasePage({ searchParams }: { searchParams: Promise<{ error?: string; feedback?: string }> }) {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale: Locale = user.locale;
  const params = await searchParams;
  const reviews = listLeaseReviews(user.id, unit.id);
  return (
    <div>
      <h1 className="text-4xl">{tx(locale, "Lease review", "Revisión del contrato")}</h1>
      <p className="mt-2 max-w-2xl text-mute">{tx(locale, "Each result quotes the clause and cites a rule ID from the library, or it says unsure. A model cannot invent a citation.", "Cada resultado cita la cláusula y un ID de regla de la biblioteca, o dice que no se puede precisar. Un modelo no puede inventar una cita.")}</p>
      <p className="mt-2 text-sm">{tx(locale, `${LEASE_REVIEW_MONTHLY_CAP} new reviews a month on the free account. The same text is saved and does not count again.`, `${LEASE_REVIEW_MONTHLY_CAP} revisiones nuevas al mes en la cuenta gratis. El mismo texto se guarda y no vuelve a contar.`)}</p>
      <div className="mt-4 space-y-3">
        <Alert locale={locale} error={params.error} saved={params.feedback === "1"} />
        <ClinicNote locale={locale} />
        <Disclaimer locale={locale} />
      </div>
      <form action={reviewUpload} className="card mt-4 p-5">
        <div className="field">
          <label htmlFor="file">{tx(locale, "PDF or photo", "PDF o foto")}</label>
          <input id="file" name="file" type="file" accept="application/pdf,image/*,.txt,text/plain" />
        </div>
        <div className="field">
          <label htmlFor="text">{tx(locale, "Or paste the lease text", "O pegue el texto del contrato")}</label>
          <textarea id="text" name="text" />
        </div>
        <p className="mb-3 text-sm text-mute">{tx(locale, "Photos are read only when a paid Gemini key is set. PDFs need selectable text, or paste the words.", "Las fotos se leen solo si hay una clave de pago de Gemini. Los PDF necesitan texto seleccionable, o pegue las palabras.")}</p>
        <button className="btn btn-primary" type="submit">{tx(locale, "Check against the library", "Revisar con la biblioteca")}</button>
      </form>
      <form action={reviewSample} className="mt-3">
        <button className="btn btn-ghost" type="submit">{tx(locale, "Review the sample lease", "Revisar el contrato de ejemplo")}</button>
      </form>
      <div className="mt-6 space-y-5">
        {reviews.map((review) => (
          <article key={review.id} className="card p-5">
            <p className="text-sm text-mute">{review.filename} · {formatTimestamp(review.createdAt, locale)} · {review.rulesVersion || LIBRARY_VERSION} {review.cached ? `· ${tx(locale, "saved result", "resultado guardado")}` : ""} {review.model ? `· ${review.model}` : ""}</p>
            <Disclaimer locale={locale} />
            <ul className="mt-4 space-y-4">
              {review.result.findings.map((finding) => (
                <li key={finding.id} className="border-t border-line pt-3">
                  <div className="flex flex-wrap items-center gap-2">{findingPill(finding.label, locale)} {finding.ruleId && <span className="text-sm font-semibold">{finding.ruleId}</span>}</div>
                  <blockquote className="mt-2 border-l-4 border-line pl-3 text-sm">“{finding.quote}”</blockquote>
                  <p className="mt-2 text-sm">{locale === "es" ? finding.reasonEs : finding.reasonEn}</p>
                  {finding.citation && <p className="mt-1 text-xs text-mute">{finding.citation}{finding.sourceUrl && <> · <a className="underline" href={finding.sourceUrl}>{tx(locale, "Source", "Fuente")}</a></>}</p>}
                </li>
              ))}
            </ul>
            <form action={sendFeedback} className="mt-4">
              <input type="hidden" name="reviewId" value={review.id} />
              <label htmlFor={`note-${review.id}`}>{tx(locale, "This looks wrong", "Esto se ve mal")}</label>
              <textarea id={`note-${review.id}`} name="note" className="mt-1" />
              <button className="btn btn-ghost mt-2" type="submit">{tx(locale, "Send feedback", "Enviar comentario")}</button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
