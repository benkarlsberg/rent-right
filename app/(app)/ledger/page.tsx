import { addPayment, voidPayment } from "@/lib/actions";
import { Alert } from "@/components/ui";
import { listLedger, primaryUnit } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale = user.locale;
  const params = await searchParams;
  const rows = listLedger(user.id, unit.id);
  const total = rows.filter((row) => !row.voided_at).reduce((sum, row) => sum + row.amount_cents, 0);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl">{tx(locale, "Rent ledger", "Registro de renta")}</h1>
        <a className="btn btn-ghost" href="/api/ledger/pdf">{tx(locale, "Download PDF", "Descargar PDF")}</a>
      </div>
      <p className="mt-2 text-sm">{tx(locale, "Logged payments", "Pagos registrados")}: {formatMoney(total, locale)}. {tx(locale, "Rent Right does not move money.", "Rent Right no mueve dinero.")}</p>
      <div className="mt-3"><Alert locale={locale} error={params.error} /></div>
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="card flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{row.paid_on} · {formatMoney(row.amount_cents, locale)} · {row.method}{row.voided_at ? ` · ${tx(locale, "voided", "anulado")}` : ""}</p>
              <p className="text-sm text-mute">{row.notes} {row.period_start ? `(${row.period_start} – ${row.period_end || ""})` : ""}</p>
              {row.receipt_file_id && <a className="text-sm underline" href={`/api/files/${row.receipt_file_id}`}>{tx(locale, "Receipt", "Recibo")}</a>}
            </div>
            {!row.voided_at && (
              <form action={voidPayment}><input type="hidden" name="id" value={row.id} /><button className="btn btn-ghost" type="submit">{tx(locale, "Void", "Anular")}</button></form>
            )}
          </li>
        ))}
      </ul>
      <form action={addPayment} className="card mt-4 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="field"><label htmlFor="amount">{tx(locale, "Amount", "Monto")}</label><input id="amount" name="amount" required /></div>
          <div className="field"><label htmlFor="paidOn">{tx(locale, "Paid on", "Pagado el")}</label><input id="paidOn" name="paidOn" type="date" required /></div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="field"><label htmlFor="method">{tx(locale, "Method", "Forma")}</label>
            <select id="method" name="method"><option value="transfer">Transfer</option><option value="check">Check</option><option value="cash">Cash</option><option value="other">Other</option></select>
          </div>
          <div className="field"><label htmlFor="periodStart">{tx(locale, "Period start", "Inicio del período")}</label><input id="periodStart" name="periodStart" type="date" /></div>
          <div className="field"><label htmlFor="periodEnd">{tx(locale, "Period end", "Fin del período")}</label><input id="periodEnd" name="periodEnd" type="date" /></div>
        </div>
        <div className="field"><label htmlFor="notes">{tx(locale, "Notes", "Notas")}</label><input id="notes" name="notes" /></div>
        <div className="field"><label htmlFor="receipt">{tx(locale, "Receipt photo", "Foto del recibo")}</label><input id="receipt" name="receipt" type="file" accept="image/*,application/pdf" /></div>
        <button className="btn btn-primary" type="submit">{tx(locale, "Add payment", "Agregar pago")}</button>
      </form>
    </div>
  );
}
