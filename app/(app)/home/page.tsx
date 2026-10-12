import Link from "next/link";
import { Alert, ClinicNote, Disclaimer } from "@/components/ui";
import { listDeadlines, listLogs, listNotifications, primaryUnit, unitAddress } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { DEMO_EMAIL } from "@/lib/seed";
import { relayAddress, tx } from "@/lib/text";
import { todayISO } from "@/lib/rules/dates";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale = user.locale;
  const params = await searchParams;
  const today = todayISO();
  const deadlines = listDeadlines(user.id, unit.id).filter((item) => item.status === "open").slice(0, 4);
  const logs = listLogs(user.id, unit.id).slice(0, 4);
  const notes = listNotifications(user.id).slice(0, 3);
  const flags = logs.flatMap((entry) => {
    const retaliation = entry.flags.retaliation as { flagged?: boolean; explanation?: string; explanationEs?: string; ruleId?: string } | undefined;
    return retaliation?.flagged ? [retaliation] : [];
  });
  return (
    <div>
      <p className="kicker text-pine">{unit.jurisdiction.replaceAll("_", " ")}</p>
      <h1 className="mt-1 text-4xl">{tx(locale, "Hello", "Hola")} {user.name || tx(locale, "there", "")}</h1>
      <p className="mt-2 text-mute">{unitAddress(unit)}</p>
      {user.email === DEMO_EMAIL && <p className="mt-3 pill">{tx(locale, "Sample tenancy. Reset it any time from the sign-in page.", "Ejemplo. Puede reiniciarlo desde la página de entrada.")}</p>}
      <div className="mt-4"><Alert locale={locale} error={params.error} /></div>
      {flags[0] && (
        <aside className="note-clay mt-4" role="note">
          <p className="font-semibold">{tx(locale, "A notice landed inside 180 days of a repair log.", "Un aviso cayó dentro de 180 días de una reparación registrada.")}</p>
          <p className="mt-1 text-sm">{locale === "es" ? flags[0].explanationEs : flags[0].explanation}</p>
          <p className="mt-1 text-sm">Rule ID: {flags[0].ruleId}</p>
        </aside>
      )}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-2xl">{tx(locale, "Tracked dates", "Fechas")}</h2>
          <ul className="mt-3 space-y-3">
            {deadlines.length === 0 && <li className="text-sm text-mute">{tx(locale, "None yet. Log a repair or a move-out date.", "Aún no hay. Registre una reparación o la fecha de mudanza.")}</li>}
            {deadlines.map((item) => (
              <li key={item.id}>
                <p className="font-semibold">{item.dueDate ? formatDate(item.dueDate, locale) : tx(locale, "Unsure", "No se puede precisar")} {item.dueDate && item.dueDate < today ? tx(locale, "(date has passed)", "(la fecha ya pasó)") : ""}</p>
                <p className="text-sm">{locale === "es" ? item.explanationEs : item.explanation}</p>
                <p className="text-xs text-mute">Rule {item.ruleId} · {item.computation}</p>
              </li>
            ))}
          </ul>
          <Link className="mt-3 inline-block text-sm underline" href="/deadlines">{tx(locale, "All dates", "Todas las fechas")}</Link>
        </section>
        <section className="card p-5">
          <h2 className="text-2xl">{tx(locale, "Latest log", "Registro reciente")}</h2>
          <ul className="mt-3 space-y-3">
            {logs.map((entry) => (
              <li key={entry.id}>
                <Link href={`/log/${entry.id}`} className="font-semibold underline">{entry.eventDate} · {entry.type}</Link>
                <p className="text-sm">{entry.description.slice(0, 140)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="btn btn-primary" href="/log/new">{tx(locale, "Log something", "Registrar algo")}</Link>
            <Link className="btn btn-ghost" href="/lease">{tx(locale, "Review a lease", "Revisar contrato")}</Link>
          </div>
        </section>
      </div>
      {notes.length > 0 && (
        <section className="card mt-4 p-5">
          <h2 className="text-2xl">{tx(locale, "Reminders", "Recordatorios")}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {notes.map((note) => <li key={note.id}><span className="font-semibold">{note.title}.</span> {note.body}</li>)}
          </ul>
        </section>
      )}
      <p className="mt-4 text-sm text-mute">{tx(locale, "Landlord relay", "Correo puente")}: {relayAddress(unit.relayLocal)}. {tx(locale, "You are copied on mail to the landlord.", "Usted va en copia en el correo al propietario.")}</p>
      <div className="mt-4 space-y-3">
        <ClinicNote locale={locale} />
        <Disclaimer locale={locale} />
      </div>
    </div>
  );
}
