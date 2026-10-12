import Link from "next/link";
import { listLogs, primaryUnit } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function LogPage() {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale = user.locale;
  const logs = listLogs(user.id, unit.id);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl">{tx(locale, "Request and notice log", "Registro de solicitudes y avisos")}</h1>
        <Link className="btn btn-primary" href="/log/new">{tx(locale, "New entry", "Nueva entrada")}</Link>
      </div>
      <p className="mt-2 text-sm text-mute">{tx(locale, "Each entry is hashed with the one before it. Edits are new versions. The old hash stays.", "Cada entrada se resume con la anterior. Una corrección es una versión nueva. El resumen anterior se queda.")}</p>
      <ul className="mt-4 space-y-3">
        {logs.length === 0 && <li className="card p-5 text-mute">{tx(locale, "Nothing logged yet.", "Aún no hay nada.")}</li>}
        {logs.map((entry) => (
          <li key={entry.id} className="card p-4">
            <Link href={`/log/${entry.id}`} className="font-semibold underline">{entry.eventDate} · {entry.type}{entry.room ? ` · ${entry.room}` : ""}</Link>
            <p className="mt-1 text-sm">{entry.description}</p>
            <p className="mt-1 font-mono text-xs text-mute">{entry.contentHash.slice(0, 16)}…</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
