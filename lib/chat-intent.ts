import { aiConfigured, completeJson } from "@/lib/ai";

export type ChatIntent = "repair" | "lease" | "rent" | "deposit" | "packet" | "deadlines" | "confirm" | "letter" | "rights" | "unclear";

export type PendingKind = "repair" | "rent_date" | "deposit_date" | "letter" | null;

export type RepairSeverity = "no_heat" | "no_water" | "no_electricity" | "gas_leak" | "leak" | "mold" | "pests" | "other";

export type TurnPlan =
  | { type: "confirm_send" }
  | { type: "repair"; severity: RepairSeverity; room: string | null; summary: string }
  | { type: "lease" }
  | { type: "rent"; lowestCents: number | null; proposedCents: number | null; effectiveDate: string | null }
  | { type: "deposit"; moveOutDate: string | null }
  | { type: "packet" }
  | { type: "deadlines" }
  | { type: "letter_text"; text: string }
  | { type: "continue_date"; date: string }
  | { type: "rights" }
  | { type: "unclear" };

const INTENTS = ["repair", "lease", "rent", "deposit", "packet", "deadlines", "rights", "unclear"] as const;

const REPAIR = /\b(leak|leaking|drip|dripping|sink|mold|mould|pest|roach|heater|heat|repair|broken|faucet|toilet|water|electricity|power|gas|gotera|fregadero|filtra|filtrando|moho|plaga|cucaracha|calefaccion|fuga|agua|luz|request a fix|request a repair|like to request a fix|like to ask for a fix|arreglar|arreglo|reparar|reparacion)\b/;
const RENT = /\b(rent increase|raised rent|raise rent|raising rent|new rent|aumento|subio el alquiler|subio la renta|aumento de renta)\b/;
const DEPOSIT = /\b(deposit|security deposit|deposito|moved out|move out|moving out|me mude)\b/;
const LEASE = /\b(lease|contrato|rental agreement)\b/;
const PACKET = /\b(evidence packet|packet|expediente|export my records|download my records)\b/;
const DEADLINE = /\b(deadline|deadlines|whats due|when is it due|fechas|vencimiento)\b/;

export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9$,. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isConfirm(text: string): boolean {
  return /^(yes[, ]+)?(please[, ]+)?(send( it| this| the email| to( my)? landlord)?|si[, ]+envialo|envialo)$/.test(fold(text));
}

export function extractDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/);
  if (iso) return iso[1];
  if (/\b(today|hoy)\b/.test(fold(text))) return "today";
  return null;
}

export function moneyCents(text: string): number[] {
  const values: number[] = [];
  const add = (dollars: string, cents: string | undefined) => {
    const whole = Number(dollars.replace(/,/g, ""));
    const fraction = cents ? Number(cents) : 0;
    if (!Number.isFinite(whole) || whole < 0 || whole > 1_000_000) return;
    values.push(whole * 100 + fraction);
  };
  const money = /\$\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?/g;
  for (const match of text.matchAll(money)) add(match[1], match[2]);
  const words = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?\s*dollars/gi;
  for (const match of text.matchAll(words)) add(match[1], match[2]);
  return values;
}

export function repairFacts(text: string): { severity: RepairSeverity; room: string | null } {
  const value = fold(text);
  let severity: RepairSeverity = "other";
  if (/gas leak|fuga de gas|smells like gas|huele a gas/.test(value)) severity = "gas_leak";
  else if (/no heat|no heater|sin calefaccion/.test(value)) severity = "no_heat";
  else if (/no water|sin agua|no hot water/.test(value)) severity = "no_water";
  else if (/no electricity|no power|sin luz/.test(value)) severity = "no_electricity";
  else if (/\b(mold|mould|moho)\b/.test(value)) severity = "mold";
  else if (/\b(pest|roach|plaga|cucaracha)\b/.test(value)) severity = "pests";
  else if (/\b(leak|leaking|drip|dripping|sink|faucet|toilet|gotera|fregadero|filtra|filtrando|fuga)\b/.test(value)) severity = "leak";

  let room: string | null = null;
  if (/\b(kitchen|cocina)\b/.test(value)) room = "Kitchen";
  else if (/\b(bath|bathroom|bano)\b/.test(value)) room = "Bathroom";
  else if (/\b(bed|bedroom|recamara)\b/.test(value)) room = "Bedroom";
  else if (/\b(living|sala)\b/.test(value)) room = "Living room";
  return { severity, room };
}

