import Link from "next/link";
import { openSample, requestMagicLink } from "@/lib/actions";
import { Alert, Disclaimer } from "@/components/ui";
import { readLocale } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string; dev?: string }> }) {
  const locale = await readLocale();
  const params = await searchParams;
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-12">
      <Link href="/" className="serif text-3xl text-pine">Rent Right</Link>
      <h1 className="mt-6 text-4xl">{tx(locale, "Sign in with email", "Entre con su correo")}</h1>
      <p className="mt-2 text-mute">{tx(locale, "We email you a link. No password.", "Le enviamos un enlace. Sin contraseña.")}</p>
      <Alert locale={locale} error={params.error} saved={params.sent === "1"} />
      {params.sent === "1" && <p className="mt-3 note-pine">{tx(locale, "Check your inbox for the sign-in link.", "Revise su correo para el enlace.")}</p>}
      {params.dev && (
        <p className="mt-3 note-pine">
          {tx(locale, "Email is not configured, so the link is shown here:", "El correo no está configurado, así que el enlace aparece aquí:")}{" "}
          <a className="underline" href={params.dev}>{tx(locale, "Open sign-in link", "Abrir enlace")}</a>
        </p>
      )}
      <form action={requestMagicLink} className="card mt-6 p-5">
        <div className="field">
          <label htmlFor="email">{tx(locale, "Email", "Correo")}</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <button className="btn btn-primary" type="submit">{tx(locale, "Email me a link", "Enviarme un enlace")}</button>
      </form>
      <form action={openSample} className="mt-4">
        <button className="btn btn-ghost" type="submit">{tx(locale, "View a sample Los Angeles tenancy", "Ver un ejemplo de Los Ángeles")}</button>
      </form>
      <div className="mt-6"><Disclaimer locale={locale} /></div>
    </main>
  );
}
