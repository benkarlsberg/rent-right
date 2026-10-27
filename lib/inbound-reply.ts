import { createHash } from "node:crypto";
import {
  addNotification,
  insertMessage,
  insertPhoto,
  messageByProviderId,
  messageByToken,
  peekUnit,
  saveFile,
  saveInboundBodies,
  unitMemberUserIds,
  type Message,
  type Unit,
} from "@/lib/db";
import { messagePhotoError, photoFilename, MAX_MESSAGE_PHOTOS, MAX_MESSAGE_PHOTO_BYTES, MAX_MESSAGE_PHOTO_TOTAL } from "@/lib/message-photos";
import { landlordReplyText } from "@/email/plain";
import { relayAddress } from "@/lib/text";

export type InboundPhoto = { name: string; mime: string; bytes: Buffer };

const ACTIONS: Record<string, string> = {
  acknowledge: "Acknowledged",
  schedule: "Scheduled",
  fixed: "Marked fixed",
  dispute: "Disputed",
  block: "Blocked later non-essential mail",
  abuse: "Reported abuse",
};

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

export function respondNote(action: string, note: string): string {
  const label = ACTIONS[action] || "Replied";
  const extra = note.trim();
  return extra ? `${label}\n\n${extra}` : label;
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
}): Promise<"stored" | "duplicate"> {
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
  for (const userId of await unitMemberUserIds(input.unit.id)) {
    await addNotification(userId, "Landlord reply", input.subject || "New reply from your landlord", "/landlord");
  }
  return "stored";
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
