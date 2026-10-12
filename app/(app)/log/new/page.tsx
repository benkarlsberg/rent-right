import { createLog } from "@/lib/actions";
import { Alert, Disclaimer } from "@/components/ui";
import { todayISO } from "@/lib/rules/dates";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function NewLogPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = (await currentUser())!;
  const locale = user.locale;
  const params = await searchParams;
  return (
    <div className="max-w-xl">
      <h1 className="text-4xl">{tx(locale, "New log entry", "Nueva entrada")}</h1>
      <p className="mt-2 text-sm text-mute">{tx(locale, "Write it in your own words. If you email the landlord, those words are what gets sent. Rent Right does not write a legal demand.", "Escríbalo con sus palabras. Si envía un correo al propietario, esas palabras son las que se mandan. Rent Right no redacta un reclamo legal.")}</p>
      <div className="mt-3"><Alert locale={locale} error={params.error} /></div>
      <form action={createLog} className="card mt-4 p-5">
        <div className="field">
          <label htmlFor="type">{tx(locale, "Type", "Tipo")}</label>
          <select id="type" name="type" defaultValue="repair">
            <option value="repair">{tx(locale, "Repair request", "Solicitud de reparación")}</option>
            <option value="notice_received">{tx(locale, "Notice I received", "Aviso que recibí")}</option>
            <option value="notice_sent">{tx(locale, "Notice I am sending", "Aviso que envío")}</option>
            <option value="conversation">{tx(locale, "Conversation", "Conversación")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="noticeKind">{tx(locale, "If it is a notice", "Si es un aviso")}</label>
          <select id="noticeKind" name="noticeKind" defaultValue="">
            <option value="">{tx(locale, "Not a notice", "No es un aviso")}</option>
            <option value="rent_increase">{tx(locale, "Rent increase", "Aumento de renta")}</option>
            <option value="eviction">{tx(locale, "Eviction / termination", "Desalojo / terminación")}</option>
            <option value="pay_or_quit_3day">{tx(locale, "3-day notice", "Aviso de 3 días")}</option>
            <option value="entry">{tx(locale, "Entry notice", "Aviso de entrada")}</option>
            <option value="other">{tx(locale, "Other", "Otro")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="severity">{tx(locale, "Repair severity", "Gravedad de la reparación")}</label>
          <select id="severity" name="severity" defaultValue="other">
            <option value="no_heat">{tx(locale, "No heat", "Sin calefacción")}</option>
            <option value="no_water">{tx(locale, "No water", "Sin agua")}</option>
            <option value="no_electricity">{tx(locale, "No electricity", "Sin electricidad")}</option>
            <option value="gas_leak">{tx(locale, "Suspected gas leak", "Posible fuga de gas")}</option>
            <option value="leak">{tx(locale, "Leak", "Fuga")}</option>
            <option value="mold">{tx(locale, "Mold", "Moho")}</option>
            <option value="pests">{tx(locale, "Pests", "Plagas")}</option>
            <option value="other">{tx(locale, "Other", "Otra")}</option>
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="field"><label htmlFor="room">{tx(locale, "Room", "Cuarto")}</label><input id="room" name="room" /></div>
          <div className="field"><label htmlFor="eventDate">{tx(locale, "Date of the event", "Fecha del hecho")}</label><input id="eventDate" name="eventDate" type="date" defaultValue={todayISO()} required /></div>
        </div>
        <div className="field"><label htmlFor="description">{tx(locale, "What happened", "Qué pasó")}</label><textarea id="description" name="description" required /></div>
        <div className="field"><label htmlFor="photo">{tx(locale, "Photo", "Foto")}</label><input id="photo" className="photo" name="photo" type="file" accept="image/*" /></div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="field"><label htmlFor="noticeAt">{tx(locale, "Entry notice sent at", "Aviso de entrada enviado")}</label><input id="noticeAt" name="noticeAt" type="datetime-local" /></div>
          <div className="field"><label htmlFor="entryAt">{tx(locale, "Entry time", "Hora de entrada")}</label><input id="entryAt" name="entryAt" type="datetime-local" /></div>
        </div>
        <div className="field"><label htmlFor="subject">{tx(locale, "Email subject, if you send it", "Asunto del correo, si lo envía")}</label><input id="subject" name="subject" /></div>
        <label className="check mb-4"><input type="checkbox" name="sendEmail" />{tx(locale, "Email my words to the landlord and copy me. Replies come back to the log.", "Enviar mis palabras al propietario y copiarme. Las respuestas vuelven al registro.")}</label>
        <button className="btn btn-primary" type="submit">{tx(locale, "Save to the log", "Guardar en el registro")}</button>
      </form>
      <div className="mt-4"><Disclaimer locale={locale} /></div>
    </div>
  );
}
