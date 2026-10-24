import type { Locale } from "@/lib/disclaimer";
import { tx } from "@/lib/text";

export function landlordReady(unit: { landlordName?: string | null; landlordEmail?: string | null } | null | undefined): boolean {
  if (!unit) return false;
  const name = (unit.landlordName || "").trim();
  const email = (unit.landlordEmail || "").trim();
  return name.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function landlordPrompt(locale: Locale): string {
  return tx(
    locale,
    "Add your landlord's name and email to send a message.",
    "Agregue el nombre y el correo del propietario para enviar un mensaje.",
  );
}

export function addLandlordLabel(locale: Locale): string {
  return tx(locale, "Add landlord", "Agregar propietario");
}
