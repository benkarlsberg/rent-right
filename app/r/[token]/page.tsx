import { Logo } from "@/components/logo";
import { landlordReply } from "@/lib/actions";
import { Disclaimer } from "@/components/ui";
import { messageByToken } from "@/lib/db";
import { readLocale } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function RespondPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  const locale = await readLocale();
  const message = await messageByToken(token);
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-10">
      <Logo />
      <h1 className="mt-4 text-4xl">{tx(locale, "Respond without an account", "Responder sin cuenta")}</h1>
      {!message && <p className="note-clay mt-4">{tx(locale, "This link is not valid.", "Este enlace no es válido.")}</p>}
      {query.done === "fixed" && <p className="note-pine mt-4" role="status">{tx(locale, "Recorded with a timestamp. The tenant confirms before it is marked resolved.", "Quedó registrado con fecha y hora. El inquilino confirma antes de marcarlo como resuelto.")}</p>}
      {query.done && query.done !== "fixed" && <p className="note-pine mt-4" role="status">{tx(locale, "Recorded with a timestamp.", "Quedó registrado con fecha y hora.")}</p>}
      {query.error && <p className="note-clay mt-4" role="alert">{query.error}</p>}
      {message && (
        <form action={landlordReply} className="card mt-4 p-5">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-mute">{message.subject}</p>
          <div className="field mt-3">
            <label htmlFor="action">{tx(locale, "Response", "Respuesta")}</label>
            <select id="action" name="action">
              <option value="acknowledge">{tx(locale, "Acknowledge", "Acusar recibo")}</option>
              <option value="schedule">{tx(locale, "Schedule", "Programar")}</option>
              <option value="fixed">{tx(locale, "Mark fixed", "Marcar arreglado")}</option>
              <option value="dispute">{tx(locale, "Dispute", "Disputar")}</option>
              <option value="block">{tx(locale, "Block later non-essential mail", "Bloquear correo no esencial")}</option>
              <option value="abuse">{tx(locale, "Report abuse", "Reportar abuso")}</option>
            </select>
          </div>
          <div className="field"><label htmlFor="note">{tx(locale, "Note", "Nota")}</label><textarea id="note" name="note" /></div>
          <button className="btn btn-primary" type="submit">{tx(locale, "Submit", "Enviar")}</button>
        </form>
      )}
      <div className="mt-4"><Disclaimer locale={locale} /></div>
    </main>
  );
}
