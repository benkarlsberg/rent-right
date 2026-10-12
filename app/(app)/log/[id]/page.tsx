import Link from "next/link";
import { notFound } from "next/navigation";
import { resendLogEmail } from "@/lib/actions";
import { Disclaimer } from "@/components/ui";
import { getLog, listLogHistory } from "@/lib/db";
import { formatTimestamp } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function LogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await currentUser())!;
  const { id } = await params;
  const locale = user.locale;
  let entry;
  try { entry = getLog(user.id, id); } catch { notFound(); }
  const history = listLogHistory(user.id, entry.unitId).filter((item) => item.versionGroup === entry.versionGroup);
  const retaliation = entry.flags.retaliation as { flagged?: boolean; explanation?: string; explanationEs?: string; ruleId?: string } | undefined;
  const entryCheck = entry.flags.entry as { atLeast24?: boolean; explanation?: string; explanationEs?: string; ruleId?: string } | undefined;
  return (
    <article className="max-w-2xl">
      <p className="text-sm text-mute">{entry.eventDate} · {entry.type} · {tx(locale, "stored", "guardado")} {formatTimestamp(entry.createdAt, locale)}</p>
      <h1 className="mt-1 text-4xl">{tx(locale, "Log entry", "Entrada")}</h1>
      <p className="mt-4 whitespace-pre-wrap">{entry.description}</p>
      {entry.photoFileId && <p className="photo mt-3"><a className="underline" href={`/api/files/${entry.photoFileId}`}>{tx(locale, "Open photo", "Abrir foto")}</a></p>}
      {retaliation?.flagged && <aside className="note-clay mt-4" role="note"><p>{locale === "es" ? retaliation.explanationEs : retaliation.explanation}</p><p className="mt-1 text-sm">Rule ID: {retaliation.ruleId}</p></aside>}
      {entryCheck && <aside className="note-pine mt-4" role="note"><p>{locale === "es" ? entryCheck.explanationEs : entryCheck.explanation}</p><p className="mt-1 text-sm">Rule ID: {entryCheck.ruleId}</p></aside>}
      <dl className="mt-4 text-sm">
        <dt className="font-semibold">{tx(locale, "Hash", "Resumen")}</dt><dd className="break-all font-mono">{entry.contentHash}</dd>
        <dt className="mt-2 font-semibold">{tx(locale, "Previous hash", "Resumen anterior")}</dt><dd className="break-all font-mono">{entry.prevHash}</dd>
      </dl>
      {history.length > 1 && (
        <section className="mt-4">
          <h2 className="text-2xl">{tx(locale, "Earlier versions", "Versiones anteriores")}</h2>
          <ul className="mt-2 space-y-2 text-sm">{history.map((item) => <li key={item.id}>v{item.version} · {item.contentHash.slice(0, 12)} · {item.description.slice(0, 80)}</li>)}</ul>
        </section>
      )}
      <form action={resendLogEmail} className="mt-4">
        <input type="hidden" name="logId" value={entry.id} />
        <button className="btn btn-ghost" type="submit">{tx(locale, "Email this text to the landlord", "Enviar este texto al propietario")}</button>
      </form>
      <p className="mt-3 text-sm"><Link className="underline" href={`/letters?log=${entry.id}`}>{tx(locale, "Print a letter to mail yourself", "Imprimir una carta para enviarla usted")}</Link></p>
      <div className="mt-4"><Disclaimer locale={locale} /></div>
    </article>
  );
}
