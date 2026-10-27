import { formatAddressLines } from "@/lib/address-format";
import type { Locale } from "@/lib/disclaimer";
import { tx } from "@/lib/text";

export type MailPerson = { name: string; locale: Locale };
export type MailPlace = { street: string; unitNumber: string; city: string; region: string; postalCode: string };

export type TenantMail = {
  ready: true;
  name: string;
  line1: string;
  line2: string;
  subject: string;
};

export type TenantMailGap = {
  ready: false;
  missing: string;
  name: "";
  line1: "";
  line2: "";
  subject: "";
};

const GENERIC_SUBJECT = /^(message from your tenant|mensaje de su inquilino)$/i;

export function describeTenantMail(user: MailPerson, unit: MailPlace): TenantMail | TenantMailGap {
  const name = displayName(user.name);
  const [line1, line2] = formatAddressLines({
    street: unit.street,
    unit: unit.unitNumber,
    city: unit.city,
    region: unit.region,
    postalCode: unit.postalCode,
  });
  const missingName = !name;
  const missingAddress = !clean(unit.street) || !clean(unit.city) || !clean(unit.postalCode);
  if (missingName || missingAddress) {
    return { ready: false, missing: missingMessage(user.locale, missingName, missingAddress), name: "", line1: "", line2: "", subject: "" };
  }
  return {
    ready: true,
    name,
    line1,
    line2,
    subject: tx(user.locale, `Message from ${name}, ${line1}`, `Mensaje de ${name}, ${line1}`),
  };
}

export function requireTenantMail(user: MailPerson, unit: MailPlace): TenantMail {
  const described = describeTenantMail(user, unit);
  if (!described.ready) throw new Error(described.missing);
  return described;
}

/** A repair subject stays. An empty or generic subject uses the tenant's name and street. */
export function outboundSubject(requested: string, mail: TenantMail): string {
  const subject = requested.trim();
  if (!subject || GENERIC_SUBJECT.test(subject)) return mail.subject;
  return subject;
}

export function mailHeader(mail: TenantMail): string {
  return [mail.name, mail.line1, mail.line2].join("\n");
}

export function asksForTenantName(value: string): boolean {
  return /add your name in settings|agregue su nombre en ajustes/i.test(value);
}

/** A stored card keeps the old prompt until the profile name exists. Refresh it from the profile. */
export function senderForCard(user: MailPerson, unit: MailPlace, sender?: string): string | undefined {
  if (!sender || !asksForTenantName(sender)) return sender;
  const mail = describeTenantMail(user, unit);
  return mail.ready ? mailHeader(mail) : mail.missing;
}

export const REPLY_LINE = "Reply to this email or tap Respond.";

function displayName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function clean(value: string): string {
  return value.trim();
}

function missingMessage(locale: Locale, missingName: boolean, missingAddress: boolean): string {
  if (missingName && missingAddress) {
    return tx(
      locale,
      "Add your name in Settings, and the street, city, and ZIP for this home, before sending.",
      "Agregue su nombre en Ajustes, y la calle, la ciudad y el código postal de esta vivienda, antes de enviar.",
    );
  }
  if (missingName) return tx(locale, "Add your name in Settings before sending.", "Agregue su nombre en Ajustes antes de enviar.");
  return tx(locale, "Add the street, city, and ZIP for this home before sending.", "Agregue la calle, la ciudad y el código postal de esta vivienda antes de enviar.");
}
