import Link from "next/link";
import { setLanguage } from "@/lib/actions";
import { ClinicNote, Disclaimer } from "@/components/ui";
import { readLocale } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function LandingPage() {
  const locale = await readLocale();
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="flex items-center justify-between">
        <p className="serif text-3xl text-pine">Rent Right</p>
        <div className="flex items-center gap-2">
          <form action={setLanguage}>
            <input type="hidden" name="locale" value={locale === "es" ? "en" : "es"} />
            <input type="hidden" name="next" value="/" />
            <button className="btn btn-ghost" type="submit">{locale === "es" ? "English" : "Español"}</button>
          </form>
          <Link className="btn btn-primary" href="/login">{tx(locale, "Sign in", "Entrar")}</Link>
        </div>
      </header>
      <main id="main" className="grid items-start gap-8 py-12 md:grid-cols-[1.3fr_0.7fr]">
        <div>
          <p className="kicker text-pine">{tx(locale, "Los Angeles and San Diego", "Los Ángeles y San Diego")}</p>
          <h1 className="mt-3 max-w-xl text-5xl leading-tight text-ink md:text-6xl">
            {tx(locale, "Your lease, your letters, your dates.", "Su contrato, sus cartas, sus fechas.")}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-mute">
            {tx(
              locale,
              "A free record for renters. It checks a lease against a cited rules library, keeps a timestamped log, and reminds you of dates the rules engine calculates. It is not a lawyer and it does not text landlords.",
              "Un registro gratis para inquilinos. Revisa un contrato con una biblioteca de reglas citadas, guarda un registro con fecha y hora, y recuerda fechas que calcula el motor de reglas. No es un abogado y no manda textos a propietarios.",
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href="/login">{tx(locale, "Use it free", "Úselo gratis")}</Link>
            <Link className="btn btn-ghost" href="/rules">{tx(locale, "Read the rules library", "Lea la biblioteca")}</Link>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-2xl">{tx(locale, "What it will not do", "Lo que no hace")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>{tx(locale, "No legal advice and no attorney-client relationship.", "No da asesoramiento legal ni crea una relación abogado-cliente.")}</li>
            <li>{tx(locale, "No landlord ratings.", "No califica propietarios.")}</li>
            <li>{tx(locale, "No texts to landlords.", "No manda mensajes de texto a propietarios.")}</li>
            <li>{tx(locale, "No paid referrals or sponsored pros.", "No hay referidos de pago ni profesionales patrocinados.")}</li>
            <li>{tx(locale, "Demand letters are yours to fill in and send.", "Las cartas de reclamo las llena y las envía usted.")}</li>
          </ul>
        </div>
      </main>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Lease review", "Revisión del contrato", "Upload a PDF or photo. Every flag quotes the clause and cites a rule ID, or says unsure.", "Suba un PDF o una foto. Cada aviso cita la cláusula y un ID de regla, o dice que no se puede precisar."],
          ["A log that stays put", "Un registro que queda", "Repair requests and notices get a server time and a hash. Landlord mail goes through a relay and copies you.", "Las solicitudes y los avisos llevan hora del servidor y un hash. El correo al propietario pasa por un puente y le copia a usted."],
          ["Dates in code", "Fechas en código", "The 21-day deposit count, repair reminders, and rent-cap math come from the rules engine, not from a chat model.", "El conteo de 21 días del depósito, los recordatorios de reparaciones y el cálculo del tope de renta salen del motor de reglas, no de un modelo de chat."],
        ].map(([en, es, detailEn, detailEs]) => (
          <article key={en} className="card p-5">
            <h2 className="text-2xl">{tx(locale, en, es)}</h2>
            <p className="mt-2 text-sm text-mute">{tx(locale, detailEn, detailEs)}</p>
          </article>
        ))}
      </section>
      <div className="mt-8 space-y-3">
        <ClinicNote locale={locale} />
        <Disclaimer locale={locale} />
      </div>
      <footer className="mt-8 flex gap-4 text-sm text-mute">
        <Link href="/terms">{tx(locale, "Terms", "Términos")}</Link>
        <Link href="/privacy">{tx(locale, "Privacy", "Privacidad")}</Link>
      </footer>
    </div>
  );
}
