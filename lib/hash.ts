import { createHash } from "crypto";

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return Object.fromEntries(entries.map(([key, inner]) => [key, sortValue(inner)]));
  }
  return value;
}

export const GENESIS_HASH = "0".repeat(64);

/** SHA-256 over the previous hash plus the canonical payload. */
export function chainHash(prevHash: string, payload: unknown): string {
  return sha256(`${prevHash}\n${canonicalJson(payload)}`);
}