export function detectIntent(text: string, pending: PendingKind): ChatIntent {
  const value = fold(text);
  if (!value) return "unclear";
  if (pending === "repair" && isConfirm(text)) return "confirm";
  const amounts = moneyCents(text);
  const repair = REPAIR.test(value);
  const rent = RENT.test(value) || (amounts.length > 0 && /\$|dollars|rent|alquiler|renta/.test(value));
  if (repair && !(rent && amounts.length > 0)) return "repair";
  if (rent) return "rent";
  if (DEPOSIT.test(value)) return "deposit";
  if (LEASE.test(value)) return "lease";
  if (PACKET.test(value)) return "packet";
  if (DEADLINE.test(value)) return "deadlines";
  if (value.length < 12) return "unclear";
  return "rights";
}

export function planFromIntent(intent: ChatIntent, text: string): TurnPlan {
  if (intent === "confirm") return { type: "confirm_send" };
  if (intent === "repair") {
    const facts = repairFacts(text);
    return { type: "repair", ...facts, summary: text.trim() };
  }
  if (intent === "lease") return { type: "lease" };
  if (intent === "rent") {
    const cents = moneyCents(text);
    const date = extractDate(text);
    if (cents.length >= 2) return { type: "rent", lowestCents: cents[0], proposedCents: cents[1], effectiveDate: date };
    return { type: "rent", lowestCents: null, proposedCents: cents[0] ?? null, effectiveDate: date };
  }
  if (intent === "deposit") return { type: "deposit", moveOutDate: extractDate(text) };
  if (intent === "packet") return { type: "packet" };
  if (intent === "deadlines") return { type: "deadlines" };
  if (intent === "letter") return { type: "letter_text", text: text.trim() };
  if (intent === "rights") return { type: "rights" };
  return { type: "unclear" };
}

const HARD_SWITCH = /^(never\s*mind|start over|forget (?:it|that)|olv[ií]dalo|empezar de nuevo)\b[,.\s]*/i;
const SOFT_SWITCH = /^(actually|instead)\b[,.\s]*/i;

export function leadingSwitch(text: string): { kind: "hard" | "soft" | null; rest: string } {
  const trimmed = text.trim();
  const hard = trimmed.match(HARD_SWITCH);
  if (hard) return { kind: "hard", rest: trimmed.slice(hard[0].length).trim() };
  const soft = trimmed.match(SOFT_SWITCH);
  if (soft) return { kind: "soft", rest: trimmed.slice(soft[0].length).trim() };
  return { kind: null, rest: trimmed };
}

function switchedPlan(text: string): TurnPlan | null {
  const switched = leadingSwitch(text);
  if (!switched.kind) return null;
  if (!switched.rest) return { type: "unclear" };
  const intent = detectIntent(switched.rest, null);
  if (intent !== "rights" && intent !== "unclear" && intent !== "confirm") return planFromIntent(intent, switched.rest);
  if (switched.kind === "hard") return { type: "unclear" };
  return null;
}

export function planTurn(text: string, pending: PendingKind): TurnPlan {
  const trimmed = text.trim();
  if (pending === "repair" && isConfirm(trimmed)) return { type: "confirm_send" };
  if (isConfirm(trimmed)) return { type: "unclear" };
  const changed = switchedPlan(trimmed);
  if (changed) return changed;
  const date = extractDate(trimmed);
  if (pending === "rent_date" || pending === "deposit_date") {
    const intent = detectIntent(trimmed, null);
    const stays = intent === "unclear" || intent === "rights" || (pending === "rent_date" && intent === "rent") || (pending === "deposit_date" && intent === "deposit");
    if (date && stays) return { type: "continue_date", date };
  }
  const intent = detectIntent(trimmed, pending);
  if (pending === "letter" && (intent === "unclear" || intent === "rights") && fold(trimmed).length >= 20) {
    return { type: "letter_text", text: trimmed };
  }
  return planFromIntent(intent, trimmed);
}

export async function resolveIntent(text: string, pending: PendingKind): Promise<ChatIntent> {
  const detected = detectIntent(text, pending);
  if (detected !== "rights" && detected !== "unclear") return detected;
  if (!aiConfigured()) return detected;
  const completed = await completeJson(
    "lite",
    `Choose one intent for this tenant message. Reply JSON {"intent":"repair"} or lease, rent, deposit, packet, deadlines, rights, or unclear. Do not include numbers, dates, or advice.\nMessage: ${text.slice(0, 500)}`,
  );
  const intent = (completed?.json as { intent?: string } | undefined)?.intent;
  if (intent && (INTENTS as readonly string[]).includes(intent)) return intent as ChatIntent;
  return detected;
}
