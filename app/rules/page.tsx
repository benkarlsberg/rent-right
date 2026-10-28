import { Logo } from "@/components/logo";
import { ClinicNote, Disclaimer } from "@/components/ui";
import { LIBRARY_VERSION } from "@/lib/disclaimer";
import { RULES } from "@/lib/rules/library";
import { readLocale } from "@/lib/session";
import { tx } from "@/lib/text";

export default async function RulesPage() {
  const locale = await readLocale();
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-8">
      <Logo />
      <h1 className="mt-4 text-4xl">{tx(locale, "Rules library", "Biblioteca de reglas")} {LIBRARY_VERSION}</h1>
      <div className="mt-4 space-y-3"><ClinicNote locale={locale} /><Disclaimer locale={locale} /></div>
      <div className="mt-6 space-y-4">
        {RULES.map((rule) => (
          <article key={rule.id} className="card p-4">
            <p className="pill">{rule.placeholder ? tx(locale, "General information based on California law, checked Oct 12, 2026. Not legal advice.", "Información general basada en la ley de California, revisada el 12 de octubre de 2026. No es asesoramiento legal.") : ""}</p>
            <h2 className="mt-2 text-2xl">{locale === "es" ? rule.titleEs : rule.titleEn}</h2>
            <p className="text-sm font-semibold">{rule.id} · {rule.jurisdiction} · {rule.citation}</p>
            <p className="mt-2 text-sm">{locale === "es" ? rule.summaryEs : rule.summaryEn}</p>
            <p className="mt-2 text-xs text-mute">{rule.sourceName} · <a className="underline" href={rule.sourceUrl}>{rule.sourceUrl}</a></p>
            <p className="text-xs text-mute">{tx(locale, "Spanish text", "Texto en español")}: {rule.spanishReview}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
