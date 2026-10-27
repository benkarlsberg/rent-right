import { aiConfigured, completeJson } from "@/lib/ai";
import { intentPrompt } from "@/lib/chat-text";
import { isResolvedClaim } from "@/lib/resolution";
import type { RepairSeverity } from "@/lib/rules/engine";

export type { RepairSeverity };

export type ChatIntent = "repair" | "lease" | "rent" | "deposit" | "packet" | "deadlines" | "confirm" | "letter" | "rights" | "unclear";

export type PendingKind = "repair" | "rent_date" | "deposit_date" | "letter" | null;

export type TurnPlan =
  | { type: "confirm_send" }
  | { type: "repair"; severity: RepairSeverity; room: string | null; summary: string }
  | { type: "repair_prompt" }
  | { type: "lease" }
  | { type: "rent"; lowestCents: number | null; proposedCents: number | null; effectiveDate: string | null; noticeDate: string | null }
  | { type: "deposit"; moveOutDate: string | null }
  | { type: "packet" }
  | { type: "deadlines" }
  | { type: "letter_text"; text: string }
  | { type: "continue_date"; date: string }
  | { type: "resolve_issue"; summary: string }
  | { type: "rights" }
  | { type: "unclear" };

const INTENTS = ["repair", "lease", "rent", "deposit", "packet", "deadlines", "rights", "unclear"] as const;

const REPAIR = /\b(leak|leaking|drip|dripping|sink|mold|mould|pests?|roaches?|rats?|mice|bed bugs?|heater|heat|heating|furnace|hot water|shower|repair|broken|faucet|toilet|water|electricity|power|gas|locks?|clogged|smoke detector|sewage|sewer|flood|flooding|window|wiring|monoxide|monoxido|fire|hazard|incendio|chispas|ventana|inundacion|alcantarill|gotera|fregadero|filtra|filtrando|moho|plaga|cucarachas?|calefaccion|calentador|agua caliente|regadera|ducha|cerradura|fuga|agua|luz|puerta|inodoro|request a fix|request a repair|like to request a fix|like to ask for a fix|arreglar|arreglo|reparar|reparacion)\b/;
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
  if (/gas leak|fuga de gas|gas smell|smell of gas|smells like gas|smell gas|huele a gas|olor a gas|olor de gas/.test(value)) severity = "gas_leak";
  else if (/carbon monoxide|monoxido de carbono|co alarm|alarma de monoxido|\bco detector\b/.test(value)) severity = "co_alarm";
  else if (/fire hazard|on fire|electrical fire|peligro de incendio|riesgo de incendio/.test(value)) severity = "fire";
  else if (/exposed wir|sparking|cable expuesto|cables expuestos|chispas en/.test(value)) severity = "wiring";
  else if (/sewage|sewer backup|sewer|aguas negras|alcantarill/.test(value)) severity = "sewage";
  else if (/\bflood(?:ing|ed)?\b|inundacion|se inunda/.test(value)) severity = "flood";
  else if (/no working toilet|toilet (?:does not|doesn t|won t|will not) (?:work|flush)|no toilet|inodoro no funciona|no funciona el inodoro|sin inodoro|el inodoro no sirve/.test(value)) severity = "no_toilet";
  else if (/exterior door|broken (?:exterior )?lock|door (?:won t|will not|does not|doesn t|cannot|can t) (?:lock|latch|close)|cannot lock|can t lock the door|puerta exterior|cerradura rota|la cerradura no funciona|no puedo cerrar la puerta/.test(value)) severity = "door";
  else if (/broken window|window (?:is |was )?broken|shattered window|ventana rota|ventana quebrada|se rompio la ventana/.test(value)) severity = "window";
  else if (/no heat|not heating|isn.t heating|no heater|heater|furnace|hot water|no hot water|sin calefaccion|calentador|agua caliente/.test(value)) severity = "no_heat";
  else if (/no water|sin agua/.test(value)) severity = "no_water";
  else if (/no electricity|no power|sin luz/.test(value)) severity = "no_electricity";
  else if (/\b(mold|mould|moho)\b/.test(value)) severity = "mold";
  else if (/\b(pests?|roaches?|rats?|mice|bed bugs?|plaga|cucarachas?)\b/.test(value)) severity = "pests";
  else if (/\b(leak|leaking|drip|dripping|sink|faucet|toilet|gotera|fregadero|filtra|filtrando|fuga|clogged)\b/.test(value)) severity = "leak";

  let room: string | null = null;
  if (/\b(kitchen|cocina)\b/.test(value)) room = "Kitchen";
  else if (/\b(bath|bathroom|bano|shower|regadera|ducha)\b/.test(value)) room = "Bathroom";
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

