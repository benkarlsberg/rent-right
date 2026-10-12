import { ackReport } from "@/lib/actions";
import { Disclaimer } from "@/components/ui";
import { readLocale } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function AckPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  const locale = await readLocale();
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-10">
      <p className="serif text-3xl text-pine">Rent Right</p>
      <h1 className="mt-4 text-4xl">{tx(locale, "Acknowledge a condition report", "Acusar un reporte del estado")}</h1>
      <p className="mt-2 text-sm text-mute">{tx(locale, "This records your name and the time. It is not a legal admission beyond what you type.", "Esto guarda su nombre y la hora. No es una admisión legal más allá de lo que usted escribe.")}</p>
      {query.done && <p className="note-pine mt-4" role="status">{tx(locale, "Acknowledgment saved.", "Acuse guardado.")}</p>}
      {query.error && <p className="note-clay mt-4" role="alert">{query.error}</p>}
      <form action={ackReport} className="card mt-4 p-5">
        <input type="hidden" name="token" value={token} />
        <div className="field"><label htmlFor="name">{tx(locale, "Your name", "Su nombre")}</label><input id="name" name="name" required /></div>
        <button className="btn btn-primary" type="submit">{tx(locale, "Acknowledge", "Acusar recibo")}</button>
      </form>
      <div className="mt-4"><Disclaimer locale={locale} /></div>
    </main>
  );
}
