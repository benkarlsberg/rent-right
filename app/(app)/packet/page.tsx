import { Disclaimer } from "@/components/ui";
import { packetLines } from "@/lib/packet";
import { getDeposit, listConditions, listDeadlines, listLedger, listLogHistory, listMessages, primaryUnit, unitAddress } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function PacketPage() {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale = user.locale;
  const deposit = getDeposit(user.id, unit.id);
  const lines = packetLines({
    user,
    unit,
    logs: listLogHistory(user.id, unit.id),
    messages: listMessages(user.id, unit.id),
    deadlines: listDeadlines(user.id, unit.id),
    ledger: listLedger(user.id, unit.id).map((row) => ({ paidOn: row.paid_on, amountCents: row.amount_cents, method: row.method, notes: row.notes, voidedAt: row.voided_at })),
    deposit: deposit ? { amountCents: deposit.amount_cents, moveOutDate: deposit.move_out_date, forwardingAddress: deposit.forwarding_address } : null,
    conditions: listConditions(user.id, unit.id).map((report) => ({ kind: report.kind, createdAt: report.createdAt, contentHash: report.contentHash, acknowledgedAt: report.acknowledgedAt })),
  });
  return (
    <div>
      <h1 className="text-4xl">{tx(locale, "Evidence packet", "Paquete de pruebas")}</h1>
      <p className="mt-2 max-w-2xl">{tx(locale, "This is a compilation of records you stored. It does not say who is liable or what to file.", "Esto es una recopilación de registros que usted guardó. No dice quién es responsable ni qué presentar.")}</p>
      <section className="note-pine mt-4 text-sm">
        <p className="font-semibold">{tx(locale, "Free paths, before any paid step", "Vías gratis, antes de cualquier paso de pago")}</p>
        <ul className="mt-2 list-disc pl-5">
          <li><a className="underline" href="https://housing.lacity.gov/">LAHD</a> · <a className="underline" href="https://dcba.lacounty.gov/rentstabilizationprogram/">LA County DCBA</a> · <a className="underline" href="https://www.sandiego.gov/development-services/code-enforcement">San Diego code enforcement</a></li>
          <li><a className="underline" href="https://selfhelp.courts.ca.gov/small-claims">{tx(locale, "Small claims self-help", "Autoayuda de reclamos menores")}</a></li>
          <li><a className="underline" href="https://www.stayhousedla.org/">Stay Housed L.A.</a> · <a className="underline" href="https://www.lassd.org/">Legal Aid Society of San Diego</a></li>
        </ul>
      </section>
      <a className="btn btn-primary mt-4" href="/api/packet">{tx(locale, "Download factual PDF", "Descargar PDF de hechos")}</a>
      <p className="mt-4 text-sm text-mute">{unitAddress(unit)}</p>
      <pre className="card mt-3 whitespace-pre-wrap p-4 font-sans text-sm">{lines.join("\n")}</pre>
      <div className="mt-4"><Disclaimer locale={locale} /></div>
    </div>
  );
}
