import { toggleDeadline } from "@/lib/actions";
import { Alert, Disclaimer } from "@/components/ui";
import { listDeadlines, primaryUnit } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function DeadlinesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale = user.locale;
  const params = await searchParams;
  const rows = listDeadlines(user.id, unit.id);
  return (
    <div>
      <h1 className="text-4xl">{tx(locale, "Dates", "Fechas")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-mute">{tx(locale, "The rules engine sets these dates. Reminders are checked for 7 days before, 3 days before, and the day itself. Confirm each date with the official source.", "El motor de reglas fija estas fechas. Los recordatorios se revisan 7 días antes, 3 días antes y el mismo día. Confirme cada fecha con la fuente oficial.")}</p>
      <div className="mt-3"><Alert locale={locale} error={params.error} /></div>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="card p-4">
            <p className="font-semibold">{row.dueDate ? formatDate(row.dueDate, locale) : tx(locale, "Unsure — no date calculated", "No se puede precisar — no se calculó fecha")} · {row.kind} · {row.status}</p>
            <p className="mt-1 text-sm">{locale === "es" ? row.explanationEs : row.explanation}</p>
            <p className="mt-1 text-xs text-mute">Rule {row.ruleId}. {row.computation}</p>
            <form action={toggleDeadline} className="mt-2">
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="status" value={row.status === "open" ? "done" : "open"} />
              <button className="btn btn-ghost" type="submit">{row.status === "open" ? tx(locale, "Mark done", "Marcar hecho") : tx(locale, "Reopen", "Reabrir")}</button>
            </form>
          </li>
        ))}
      </ul>
      <div className="mt-4"><Disclaimer locale={locale} /></div>
    </div>
  );
}
