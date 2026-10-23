import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";

export default async function OpenPage({ searchParams }: { searchParams: Promise<{ error?: string; session?: string; invite?: string; handoff?: string }> }) {
  const params = await searchParams;
  const handoff = params.handoff === "1";
  if (params.error && /invalid or expired/i.test(params.error)) redirect("/auth/expired");
  if (params.session && !handoff) {
    redirect(`/?session=${encodeURIComponent(params.session)}`);
  }
  const continueHref = params.session ? `/?session=${encodeURIComponent(params.session)}` : "/";
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-16">
      <Logo />
      <h1 className="mt-4 text-3xl">{params.session ? "You're signed in" : "Continue in the browser"}</h1>
      <a className="btn btn-primary mt-6" href={continueHref}>Continue in browser</a>
      {params.session ? <meta httpEquiv="refresh" content={`0;url=${continueHref}`} /> : null}
      {params.error ? <p className="note-clay mt-4" role="alert">{params.error}</p> : null}
      {params.invite ? <p className="mt-4 text-sm">Roommate code: {params.invite}</p> : null}
      {params.session && handoff ? (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-mute">Open the phone app instead</summary>
          <p className="mt-3 text-sm">Paste this code on the welcome screen.</p>
          <p className="card mt-3 break-all p-4 text-xs">{params.session}</p>
        </details>
      ) : null}
    </main>
  );
}
