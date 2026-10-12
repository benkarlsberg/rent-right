import { prepareDemand, saveDepositForm } from "@/lib/actions";
import { Alert, Disclaimer } from "@/components/ui";
import { getDeposit, listDeadlines, primaryUnit } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function DepositPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale = user.locale;
  const params = await searchParams;
  const deposit = getDeposit(user.id, unit.id);
  const due = listDeadlines(user.id, unit.id).find((item) => item.kind === "deposit" && item.status === "open");
  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl">{tx(locale, "Security deposit", "Depósito de seguridad")}</h1>
      <p className="mt-2 text-sm text-mute">{tx(locale, "The 21 days are calendar days added to the move-out date you enter. Rule CA-CC-1950.5.", "Los 21 días son días calendario sumados a la fecha de mudanza que usted anota. Regla CA-CC-1950.5.")}</p>
      {due?.dueDate && <p className="note-pine mt-4 text-lg font-semibold">{tx(locale, "Itemized statement due", "Desglose vence")} {formatDate(due.dueDate, locale)}</p>}
      {deposit?.amount_cents != null && <p className="mt-2">{tx(locale, "Amount you entered", "Monto que anotó")}: {formatMoney(deposit.amount_cents, locale)}</p>}
      <div className="mt-3"><Alert locale={locale} error={params.error} /></div>
      <form action={saveDepositForm} className="card mt-4 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="field"><label htmlFor="amount">{tx(locale, "Deposit amount", "Monto del depósito")}</label><input id="amount" name="amount" defaultValue={deposit?.amount_cents != null ? (deposit.amount_cents / 100).toString() : ""} /></div>
          <div className="field"><label htmlFor="receivedDate">{tx(locale, "Date paid", "Fecha de pago")}</label><input id="receivedDate" name="receivedDate" type="date" defaultValue={deposit?.received_date || ""} /></div>
        </div>
        <div className="field"><label htmlFor="moveOutDate">{tx(locale, "Move-out date", "Fecha de mudanza")}</label><input id="moveOutDate" name="moveOutDate" type="date" defaultValue={deposit?.move_out_date || ""} /></div>
        <div className="field"><label htmlFor="forwardingAddress">{tx(locale, "Forwarding address", "Dirección para el reenvío")}</label><input id="forwardingAddress" name="forwardingAddress" defaultValue={deposit?.forwarding_address || ""} /></div>
        <div className="field"><label htmlFor="landlordDeductions">{tx(locale, "What the landlord said was deducted", "Lo que el propietario dijo que descontó")}</label><textarea id="landlordDeductions" name="landlordDeductions" defaultValue={deposit?.landlord_deductions || ""} /></div>
        <button className="btn btn-primary" type="submit">{tx(locale, "Save and count 21 days", "Guardar y contar 21 días")}</button>
      </form>
      <form action={prepareDemand} className="card mt-4 p-5">
        <h2 className="text-2xl">{tx(locale, "Demand letter you send yourself", "Carta de reclamo que usted envía")}</h2>
        <p className="mt-2 text-sm text-mute">{tx(locale, "Rent Right does not send this letter. Download it, read it, and mail or email it from your own account.", "Rent Right no envía esta carta. Descárguela, léala y envíela por correo desde su propia cuenta.")}</p>
        <input type="hidden" name="dueDate" value={due?.dueDate || ""} />
        <input type="hidden" name="forwardingAddress" value={deposit?.forwarding_address || ""} />
        <input type="hidden" name="landlordDeductions" value={deposit?.landlord_deductions || ""} />
        <div className="field mt-3">
          <label htmlFor="disputeNotes">{tx(locale, "What you want, in your own words", "Lo que usted pide, con sus palabras")}</label>
          <textarea id="disputeNotes" name="disputeNotes" required placeholder={tx(locale, "Example: I have not received an itemized statement. Please return the full deposit.", "Ejemplo: No recibí un desglose. Por favor devuelva el depósito completo.")} />
        </div>
        <button className="btn btn-clay" type="submit">{tx(locale, "Download my letter", "Descargar mi carta")}</button>
      </form>
      <section className="mt-4 text-sm">
        <h2 className="text-2xl">{tx(locale, "Small claims", "Reclamos menores")}</h2>
        <p className="mt-2">{tx(locale, "Money claims can go to small claims court, where people usually represent themselves. Read the current limit and fees on the courts site. This packet is not a filing.", "Los reclamos de dinero pueden ir a la corte de reclamos menores, donde las personas suelen representarse solas. Lea el límite y las cuotas vigentes en el sitio de las cortes. Este paquete no es una demanda.")}</p>
        <a className="underline" href="https://selfhelp.courts.ca.gov/small-claims">selfhelp.courts.ca.gov/small-claims</a>
      </section>
      <div className="mt-4"><Disclaimer locale={locale} /></div>
    </div>
  );
}
