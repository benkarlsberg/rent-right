import { timingSafeEqual } from "crypto";

/** Server flag. Set to `1` only when REVIEWER_EMAIL and REVIEWER_CODE are also set. */
export function reviewerConfigured(): boolean {
  return process.env.REVIEWER_LOGIN === "1" && Boolean(reviewerEmail()) && Boolean(reviewerCode());
}

export function reviewerEmail(): string {
  if (process.env.REVIEWER_LOGIN !== "1") return "";
  return (process.env.REVIEWER_EMAIL || "").trim().toLowerCase();
}

function reviewerCode(): string {
  const code = process.env.REVIEWER_CODE || "";
  return code.length >= 8 ? code : "";
}

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True only for the one configured address and code. Any other account is rejected. */
export function reviewerMatch(email: string, code: string): boolean {
  const expectedEmail = reviewerEmail();
  const expectedCode = reviewerCode();
  if (!reviewerConfigured() || !expectedEmail || !expectedCode) return false;
  return same(email.trim().toLowerCase(), expectedEmail) && same(code.trim(), expectedCode);
}
