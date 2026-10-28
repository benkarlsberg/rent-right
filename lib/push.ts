import type { Locale } from "@/lib/disclaimer";
import { dropExpoTokens, expoTokensForUsers } from "@/lib/db";
import { tx } from "@/lib/text";

const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";
const TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/;

export type PushData = { screen: "landlord" | "reminders" | "log"; id?: string };

export function isExpoPushToken(token: string): boolean {
  return TOKEN.test(token.trim());
}

export function landlordPushBody(subject: string, locale: Locale): string {
  const name = subject
    .replace(/^re:\s*/i, "")
    .replace(/^(repair request|solicitud de reparación):\s*/i, "")
    .replace(/^(the|a|an|el|la|los|las)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const short = name.length > 48 ? `${name.slice(0, 45).trim()}…` : name;
  const label = short ? short.charAt(0).toUpperCase() + short.slice(1) : "";
  if (!label) return tx(locale, "Your landlord replied", "Su propietario respondió");
  return tx(locale, `Your landlord replied about: ${label}`, `Su propietario respondió sobre: ${label}`);
}

export function reminderPushBody(issue: string, count: number, locale: Locale): string {
  if (count > 1) return tx(locale, `You have ${count} reminders`, `Tiene ${count} recordatorios`);
  const name = issue.replace(/^(the|a|an|el|la|los|las)\s+/i, "").replace(/\s+/g, " ").trim();
  const short = name.split(" ").slice(0, 4).join(" ");
  const clipped = short ? short.charAt(0).toUpperCase() + short.slice(1) : "";
  if (!clipped) return tx(locale, "A reminder is due", "Hay un recordatorio");
  return tx(locale, `Reminder: ${clipped}`, `Recordatorio: ${clipped}`);
}

type Ticket = { status?: string; details?: { error?: string } };

/** Tickets come back in the same order as the messages. */
export function unregisteredTokens(tokens: string[], tickets: Ticket[]): string[] {
  return tokens.filter((_, index) => tickets[index]?.details?.error === "DeviceNotRegistered");
}

async function postPush(messages: { to: string; title: string; body: string; data: PushData; sound: "default" }[]): Promise<Ticket[]> {
  const response = await fetch(EXPO_PUSH, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(4000),
  });
  const json = await response.json().catch(() => null) as { data?: Ticket | Ticket[] } | null;
  if (Array.isArray(json?.data)) return json.data;
  if (json?.data) return [json.data];
  return [];
}

type PushJob = { userIds: string[]; bodyFor: (locale: Locale) => string; data: PushData };

/** One token read for every recipient, one Expo call, and a delete only when Expo says a device is gone. */
export async function deliverPushes(jobs: PushJob[]): Promise<number> {
  const ids = [...new Set(jobs.flatMap((job) => job.userIds.map((id) => id.trim()).filter(Boolean)))];
  if (!ids.length) return 0;
  const rows = await expoTokensForUsers(ids);
  if (!rows.length) return 0;
  const messages = rows.flatMap((row) => {
    const job = jobs.find((item) => item.userIds.includes(row.user_id));
    if (!job) return [];
    return [{
      to: row.token,
      title: "Rent Right",
      body: job.bodyFor(row.locale),
      data: job.data,
      sound: "default" as const,
    }];
  });
  if (!messages.length) return 0;
  let tickets: Ticket[] = [];
  try {
    tickets = await postPush(messages);
  } catch {
    return 0;
  }
  const gone = unregisteredTokens(messages.map((message) => message.to), tickets);
  if (gone.length) await dropExpoTokens(gone);
  return messages.length - gone.length;
}

export async function deliverPush(userIds: string[], bodyFor: (locale: Locale) => string, data: PushData): Promise<number> {
  return deliverPushes([{ userIds, bodyFor, data }]);
}

export async function pushLandlordReply(userIds: string[], subject: string): Promise<void> {
  await deliverPush(userIds, (locale) => landlordPushBody(subject, locale), { screen: "landlord" });
}

export async function pushReminders(jobs: { userIds: string[]; issue: string; count: number; logId: string | null }[]): Promise<void> {
  await deliverPushes(jobs.map((job) => ({
    userIds: job.userIds,
    bodyFor: (locale) => reminderPushBody(job.issue, job.count, locale),
    data: job.count === 1 && job.logId ? { screen: "log", id: job.logId } : { screen: "reminders" },
  })));
}
