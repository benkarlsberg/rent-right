const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const MAX_MESSAGE_PHOTOS = 4;
export const MAX_MESSAGE_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_MESSAGE_PHOTO_TOTAL = 8 * 1024 * 1024;

export function messagePhotoError(mime: string, bytes: number): string | null {
  const type = mime.toLowerCase() === "image/jpg" ? "image/jpeg" : mime.toLowerCase();
  if (!ALLOWED.has(type)) return "That file type is not supported. Use a JPEG, PNG, WEBP, or GIF photo.";
  if (!bytes) return "That photo was empty.";
  if (bytes > MAX_MESSAGE_PHOTO_BYTES) return "That photo is too large. Each photo must be 4 MB or smaller.";
  return null;
}

export function rejectPhotoSet(files: { mime: string; bytes: number }[]): string | null {
  if (files.length > MAX_MESSAGE_PHOTOS) return "You can attach up to 4 photos.";
  let total = 0;
  for (const file of files) {
    const reason = messagePhotoError(file.mime, file.bytes);
    if (reason) return reason;
    total += file.bytes;
  }
  if (total > MAX_MESSAGE_PHOTO_TOTAL) return "Those photos are too large to email together. Remove one or use a smaller photo.";
  return null;
}

/** The email wordmark is not a tenant photo. Hide it if a file with that name was stored. */
export function isBrandAsset(name: string): boolean {
  const base = name.toLowerCase().split(/[/\\]/).pop() || "";
  return /(^|[^a-z0-9])(logo|favicon|apple-touch|icon-192|icon-512)([^a-z0-9]|$)/.test(base);
}

export function photoFilename(name: string, mime: string): string {
  const cleaned = name.replace(/[/\\]/g, " ").replace(/[^\w.\- ]+/g, "").trim().slice(0, 80);
  if (cleaned && /\.(jpe?g|png|webp|gif)$/i.test(cleaned)) return cleaned;
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "jpg";
  return cleaned ? `${cleaned.replace(/\.[^.]+$/, "")}.${ext}` : `photo.${ext}`;
}
