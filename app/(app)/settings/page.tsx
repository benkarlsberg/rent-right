import { inviteRoommate, removeAccount, saveSettings, setLanguage } from "@/lib/actions";
import { Alert, Disclaimer } from "@/components/ui";
import { primaryUnit } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; invite?: string }> }) {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale = user.locale;
  const params = await searchParams;
  return (
    <div className="max-w-xl">
      <h1 className="text-4xl">{tx(locale, "Settings", "Ajustes")}</h1>
      <div className="mt-3"><Alert locale={locale} error={params.error} saved={params.saved === "1"} /></div>
      {params.invite && <p className="note-pine mt-3 break-all text-sm">{tx(locale, "Roommate link (share once):", "Enlace para compañero de cuarto (compártalo una vez):")} {params.invite}</p>}
      <form action={setLanguage} className="mt-4">
        <input type="hidden" name="locale" value={locale === "es" ? "en" : "es"} />
        <input type="hidden" name="next" value="/settings" />
        <button className="btn btn-ghost" type="submit">{locale === "es" ? "English" : "Español"}</button>
      </form>
      <form action={saveSettings} className="card mt-4 p-5">
        <div className="field"><label htmlFor="name">{tx(locale, "Name", "Nombre")}</label><input id="name" name="name" defaultValue={user.name} /></div>
        <div className="field"><label htmlFor="phone">{tx(locale, "Your phone (optional, never used to text a landlord)", "Su teléfono (opcional, nunca se usa para texto al propietario)")}</label><input id="phone" name="phone" defaultValue={user.phone} /></div>
        <input type="hidden" name="locale" value={locale} />
        <label className="check mb-3"><input type="checkbox" name="lowBandwidth" defaultChecked={user.lowBandwidth} />{tx(locale, "Low-bandwidth mode (hide photos)", "Modo de poco datos (oculta fotos)")}</label>
        <div className="field"><label htmlFor="street">{tx(locale, "Street", "Calle")}</label><input id="street" name="street" defaultValue={unit.street} required /></div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="field"><label htmlFor="unitNumber">{tx(locale, "Unit", "Unidad")}</label><input id="unitNumber" name="unitNumber" defaultValue={unit.unitNumber} /></div>
          <div className="field"><label htmlFor="city">{tx(locale, "City", "Ciudad")}</label><input id="city" name="city" defaultValue={unit.city} required /></div>
        </div>
        <div className="field"><label htmlFor="postalCode">ZIP</label><input id="postalCode" name="postalCode" defaultValue={unit.postalCode} /></div>
        <div className="field"><label htmlFor="region">{tx(locale, "County", "Condado")}</label><input id="region" name="region" defaultValue={unit.region} /></div>
        <div className="field"><label htmlFor="jurisdiction">{tx(locale, "Jurisdiction", "Jurisdicción")}</label>
          <select id="jurisdiction" name="jurisdiction" defaultValue={unit.jurisdiction}>
            <option value="city_la">City of Los Angeles</option>
            <option value="la_county_unincorporated">Unincorporated LA County</option>
            <option value="city_sd">City of San Diego</option>
            <option value="other_ca">Other California</option>
            <option value="unsure">Unsure</option>
          </select>
        </div>
        <label className="check mb-3"><input type="checkbox" name="jurisdictionConfirmed" defaultChecked={unit.jurisdictionConfirmed} />{tx(locale, "I confirmed this jurisdiction.", "Confirmé esta jurisdicción.")}</label>
        <div className="field"><label htmlFor="rsoStatus">RSO</label><select id="rsoStatus" name="rsoStatus" defaultValue={unit.rsoStatus}><option value="unsure">Unsure</option><option value="covered">Covered</option><option value="not_covered">Not covered</option></select></div>
        <div className="field"><label htmlFor="rstpoTier">RSTPO</label><select id="rstpoTier" name="rstpoTier" defaultValue={unit.rstpoTier}><option value="unsure">Unsure</option><option value="fully_covered">Fully covered</option><option value="small_landlord">Small landlord</option><option value="luxury">Luxury</option><option value="not_covered">Not covered</option></select></div>
        <div className="field"><label htmlFor="landlordName">{tx(locale, "Landlord", "Propietario")}</label><input id="landlordName" name="landlordName" defaultValue={unit.landlordName} required /></div>
        <div className="field"><label htmlFor="landlordEmail">{tx(locale, "Landlord email", "Correo del propietario")}</label><input id="landlordEmail" name="landlordEmail" type="email" defaultValue={unit.landlordEmail} required /></div>
        <div className="field"><label htmlFor="landlordPhone">{tx(locale, "Landlord phone (not texted)", "Teléfono del propietario (sin textos)")}</label><input id="landlordPhone" name="landlordPhone" defaultValue={unit.landlordPhone} /></div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="field"><label htmlFor="rent">{tx(locale, "Rent", "Renta")}</label><input id="rent" name="rent" defaultValue={unit.rentCents != null ? String(unit.rentCents / 100) : ""} /></div>
          <div className="field"><label htmlFor="deposit">{tx(locale, "Deposit", "Depósito")}</label><input id="deposit" name="deposit" defaultValue={unit.depositCents != null ? String(unit.depositCents / 100) : ""} /></div>
        </div>
        <div className="field"><label htmlFor="moveInDate">{tx(locale, "Move-in", "Entrada")}</label><input id="moveInDate" name="moveInDate" type="date" defaultValue={unit.moveInDate || ""} /></div>
        <button className="btn btn-primary" type="submit">{tx(locale, "Save", "Guardar")}</button>
      </form>
      {unit.role === "owner" && (
        <form action={inviteRoommate} className="mt-4">
          <button className="btn btn-ghost" type="submit">{tx(locale, "Invite a roommate", "Invitar a un compañero")}</button>
        </form>
      )}
      <p className="mt-4 text-sm"><a className="underline" href="/api/export">{tx(locale, "Download my data (JSON)", "Descargar mis datos (JSON)")}</a></p>
      <form action={removeAccount} className="card mt-4 p-5">
        <h2 className="text-2xl">{tx(locale, "Delete account", "Borrar cuenta")}</h2>
        <p className="mt-2 text-sm">{tx(locale, "If you are the only person on the unit, the unit records and files are deleted too. A roommate's shared log stays until they delete their account.", "Si usted es la única persona en la unidad, también se borran los registros y archivos. El registro compartido de un compañero se queda hasta que borre su cuenta.")}</p>
        <div className="field mt-3"><label htmlFor="confirm">{tx(locale, "Type DELETE", "Escriba DELETE")}</label><input id="confirm" name="confirm" /></div>
        <button className="btn btn-clay" type="submit">{tx(locale, "Delete my account", "Borrar mi cuenta")}</button>
      </form>
      <div className="mt-4"><Disclaimer locale={locale} /></div>
    </div>
  );
}
