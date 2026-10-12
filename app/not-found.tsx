import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-4xl">That page is not here.</h1>
      <Link className="btn btn-primary mt-4" href="/">Back to Rent Right</Link>
    </main>
  );
}
