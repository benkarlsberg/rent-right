import Link from "next/link";
import { Logo } from "@/components/logo";

export default function LandingPage() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <Logo height={72} />
      <p className="mt-3 text-lg">Free for California renters.</p>
      <p className="mt-6 text-mute">The app is on your phone. This server keeps the records, the rules library, and landlord email.</p>
      <div className="mt-8 flex gap-4 text-sm">
        <Link className="underline" href="/terms">Terms</Link>
        <Link className="underline" href="/privacy">Privacy</Link>
        <Link className="underline" href="/rules">Rules library</Link>
      </div>
    </main>
  );
}
