import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-16">
      <Logo />
      <h1 className="mt-4 text-4xl">That page is not here.</h1>
      <Link className="btn btn-primary mt-4" href="/">Back to Rent Right</Link>
    </main>
  );
}
