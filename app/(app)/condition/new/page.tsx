import { saveCondition } from "@/lib/actions";
import { Alert } from "@/components/ui";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

const ROOMS = ["Living room", "Kitchen", "Bedroom", "Bathroom", "Other / exterior"];

export default async function NewConditionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = (await currentUser())!;
  const locale = user.locale;
  const params = await searchParams;
  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl">{tx(locale, "New condition report", "Nuevo reporte")}</h1>
      <div className="mt-3"><Alert locale={locale} error={params.error} /></div>
      <form action={saveCondition} className="mt-4 space-y-4">
        <div className="field">
          <label htmlFor="kind">{tx(locale, "When", "Cuándo")}</label>
          <select id="kind" name="kind"><option value="move_in">{tx(locale, "Move-in", "Entrada")}</option><option value="move_out">{tx(locale, "Move-out", "Salida")}</option></select>
        </div>
        {ROOMS.map((room) => (
          <fieldset key={room} className="card p-4">
            <legend className="font-semibold">{room}</legend>
            <div className="field mt-2">
              <label htmlFor={`condition-${room}`}>{tx(locale, "Condition", "Estado")}</label>
              <select id={`condition-${room}`} name={`condition-${room}`}>
                <option value="good">{tx(locale, "Good", "Bien")}</option>
                <option value="fair">{tx(locale, "Fair", "Regular")}</option>
                <option value="damaged">{tx(locale, "Damaged", "Dañado")}</option>
              </select>
            </div>
            <div className="mb-2 flex flex-wrap gap-3 text-sm">
              {["walls", "floors", "windows", "doors", "water", "pests"].map((issue) => (
                <label key={issue} className="check"><input type="checkbox" name={`issues-${room}`} value={issue} />{issue}</label>
              ))}
            </div>
            <div className="field"><label htmlFor={`notes-${room}`}>{tx(locale, "Notes", "Notas")}</label><input id={`notes-${room}`} name={`notes-${room}`} /></div>
            <div className="field"><label htmlFor={`photo-${room}`}>{tx(locale, "Photo", "Foto")}</label><input id={`photo-${room}`} name={`photo-${room}`} type="file" accept="image/*" /></div>
          </fieldset>
        ))}
        <div className="field"><label htmlFor="notes">{tx(locale, "Overall notes", "Notas generales")}</label><textarea id="notes" name="notes" /></div>
        <button className="btn btn-primary" type="submit">{tx(locale, "Save and hash", "Guardar y resumir")}</button>
      </form>
    </div>
  );
}
