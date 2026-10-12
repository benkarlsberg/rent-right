import { clinicBanner, disclaimer, type Locale } from "@/lib/disclaimer";
import { tx } from "@/lib/text";

const AID = [
  ["Stay Housed L.A.", "https://www.stayhousedla.org/"],
  ["Legal Aid Foundation of Los Angeles", "https://lafla.org/"],
  ["LA Housing Department", "https://housing.lacity.gov/"],
  ["LA County DCBA rent stabilization", "https://dcba.lacounty.gov/rentstabilizationprogram/"],
  ["Legal Aid Society of San Diego", "https://www.lassd.org/"],
  ["San Diego Housing Commission", "https://sdhc.org/housing-opportunities/tenant-protections/"],
  ["California Courts Self-Help", "https://selfhelp.courts.ca.gov/housing"],
];

export function LegalAid({ locale }: { locale: Locale }) {
  return (
    <p className="mt-2 text-sm">
      <span className="font-semibold">{tx(locale, "Free legal aid", "Asistencia legal gratuita")}: </span>
      {AID.map(([label, href], index) => (
        <span key={href}>
          {index > 0 ? " · " : ""}
          <a className="underline" href={href}>{label}</a>
        </span>
      ))}
    </p>
  );
}

export function Disclaimer({ locale }: { locale: Locale }) {
  return (
    <aside className="note-gold" role="note">
      <p className="kicker">{tx(locale, "General information", "Información general")}</p>
      <p className="mt-1">{disclaimer(locale)}</p>
      <LegalAid locale={locale} />
    </aside>
  );
}

export function ClinicNote({ locale }: { locale: Locale }) {
  return <p className="note-pine text-sm">{clinicBanner(locale)}</p>;
}

export function Alert({ error, saved, locale }: { error?: string; saved?: boolean; locale: Locale }) {
  if (error) return <p role="alert" className="note-clay">{error}</p>;
  if (saved) return <p role="status" className="note-pine">{tx(locale, "Saved.", "Guardado.")}</p>;
  return null;
}

export function findingPill(label: string, locale: Locale) {
  const map: Record<string, [string, string, string]> = {
    likely_unenforceable: ["Likely unenforceable", "Probablemente no exigible", "pill-bad"],
    check_this: ["Check this", "Revisar", "pill-warn"],
    looks_standard: ["Looks standard", "Parece común", "pill-ok"],
    unsure: ["Unsure", "No se puede precisar", "pill-mute"],
  };
  const item = map[label] || map.unsure;
  return <span className={`pill ${item[2]}`}>{locale === "es" ? item[1] : item[0]}</span>;
}