/** A request to start a repair, with no broken thing named yet. */
export function isBareRepairAsk(text: string): boolean {
  const value = fold(text);
  return /^(?:i (?:need|want|would like|d like) to )?(?:request|ask for) a (?:repair|fix)$|^(?:quiero |necesito )?(?:solicitar|pedir) una reparacion$/.test(value);
}

export function rentDates(text: string): { effectiveDate: string | null; noticeDate: string | null } {
  const notice = text.match(/(?:notice|noticed|aviso|notified)\D{0,40}(20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))/i);
  const effective = text.match(/(?:starting|starts|effective|empiez\w*|a partir)\D{0,40}(20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))/i);
  const all = [...text.matchAll(/\b(20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/g)].map((match) => match[1]);
  let noticeDate = notice?.[1] || null;
  let effectiveDate = effective?.[1] || null;
  if (!noticeDate && !effectiveDate && all.length === 1) effectiveDate = all[0];
  else if (!noticeDate && !effectiveDate && all.length >= 2) {
    noticeDate = all[0];
    effectiveDate = all[1];
  }
  return { effectiveDate, noticeDate };
}

export function planFromIntent(intent: ChatIntent, text: string): TurnPlan {
  if (intent === "confirm") return { type: "confirm_send" };
  if (intent === "repair") {
    if (isBareRepairAsk(text)) return { type: "repair_prompt" };
    const facts = repairFacts(text);
    return { type: "repair", ...facts, summary: text.trim() };
  }
  if (intent === "lease") return { type: "lease" };
  if (intent === "rent") {
    const cents = moneyCents(text);
    const dates = rentDates(text);
    if (cents.length >= 2) return { type: "rent", lowestCents: cents[0], proposedCents: cents[1], ...dates };
    return { type: "rent", lowestCents: null, proposedCents: cents[0] ?? null, ...dates };
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
  if (isResolvedClaim(trimmed)) return { type: "resolve_issue", summary: trimmed };
  if (pending === "repair" && isConfirm(trimmed)) return { type: "confirm_send" };
  if (isConfirm(trimmed)) return { type: "unclear" };
  const changed = switchedPlan(trimmed);
  if (changed) return changed;
  const date = extractDate(trimmed);
  if (pending === "rent_date" || pending === "deposit_date") {
    const intent = detectIntent(trimmed, null);
    const stays = intent === "unclear" || intent === "rights" || (pending === "rent_date" && intent === "rent") || (pending === "deposit_date" && intent === "deposit");
    const richerRent = pending === "rent_date" && (moneyCents(trimmed).length > 0 || /\b(notice|aviso|starting|effective)\b/.test(fold(trimmed)));
    if (date && stays && !richerRent) return { type: "continue_date", date };
  }
  const intent = detectIntent(trimmed, pending);
  if (pending === "letter" && (intent === "unclear" || intent === "rights") && fold(trimmed).length >= 20) {
    return { type: "letter_text", text: trimmed };
  }
  return planFromIntent(intent, trimmed);
}

export async function resolveIntent(text: string, pending: PendingKind, history = ""): Promise<ChatIntent> {
  const detected = detectIntent(text, pending);
  if (detected !== "rights" && detected !== "unclear") return detected;
  if (!aiConfigured()) return detected;
  const completed = await completeJson("lite", intentPrompt(history, text));
  const intent = (completed?.json as { intent?: string } | undefined)?.intent;
  if (intent && (INTENTS as readonly string[]).includes(intent)) return intent as ChatIntent;
  return detected;
}
