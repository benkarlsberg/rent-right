import { formatAddressLines } from "@/lib/address-format";
import { listLedger, primaryUnit } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { renderPdf } from "@/lib/pdf";
import { withActor } from "@/lib/pg";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  return withActor(user.id, async () => {
  const unit = await primaryUnit(user.id);
  if (!unit) return new Response("Add a unit first.", { status: 400 });
  const rows = await listLedger(user.id, unit.id);
  const lines = [
    "# Rent ledger",
    "Payments the tenant entered. Rent Right did not collect this money.",
    ...formatAddressLines({
      street: unit.street,
      unit: unit.unitNumber,
      city: unit.city,
      region: unit.region,
      postalCode: unit.postalCode,
    }).filter(Boolean),
    ...rows.map((row) => `${row.paid_on} | ${formatMoney(row.amount_cents, "en")} | ${row.method}${row.voided_at ? " | voided" : ""} | ${row.notes}`),
  ];
  const pdf = await renderPdf("Rent ledger", lines);
  return new Response(Buffer.from(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=rent-ledger.pdf" },
  });
  });
}
