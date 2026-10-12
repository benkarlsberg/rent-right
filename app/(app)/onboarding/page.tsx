import { saveOnboarding } from "@/lib/actions";
import { Alert, Disclaimer } from "@/components/ui";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = (await currentUser())!;
  const locale = user.locale;
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-4xl">{tx(locale, "Your unit", "Su unidad")}</h1>
      <p className="mt-2 text-mute">{tx(locale, "This stays on your account. Rent Right does not text your landlord.", "Esto queda en su cuenta. Rent Right no manda textos a su propietario.")}</p>
      <div className="mt-4"><Alert locale={locale} error={params.error} /></div>
      <form action={saveOnboarding} className="card mt-4 p-5">
        <div className="field"><label htmlFor="name">{tx(locale, "Your name", "Su nombre")}</label><input id="name" name="name" defaultValue={user.name} /></div>
        <div className="field"><label htmlFor="street">{tx(locale, "Street address", "Dirección")}</label><input id="street" name="street" required /></div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="field"><label htmlFor="unitNumber">{tx(locale, "Unit", "Unidad")}</label><input id="unitNumber" name="unitNumber" /></div>
          <div className="field"><label htmlFor="city">{tx(locale, "City", "Ciudad")}</label><input id="city" name="city" required /></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="field"><label htmlFor="postalCode">{tx(locale, "ZIP", "Código postal")}</label><input id="postalCode" name="postalCode" /></div>
          <div className="field"><label htmlFor="region">{tx(locale, "County", "Condado")}</label><input id="region" name="region" /></div>
        </div>
        <div className="field">
          <label htmlFor="jurisdiction">{tx(locale, "Jurisdiction", "Jurisdicción")}</label>
          <select id="jurisdiction" name="jurisdiction" defaultValue="unsure">
            <option value="unsure">{tx(locale, "I am not sure", "No estoy seguro")}</option>
            <option value="city_la">{tx(locale, "City of Los Angeles", "Ciudad de Los Ángeles")}</option>
            <option value="la_county_unincorporated">{tx(locale, "Unincorporated LA County", "Condado de LA no incorporado")}</option>
            <option value="city_sd">{tx(locale, "City of San Diego", "Ciudad de San Diego")}</option>
            <option value="other_ca">{tx(locale, "Somewhere else in California", "Otro lugar de California")}</option>
          </select>
        </div>
        <label className="check mb-3"><input type="checkbox" name="jurisdictionConfirmed" />{tx(locale, "I confirmed this location (ZIMAS for City of LA, the county map otherwise).", "Confirmé este lugar (ZIMAS para la Ciudad de LA, o el mapa del condado).")}</label>
        <div className="field">
          <label htmlFor="rsoStatus">{tx(locale, "City of LA RSO coverage", "Cobertura RSO de la Ciudad de LA")}</label>
          <select id="rsoStatus" name="rsoStatus" defaultValue="unsure">
            <option value="unsure">{tx(locale, "Not sure — check ZIMAS", "No sé — revise ZIMAS")}</option>
            <option value="covered">{tx(locale, "Covered", "Cubierta")}</option>
            <option value="not_covered">{tx(locale, "Not covered", "No cubierta")}</option>
          </select>
        </div>
        <div className="field"><label htmlFor="landlordName">{tx(locale, "Landlord name", "Nombre del propietario")}</label><input id="landlordName" name="landlordName" required /></div>
        <div className="field"><label htmlFor="landlordEmail">{tx(locale, "Landlord email", "Correo del propietario")}</label><input id="landlordEmail" name="landlordEmail" type="email" required /></div>
        <div className="field"><label htmlFor="landlordPhone">{tx(locale, "Landlord phone (stored only — never texted)", "Teléfono del propietario (solo se guarda — nunca se le manda un texto)")}</label><input id="landlordPhone" name="landlordPhone" /></div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="field"><label htmlFor="rent">{tx(locale, "Monthly rent", "Renta mensual")}</label><input id="rent" name="rent" inputMode="decimal" /></div>
          <div className="field"><label htmlFor="deposit">{tx(locale, "Deposit", "Depósito")}</label><input id="deposit" name="deposit" inputMode="decimal" /></div>
          <div className="field"><label htmlFor="moveInDate">{tx(locale, "Move-in", "Entrada")}</label><input id="moveInDate" name="moveInDate" type="date" /></div>
        </div>
        <button className="btn btn-primary" type="submit">{tx(locale, "Save unit", "Guardar unidad")}</button>
      </form>
      <div className="mt-4"><Disclaimer locale={locale} /></div>
    </div>
  );
}
