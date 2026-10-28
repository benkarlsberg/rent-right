import type { Locale } from "@/lib/disclaimer";
import { tx } from "@/lib/text";

export function inviteLetter(input: { name: string; link: string; locale: Locale }): { subject: string; text: string } {
  const name = input.name.trim() || tx(input.locale, "A roommate", "Un compañero de vivienda");
  return {
    subject: tx(input.locale, "Rent Right: Join a home", "Rent Right: Unirse a una vivienda"),
    text: [
      tx(input.locale, `${name} invited you to a home on Rent Right.`, `${name} lo invitó a una vivienda en Rent Right.`),
      "",
      tx(input.locale, `Open this link to join: ${input.link}`, `Abra este enlace para unirse: ${input.link}`),
      "",
      tx(input.locale, "The link works for 14 days. Nothing is sent to the landlord.", "El enlace funciona por 14 días. No se envía nada al propietario."),
      "",
      tx(input.locale, "General information, not legal advice.", "Información general, no es asesoramiento legal."),
    ].join("\n"),
  };
}
