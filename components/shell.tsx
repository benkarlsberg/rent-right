import Link from "next/link";
import { headers } from "next/headers";
import { signOut } from "@/lib/actions";
import { LIBRARY_VERSION, type Locale } from "@/lib/disclaimer";
import { tx } from "@/lib/text";
import type { Unit, User } from "@/lib/db";

const LINKS = [
  ["/home", "Home", "Inicio"],
  ["/log", "Log", "Registro"],
  ["/lease", "Lease", "Contrato"],
  ["/deadlines", "Dates", "Fechas"],
  ["/messages", "Mail", "Correo"],
  ["/deposit", "Deposit", "Depósito"],
  ["/increase", "Rent increase", "Aumento"],
  ["/assistant", "Rights", "Derechos"],
  ["/ledger", "Rent ledger", "Pagos"],
  ["/condition", "Photos", "Fotos"],
  ["/packet", "Packet", "Paquete"],
  ["/letters", "Letters", "Cartas"],
  ["/settings", "Settings", "Ajustes"],
];

export async function Shell({ user, unit, children }: { user: User; unit: Unit | null; children: React.ReactNode }) {
  const locale: Locale = user.locale;
  const path = (await headers()).get("x-pathname") || "";
  const short = LINKS.slice(0, 5);
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 overflow-y-auto px-3 py-5 md:flex">
        <Link href="/home" className="serif px-2 text-2xl text-pine">Rent Right</Link>
        <p className="px-2 pb-3 text-xs text-mute">{tx(locale, "Free for renters", "Gratis para inquilinos")}</p>
        {unit && LINKS.map(([href, en, es]) => (
          <Link key={href} href={href} data-active={path === href} className="nav-link">{tx(locale, en, es)}</Link>
        ))}
        <form action={signOut} className="mt-4 px-2">
          <button className="btn btn-ghost w-full" type="submit">{tx(locale, "Sign out", "Salir")}</button>
        </form>
      </aside>
      <div className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <Link href="/home" className="serif text-2xl text-pine">Rent Right</Link>
          <form action={signOut}><button className="btn btn-ghost" type="submit">{tx(locale, "Sign out", "Salir")}</button></form>
        </div>
        <main id="main">{children}</main>
        <footer className="mt-10 text-xs text-mute">
          Rent Right · {tx(locale, "Rules", "Reglas")} {LIBRARY_VERSION} · {tx(locale, "Pending clinic review", "Pendiente de revisión clínica")} · {tx(locale, "General information, not legal advice.", "Información general, no es asesoramiento legal.")}
        </footer>
      </div>
      {unit && (
        <nav className="bottom-nav no-print md:hidden" aria-label="Primary">
          {short.map(([href, en, es]) => (
            <Link key={href} href={href} data-active={path === href}>{tx(locale, en, es)}</Link>
          ))}
          <Link href="/settings">{tx(locale, "More", "Más")}</Link>
        </nav>
      )}
    </div>
  );
}
