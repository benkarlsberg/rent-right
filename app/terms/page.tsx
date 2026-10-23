import { Logo } from "@/components/logo";

export default function TermsPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10">
      <Logo />
      <h1 className="mt-4 text-4xl">Terms of use (draft)</h1>
      <p className="note-gold mt-4 text-sm">Draft for clinic review. Not a final terms of service. California limits some waivers, including waivers of public injunctive relief.</p>
      <div className="mt-4 space-y-3 text-sm leading-6">
        <p>Rent Right gives general legal information, record-keeping tools, and templates a tenant fills in and sends. It is not a law firm. No attorney-client relationship is created.</p>
        <p>Lease flags, deadline math, and rights answers quote a rules-library entry or say unsure. The library is a placeholder pending review by a law-school clinic or legal aid partner. Laws change and depend on facts.</p>
        <p>Demand letters and mailed notices are completed and sent by the tenant. Rent Right does not send legal demands and does not text landlords.</p>
        <p>Evidence packets are factual compilations of the tenant&apos;s own records. They are not legal analysis.</p>
        <p>To the extent a cap is allowed, liability for use of the free service is limited to the greater of fees paid for the service in the prior 12 months or $100. The service is free, so that figure is $100. Disputes are intended to go to individual arbitration, with a class-action waiver. These terms may be unenforceable in part under California law and must be reviewed before launch.</p>
        <p>There are no landlord ratings, no paid referrals, and no sale of personal information in this version.</p>
      </div>
    </main>
  );
}
