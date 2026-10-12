import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="serif text-3xl text-pine">Rent Right</Link>
      <h1 className="mt-4 text-4xl">Privacy notice (draft)</h1>
      <p className="note-gold mt-4 text-sm">Draft for review. Rent Right does not sell or share personal information for cross-context advertising.</p>
      <div className="mt-4 space-y-3 text-sm leading-6">
        <p>We collect the account email, the unit and landlord contact you enter, files you upload, messages sent through the relay, and the records you type. We do not collect Social Security numbers or bank logins.</p>
        <p>Lease text and message bodies are encrypted before they are stored. Files are encrypted before they are written to disk or, if configured, to Cloudflare R2. Connections use HTTPS in production. The hosted database design uses row-level security so a tenant sees only their units. Roommates see a unit only after an invite.</p>
        <p>If an AI key is set, lease text sent to the model is redacted for email addresses, phone numbers, and SSN-like strings. Use a paid Gemini project so prompts are not used to train models. The shown answer still has to cite a library rule ID or say unsure.</p>
        <p>You can download a JSON copy of your data and delete the account from Settings. If you are the only member of a unit, unit records and files are deleted. Shared records remain while a roommate keeps the unit. Backup deletion on a hosted database has to follow that host&apos;s backup schedule.</p>
        <p>California residents can ask to know, delete, and correct personal information, and to opt out of sale or sharing. Sale and sharing are off by design. Contact the address you configure as the privacy contact before launch.</p>
      </div>
    </main>
  );
}
