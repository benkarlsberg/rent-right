import Link from "next/link";

export function Logo({ height = 64 }: { height?: number }) {
  return (
    <Link href="/" className="inline-flex">
      <img src="/brand/logo.svg" alt="Rent Right" style={{ height, width: "auto" }} />
    </Link>
  );
}
