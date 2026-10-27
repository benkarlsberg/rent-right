import { createHash } from "node:crypto";
import {
  addNotification,
  insertLog,
  insertMessage,
  insertPhoto,
  listLandlordResponses,
  listMessages,
  messageByProviderId,
  messageByToken,
  peekUnit,
  saveFile,
  saveInboundBodies,
  unitMemberUserIds,
  type LogEntry,
  type Message,
  type Unit,
  type User,
} from "@/lib/db";
import { messagePhotoError, photoFilename, MAX_MESSAGE_PHOTOS, MAX_MESSAGE_PHOTO_BYTES, MAX_MESSAGE_PHOTO_TOTAL } from "@/lib/message-photos";
import { EMPTY_REPLY, landlordReplyText } from "@/email/plain";
import type { Locale } from "@/lib/disclaimer";
import { hasUserActor, withActor } from "@/lib/pg";
import { relayAddress, tx } from "@/lib/text";

export type InboundPhoto = { name: string; mime: string; bytes: Buffer };

export function respondProviderId(token: string, action: string, note: string): string {
  const digest = createHash("sha256").update(`${action}\n${note.trim()}`).digest("hex").slice(0, 20);
  return `respond:${token}:${digest}`;
}

export function emailProviderId(messageId: string, raw: string): string {
  const clean = messageId.replace(/[<>\s]/g, "").slice(0, 180);
  if (clean) return `email:${clean}`;
  return `email:hash:${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

export function responseTokenFromMail(raw: string): string | null {
  const match = raw.match(/\/r\/([A-Za-z0-9_-]{8,})/);
  return match?.[1] || null;
}

export function parseResponseLog(description: string): { action: string; note: string } | null {
  const match = description.trim().match(/^Landlord used the response link:\s*([a-z_]+)\.?\s*(?:Note:\s*([\s\S]*))?$/i);
  if (!match) return null;
  return { action: match[1].toLowerCase(), note: (match[2] || "").trim() };
}

export function isResponseNote(description: string): boolean {
  return /^landlord used the response link:/i.test(description.trim());
}

/** Plain words for a landlord response. Email replies use the replied prefix. */
export function landlordWords(action: string, note: string, locale: Locale = "en"): string {
  const extra = note.trim();
  const line = (en: string, es: string) => tx(locale, en, es);
  if (action === "acknowledge") {
    const lead = line("Landlord acknowledged your request", "El propietario acusó recibo de su solicitud");
    return extra ? `${lead}\n\n${extra}` : lead;
  }
  if (action === "schedule") {
    return extra
      ? line(`Landlord gave a time: ${extra}`, `El propietario dio una hora: ${extra}`)
      : line("Landlord gave a time", "El propietario dio una hora");
  }
  if (action === "fixed") {
    const lead = line("Landlord says this is fixed", "El propietario dice que esto está arreglado");
    return extra ? `${lead}\n\n${extra}` : lead;
  }
  if (action === "dispute") {
    const lead = line("Landlord disputed this request", "El propietario disputó esta solicitud");
    return extra ? `${lead}\n\n${extra}` : lead;
  }
  if (action === "block") return line("Landlord asked to block later non-essential mail", "El propietario pidió bloquear correo no esencial más adelante");
  if (action === "abuse") return line("Landlord reported a problem with the mailbox", "El propietario reportó un problema con el buzón");
  if (!extra) return line("Landlord replied", "El propietario respondió");
  return line(`Landlord replied: ${extra}`, `El propietario respondió: ${extra}`);
}

/** Show an emailed reply as the landlord's words. A response that already says who spoke stays as it is. */
export function landlordBubble(body: string, locale: Locale): string {
  const text = body.trim();
  if (!text || text === EMPTY_REPLY || text === "La respuesta no tenía texto nuevo.") return text;
  if (/^(landlord|el propietario)\b/i.test(text)) return text;
  return tx(locale, `Landlord replied: ${text}`, `El propietario respondió: ${text}`);
}

export function respondNote(action: string, note: string): string {
  return landlordWords(action, note, "en");
}

/** Keep a reply that is too big to store every photo, and say what was left off. */
export function keepInboundPhotos(photos: InboundPhoto[]): { kept: InboundPhoto[]; note: string } {
  const kept: InboundPhoto[] = [];
  const notes: string[] = [];
  let total = 0;
  for (const photo of photos) {
    if (kept.length >= MAX_MESSAGE_PHOTOS) {
      notes.push("Extra photos were left off. Up to 4 photos are kept.");
      break;
    }
    const reason = messagePhotoError(photo.mime, photo.bytes.length);
    if (reason) {
      notes.push(reason);
      continue;
    }
    if (photo.bytes.length > MAX_MESSAGE_PHOTO_BYTES || total + photo.bytes.length > MAX_MESSAGE_PHOTO_TOTAL) {
      notes.push("A photo was left off because it was too large to store.");
      continue;
    }
    kept.push(photo);
    total += photo.bytes.length;
  }
  return { kept, note: [...new Set(notes)].join(" ") };
}

export async function recordLandlordChatReply(input: {
  unit: Unit;
  fromEmail: string;
  subject: string;
  body: string;
  rawBody?: string | null;
  providerId: string;
  logEntryId: string | null;
  photos?: InboundPhoto[];
  createdAt?: string;
  quiet?: boolean;
}): Promise<"stored" | "duplicate"> {
  if (hasUserActor()) return withActor(null, () => recordLandlordChatReply(input));
  const existing = await messageByProviderId(input.providerId);
  if (existing) return "duplicate";
  const photos = keepInboundPhotos(input.photos || []);
  const body = [input.body.trim(), photos.note].filter(Boolean).join("\n\n") || "The reply had no new text.";
  try {
    const message = await insertMessage({
      unitId: input.unit.id,
      userId: null,
      logEntryId: input.logEntryId,
      direction: "inbound",
      fromEmail: input.fromEmail || input.unit.landlordEmail || "landlord",
      toEmail: relayAddress(input.unit.relayLocal),
      subject: input.subject || "(no subject)",
      body,
      rawBody: input.rawBody?.trim() || null,
      deliveryStatus: "received",
      deliveryDetail: "Inbound reply in the landlord thread.",
      providerId: input.providerId,
      createdAt: input.createdAt,
    });
    const ownerId = input.unit.createdBy;
    for (const photo of photos.kept) {
      try {
        const fileId = await saveFile(ownerId, input.unit.id, photoFilename(photo.name, photo.mime), photo.mime, photo.bytes);
        await insertPhoto(ownerId, input.unit.id, {
          fileId,
          room: "",
          caption: "From the landlord",
          link: input.logEntryId ? "issue" : "none",
          logId: input.logEntryId,
          reportId: null,
          messageId: message.id,
        });
      } catch {
        // The reply stays even when a photo cannot be stored.
      }
    }
  } catch (error) {
    if (duplicateKey(error)) return "duplicate";
    throw error;
  }
  if (!input.quiet) {
    for (const userId of await unitMemberUserIds(input.unit.id)) {
      await addNotification(userId, "Landlord reply", input.subject || "New reply from your landlord", "/landlord");
    }
  }
  return "stored";
}

/** Copy landlord replies that were saved as Notes into the landlord chat. The original row stays. */
export async function refileResponseNotes(user: User, unit: Unit, logs: LogEntry[]): Promise<boolean> {
  const pending = logs.filter((log) => log.type === "conversation" && parseResponseLog(log.description));
  if (!pending.length) return false;
  const [responses, messages] = await Promise.all([
    listLandlordResponses(user.id, unit.id),
    listMessages(user.id, unit.id),
  ]);
  let changed = false;
  for (const log of pending) {
    const providerId = `refile:${log.id}`;
    if (await messageByProviderId(providerId)) continue;
    const parsed = parseResponseLog(log.description);
    if (!parsed) continue;
    const response = responses.find((item) => item.action === parsed.action && (item.note || "").trim() === parsed.note);
    const outbound = response?.message_id ? messages.find((message) => message.id === response.message_id) : null;
    const logEntryId = outbound?.logEntryId || null;
    const body = landlordWords(parsed.action, parsed.note, user.locale);
    const stored = await recordLandlordChatReply({
      unit,
      fromEmail: unit.landlordEmail || "landlord",
      subject: outbound?.subject ? `Re: ${outbound.subject}` : "Reply",
      body,
      rawBody: body,
      providerId,
      logEntryId,
      createdAt: log.createdAt,
      quiet: true,
    });
    if (stored === "duplicate") continue;
    await insertLog({
      unitId: unit.id,
      userId: user.id,
      type: "issue_event",
      description: tx(user.locale, "A landlord reply was moved from Notes into the landlord chat.", "Una respuesta del propietario se movió de Notas al chat del propietario."),
      eventDate: (log.eventDate || log.createdAt).slice(0, 10),
      createdAt: log.createdAt,
      flags: { event: "refile", logId: log.id, ...(logEntryId ? { issueId: logEntryId } : {}) },
    });
    changed = true;
  }
  return changed;
}

export async function logEntryForReply(unitId: string, raw: string): Promise<string | null> {
  const token = responseTokenFromMail(raw);
  if (!token) return null;
  const message = await messageByToken(token);
  if (!message || message.unitId !== unitId) return null;
  return message.logEntryId;
}

export async function unitForReply(unitId: string): Promise<Unit | null> {
  return peekUnit(unitId);
}

/** Existing inbound rows stored the quoted original in the bubble. Split that into raw mail plus the new text. */
export async function settleQuotedInbound(messages: Message[]): Promise<Message[]> {
  const next: Message[] = [];
  for (const message of messages) {
    if (message.direction !== "inbound" || message.rawBody) {
      next.push(message);
      continue;
    }
    const raw = message.body;
    const body = landlordReplyText(raw);
    await saveInboundBodies(message.id, body, raw);
    next.push({ ...message, body, rawBody: raw });
  }
  return next;
}

function duplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}
