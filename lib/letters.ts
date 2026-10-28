import { DISCLAIMER_EN } from "@/lib/disclaimer";
import { formatMoney } from "@/lib/format";

export type DemandInput = {
  tenantName: string;
  unitAddress: string;
  landlordName: string;
  landlordEmail: string;
  depositCents: number;
  moveOutDate: string;
  dueDate: string;
  forwardingAddress: string;
  deductionNotes: string;
  disputeNotes: string;
  letterDate: string;
};

function addressLines(value: string): string[] {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

export function demandLetter(input: DemandInput): string {
  if (input.disputeNotes.trim().length < 20) {
    throw new Error("Write at least a short explanation in your own words before downloading the letter.");
  }
  const amount = formatMoney(input.depositCents, "en");
  const lines = addressLines(input.unitAddress);
  return [
    input.letterDate,
    "",
    input.landlordName,
    input.landlordEmail || "[landlord mailing address]",
    "",
    `Re: Security deposit for ${lines.join(", ")}`,
    "",
    `${input.landlordName}:`,
    "",
    `I moved out on ${input.moveOutDate}. I paid a security deposit of ${amount}. My forwarding address is ${input.forwardingAddress}.`,
    "",
    `Civil Code section 1950.5 requires an itemized statement of lawful deductions and return of the remaining deposit within 21 calendar days after move-out. That date, counted from the move-out date above, is ${input.dueDate}.`,
    "",
    input.deductionNotes.trim()
      ? `What I received about deductions: ${input.deductionNotes.trim()}`
      : "I have not received an itemized statement of deductions.",
    "",
    `What I am asking, in my own words: ${input.disputeNotes.trim()}`,
    "",
    "Please mail the remaining deposit and any itemized statement to the forwarding address above.",
    "",
    input.tenantName,
    ...lines,
    "",
    "I filled in this letter and I am sending it myself. Rent Right did not send it and is not my lawyer.",
    "",
    DISCLAIMER_EN,
    "Sent with Rent Right, free for renters.",
  ].join("\n");
}

export function certifiedMailLetter(input: {
  letterDate: string;
  tenantName: string;
  unitAddress: string;
  landlordName: string;
  landlordEmail: string;
  subject: string;
  body: string;
  logId: string;
  contentHash: string;
}): string {
  return [
    input.letterDate,
    "",
    input.landlordName,
    input.landlordEmail || "[landlord mailing address]",
    "",
    `From: ${input.tenantName}`,
    ...addressLines(input.unitAddress),
    "",
    `Re: ${input.subject}`,
    `Log reference: ${input.logId}`,
    `Record hash: ${input.contentHash}`,
    "",
    input.body.trim(),
    "",
    input.tenantName,
    "",
    "The tenant prints and mails this letter. Rent Right does not mail it and does not send legal demands.",
    DISCLAIMER_EN,
    "Sent with Rent Right, free for renters.",
  ].join("\n");
}
