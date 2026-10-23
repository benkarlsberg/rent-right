import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

let warnedKey = false;

export function dataKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
    return buf;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATA_ENCRYPTION_KEY is required in production.");
  }
  if (!warnedKey) {
    warnedKey = true;
    console.warn("DATA_ENCRYPTION_KEY is unset. Using a dev-only key. Do not use this for real tenant data.");
  }
  return createHash("sha256")
    .update(`rent-right-dev:${process.env.AUTH_SECRET || "dev-only-rent-right"}`)
    .digest();
}

export function authSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required in production.");
  return "dev-only-rent-right-auth";
}

export function encryptString(plain: string): string {
  return encryptBuffer(Buffer.from(plain, "utf8")).toString("utf8");
}

export function decryptString(payload: string): string {
  return decryptBuffer(Buffer.from(payload, "utf8")).toString("utf8");
}

export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey(), iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(`${iv.toString("base64url")}.${tag.toString("base64url")}.${data.toString("base64url")}`, "utf8");
}

export function decryptBuffer(payload: Buffer): Buffer {
  const [iv, tag, data] = payload.toString("utf8").split(".");
  if (!iv || !tag || !data) throw new Error("Could not read an encrypted value.");
  const decipher = createDecipheriv("aes-256-gcm", dataKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
}

export function signSession(userId: string): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const body = `${userId}.${exp}`;
  const sig = createHmac("sha256", authSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = createHmac("sha256", authSecret()).update(`${userId}.${exp}`).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  if (!Number.isFinite(Number(exp)) || Number(exp) < Date.now()) return null;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  return userId;
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export const SHORT_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const SHORT_CODE_PATTERN = /^[abcdefghjkmnpqrstuvwxyz23456789]{8,10}$/;

export function shortCode(length = 9): string {
  const alphabet = SHORT_CODE_ALPHABET;
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  const chars: string[] = [];
  while (chars.length < length) {
    for (const byte of randomBytes(16)) {
      if (byte >= limit) continue;
      chars.push(alphabet[byte % alphabet.length]);
      if (chars.length === length) break;
    }
  }
  return chars.join("");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
