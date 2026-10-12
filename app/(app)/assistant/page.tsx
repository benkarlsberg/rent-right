import { ask } from "@/lib/actions";
import { Alert, ClinicNote, Disclaimer } from "@/components/ui";
import { listAssistant, primaryUnit } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = (await currentUser())!;
  const unit = primaryUnit(user.id);
  const locale = user.locale;
  const params = await searchParams;
  const messages = listAssistant(user.id);
  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl">{tx(locale, "Rights assistant", "Asistente de derechos")}</h1>
      <p className="mt-2 text-sm text-mute">{tx(locale, "Answers are the library text for a rule ID, or unsure. Spanish library text is pending volunteer review. This is not a place to plan a case.", "Las respuestas son el texto de la biblioteca para un ID de regla, o no se puede precisar. El texto en español está pendiente de revisión voluntaria. Aquí no se planea un caso.")}</p>
      <div className="mt-3 space-y-3"><Alert locale={locale} error={params.error} /><ClinicNote locale={locale} /></div>
      <div className="mt-4 space-y-3">
        {messages.map((message, index) => (
          <article key={`${message.created_at}-${index}`} className={message.role === "user" ? "card p-4" : "note-gold"}>
            <p className="text-xs font-semibold uppercase">{message.role === "user" ? tx(locale, "You", "Usted") : tx(locale, "Library", "Biblioteca")}</p>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-sm">{message.content}</pre>
          </article>
        ))}
      </div>
      <form action={ask} className="card mt-4 p-5">
        <label htmlFor="question">{tx(locale, "Question", "Pregunta")}</label>
        <textarea id="question" name="question" required placeholder={locale === "es" ? "¿Cuándo deben devolverme el depósito?" : "How long does the landlord have to return a deposit?"} />
        <button className="btn btn-primary mt-3" type="submit">{tx(locale, "Ask the library", "Preguntar a la biblioteca")}</button>
      </form>
      {!unit && null}
      <div className="mt-4"><Disclaimer locale={locale} /></div>
    </div>
  );
}
