import Link from "next/link";
import { listConditions, primaryUnit } from "@/lib/db";
import { formatTimestamp } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { appUrl, tx } from "@/lib/text";

export default async function ConditionPage() {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale = user.locale;
  const reports = listConditions(user.id, unit.id);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl">{tx(locale, "Condition reports", "Reportes del estado")}</h1>
        <Link className="btn btn-primary" href="/condition/new">{tx(locale, "New report", "Nuevo reporte")}</Link>
      </div>
      <p className="mt-2 text-sm text-mute">{tx(locale, "Room-by-room notes and photos, timestamped and hashed. The landlord can acknowledge with a link. No account required. AB 2801 is background in the rules library (CA-AB-2801).", "Notas y fotos por cuarto, con fecha y resumen. El propietario puede acusar recibo con un enlace. Sin cuenta. AB 2801 está como contexto en la biblioteca (CA-AB-2801).")}</p>
      <ul className="mt-4 space-y-3">
        {reports.map((report) => (
          <li key={report.id} className="card p-4">
            <p className="font-semibold">{report.kind} · {formatTimestamp(report.createdAt, locale)}</p>
            <ul className="mt-2 text-sm">{report.rooms.map((room) => <li key={room.room}>{room.room}: {room.condition}{room.notes ? ` — ${room.notes}` : ""}{room.photoFileId ? ` · ` : ""}{room.photoFileId && <a className="photo underline" href={`/api/files/${room.photoFileId}`}>{tx(locale, "photo", "foto")}</a>}</li>)}</ul>
            <p className="mt-2 break-all font-mono text-xs">{report.contentHash}</p>
            {report.ackToken && <p className="mt-2 text-sm">{tx(locale, "Acknowledgment link", "Enlace de acuse")}: {appUrl()}/ack/{report.ackToken}</p>}
            <p className="text-sm">{report.acknowledgedAt ? `${tx(locale, "Acknowledged by", "Acusado por")} ${report.ackName} · ${formatTimestamp(report.acknowledgedAt, locale)}` : tx(locale, "Not acknowledged yet.", "Aún sin acuse.")}</p>
            <a className="text-sm underline" href={`/api/condition/${report.id}/pdf`}>{tx(locale, "Download PDF", "Descargar PDF")}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
