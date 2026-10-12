import { markMailed } from "@/lib/actions";
import { Alert, Disclaimer } from "@/components/ui";
import { listLogs, listMailed, primaryUnit } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function LettersPage({ searchParams }: { searchParams: Promise<{ error?: string; logged?: string; log?: string }> }) {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale = user.locale;
  const params = await searchParams;
  const logs = listLogs(user.id, unit.id);
  const mailed = listMailed(user.id, unit.id);
  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl">{tx(locale, "Letters you mail", "Cartas que usted envía")}</h1>
      <p className="mt-2 text-sm text-mute">{tx(locale, "When a notice has to go by mail, print it and pay the postage yourself. Photograph the certified-mail receipt and log it here. Rent Right does not mail letters.", "Cuando un aviso debe ir por correo, imprímalo y pague el porte usted. Fotografíe el recibo de correo certificado y regístrelo aquí. Rent Right no envía cartas.")}</p>
      <div className="mt-3"><Alert locale={locale} error={params.error} saved={params.logged === "1"} /></div>
      <ul className="mt-4 space-y-2">
        {logs.map((entry) => (
          <li key={entry.id} className="card flex items-center justify-between gap-3 p-4">
            <span className="text-sm">{entry.eventDate} · {entry.description.slice(0, 80)}</span>
            <a className="btn btn-ghost" href={`/api/letters/mail?log=${entry.id}`}>{tx(locale, "Print", "Imprimir")}</a>
          </li>
        ))}
      </ul>
      <form action={markMailed} className="card mt-4 p-5">
        <label htmlFor="logId">{tx(locale, "I printed a letter for this entry", "Imprimí una carta de esta entrada")}</label>
        <select id="logId" name="logId" defaultValue={params.log || ""}>
          <option value="">{tx(locale, "No specific entry", "Sin entrada específica")}</option>
          {logs.map((entry) => <option key={entry.id} value={entry.id}>{entry.eventDate} · {entry.type}</option>)}
        </select>
        <div className="field mt-3"><label htmlFor="receipt">{tx(locale, "Photo of the mailing receipt", "Foto del recibo de correo")}</label><input id="receipt" name="receipt" type="file" accept="image/*" /></div>
        <button className="btn btn-primary" type="submit">{tx(locale, "Log that I mailed it", "Registrar que lo envié")}</button>
      </form>
      <ul className="mt-4 text-sm">{mailed.map((item) => <li key={item.id}>{item.created_at} · {item.log_entry_id || tx(locale, "no entry", "sin entrada")}</li>)}</ul>
      <div className="mt-4"><Disclaimer locale={locale} /></div>
    </div>
  );
}
