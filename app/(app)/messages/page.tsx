import { listMessages, primaryUnit } from "@/lib/db";
import { formatTimestamp } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { relayAddress, tx } from "@/lib/text";

export default async function MessagesPage() {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id)!;
  const locale = user.locale;
  const messages = listMessages(user.id, unit.id);
  return (
    <div>
      <h1 className="text-4xl">{tx(locale, "Landlord mail", "Correo con el propietario")}</h1>
      <p className="mt-2 text-sm text-mute">{tx(locale, "Sent from", "Enviado desde")} {relayAddress(unit.relayLocal)}. {tx(locale, "You are copied. Opens are indicative only.", "Usted va en copia. Las aperturas solo son indicativas.")}</p>
      <ol className="mt-4 space-y-3">
        {messages.length === 0 && <li className="card p-5 text-mute">{tx(locale, "No messages yet.", "Aún no hay mensajes.")}</li>}
        {messages.map((message) => (
          <li key={message.id} className="card p-4">
            <p className="text-sm font-semibold">{formatTimestamp(message.createdAt, locale)} · {message.direction} · {message.deliveryStatus}{message.openIndicative ? " · open (indicative)" : ""}</p>
            <p className="text-sm text-mute">{message.fromEmail} → {message.toEmail}{message.ccEmail ? ` · cc ${message.ccEmail}` : ""}</p>
            <p className="mt-1 font-semibold">{message.subject}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{message.body}</pre>
            {message.deliveryDetail && <p className="mt-2 text-xs text-mute">{message.deliveryDetail}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
