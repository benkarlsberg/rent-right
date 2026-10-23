import Link from "next/link";
import { logoSvg } from "@/components/logo-svg";

const logoAspect = 7984 / 2088;

export function Logo({ height = 64 }: { height?: number }) {
  const width = Math.round(height * logoAspect);
  const markup = logoSvg
    .replace(' role="img"', "")
    .replace(' aria-label="Rent Right"', "")
    .replace("<svg ", `<svg width="${width}" height="${height}" aria-hidden="true" focusable="false" `);
  return (
    <Link href="/" className="inline-flex" aria-label="Rent Right">
      <span className="inline-flex leading-none" dangerouslySetInnerHTML={{ __html: markup }} />
    </Link>
  );
}
