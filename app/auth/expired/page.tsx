import { Logo } from "@/components/logo";
import { ExpiredForm } from "./form";

export default async function ExpiredLinkPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const detail = params.error?.slice(0, 300) || "";
  const friendly = !detail || /invalid or expired/i.test(detail);
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-16">
      <Logo />
      <h1 className="mt-6 text-2xl leading-snug">
        {friendly ? "This link has expired, enter your email to get a new one" : "Enter your email to get a new one"}
      </h1>
      {friendly ? null : <p className="note-clay mt-4" role="alert">{detail}</p>}
      <ExpiredForm />
    </main>
  );
}
