export type InboundAttachment = { name: string; mime: string; base64: string };

export type ParsedInbound = {
  subject: string;
  text: string;
  messageId: string;
  inReplyTo: string;
  rawText: string;
  attachments: InboundAttachment[];
};

export function messageText(raw: string, subjectHint = ""): ParsedInbound {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const splitAt = normalized.indexOf("\n\n");
  const headerBlock = splitAt === -1 ? normalized : normalized.slice(0, splitAt);
  const body = splitAt === -1 ? "" : normalized.slice(splitAt + 2);
  const headers = parseHeaders(headerBlock);
  const subject = decodeWords(subjectHint || headers.get("subject") || "");
  const collected = collectParts(headers, body);
  const plain = collected.text.trim();
  const html = collected.html.trim();
  const stripped = stripQuotedReply(plain) || stripQuotedReply(html);
  const rawText = (plain || html).trim();
  const note = collected.dropped ? "A photo was left off because it was too large to store." : "";
  return {
    subject,
    text: [stripped, note].filter(Boolean).join("\n\n").trim(),
    messageId: unfold(headers.get("message-id") || ""),
    inReplyTo: unfold(headers.get("in-reply-to") || ""),
    rawText,
    attachments: collected.attachments,
  };
}

const TEMPLATE_LINE = [
  /^the tenant wrote this message\b/i,
  /^rent right only provides the mailbox\b/i,
  /^you can acknowledge, give a schedule\b/i,
  /^reply to this email or tap respond\b/i,
  /^respond without an account:/i,
  /^general information, not legal advice\b/i,
  /^rent right is not a law firm\b/i,
  /^sent with rent right\b/i,
  /^block later non-essential mail\b/i,
];

const SIGNATURE_LINE = [
  /^--\s*$/,
  /^sent from my (iphone|ipad|android|galaxy|mobile|samsung)\b/i,
  /^enviado desde mi (iphone|ipad)\b/i,
  /^get outlook for \w+/i,
];

/** Drop quoted history, client separators, our template, and signatures. The raw mail stays stored. */
export function stripQuotedReply(value: string): string {
  const lines = value.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").split("\n");
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (isQuotedLine(trimmed)) break;
    if (isAttribution(trimmed, lines, index)) break;
    if (isOutlookSeparator(trimmed, lines, index)) break;
    if (TEMPLATE_LINE.some((pattern) => pattern.test(trimmed))) break;
    if (SIGNATURE_LINE.some((pattern) => pattern.test(trimmed))) break;
    kept.push(lines[index]);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const EMPTY_REPLY = "The reply had no new text.";

/** The bubble never includes a /r/ response token. The stored raw mail can. */
export function redactResponseLinks(value: string): string {
  const joined = value.replace(/(https?:\/\/\S*\/r\/[A-Za-z0-9_-]*)\n([A-Za-z0-9_-]+>?)(?=\n|$)/gi, "$1$2");
  return joined
    .replace(/<?https?:\/\/[^\s<>]*\/r\/[A-Za-z0-9_-]+>?/gi, "[response link]")
    .replace(/(^|[^\w/])\/r\/[A-Za-z0-9_-]{8,}/g, "$1[response link]");
}

export function landlordReplyText(value: string): string {
  const stripped = redactResponseLinks(stripQuotedReply(value)).trim();
  const meaningful = stripped.replace(/\[response link\]/g, "").replace(/\s+/g, "");
  if (!meaningful) return EMPTY_REPLY;
  return stripped;
}

export function originalEmailText(value: string): string {
  return redactResponseLinks(value).trim();
}

export function inboundDisplay(body: string, raw: string | null): { text: string; original: string | null } {
  const text = landlordReplyText(body);
  const source = (raw || body || "").trim();
  if (!source) return { text, original: null };
  const original = originalEmailText(source);
  if (!original || original === text) return { text, original: null };
  return { text, original };
}

function isQuotedLine(trimmed: string): boolean {
  return /^(?:>|&gt;)/.test(trimmed);
}

function isAttribution(trimmed: string, lines: string[], index: number): boolean {
  if (/^on .+wrote:\s*$/i.test(trimmed)) return true;
  if (/^el\s+.+escribi[oó]:\s*$/i.test(trimmed)) return true;
  const blob = lines.slice(index, index + 3).map((line) => line.trim()).join(" ");
  if (/^on\b.+wrote:\s*$/i.test(blob) && /@|\d{4}|\b(mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(blob)) return true;
  if (/^el\s+.+escribi[oó]:\s*$/i.test(blob) && /@|\d/.test(blob)) return true;
  return false;
}

function isOutlookSeparator(trimmed: string, lines: string[], index: number): boolean {
  if (/^-{2,}\s*original message\s*-{2,}$/i.test(trimmed)) return true;
  if (/^-{5,}\s*forwarded message\s*-{5,}$/i.test(trimmed)) return true;
  if (/^_{5,}$/.test(trimmed)) return true;
  if (/^begin forwarded message:\s*$/i.test(trimmed)) return true;
  if (!/^from:\s+\S/i.test(trimmed)) return false;
  const window = lines.slice(index + 1, index + 7).map((line) => line.trim());
  return window.some((line) => /^(sent|date|to|cc|subject|enviado|fecha|para|asunto):\s+\S/i.test(line));
}

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

function collectParts(headers: Map<string, string>, body: string): { text: string; html: string; attachments: InboundAttachment[]; dropped: boolean } {
  const found = { text: "", html: "", attachments: [] as InboundAttachment[], dropped: false, total: 0 };
  walk(headers, body, found);
  return found;
}

function walk(headers: Map<string, string>, body: string, found: { text: string; html: string; attachments: InboundAttachment[]; dropped: boolean; total: number }) {
  const type = headers.get("content-type") || "text/plain";
  if (/multipart\//i.test(type)) {
    const boundary = parameter(type, "boundary");
    if (!boundary) return;
    const parts = body.split(`--${boundary}`).slice(1, -1);
    for (const part of parts) {
      const trimmed = part.replace(/^\n/, "");
      const at = trimmed.indexOf("\n\n");
      const partHeaders = parseHeaders(at === -1 ? trimmed : trimmed.slice(0, at));
      const partBody = at === -1 ? "" : trimmed.slice(at + 2).replace(/\n--$/, "");
      walk(partHeaders, partBody, found);
    }
    return;
  }
  if (/^image\//i.test(type)) {
    pushImage(headers, type, decodeTransferBytes(headers, body), found);
    return;
  }
  const decoded = decodeBytes(decodeTransferBytes(headers, body));
  if (/text\/plain/i.test(type) && !found.text) found.text = decoded;
  else if (/text\/html/i.test(type) && !found.html) found.html = stripHtml(decoded);
}

function pushImage(headers: Map<string, string>, type: string, bytes: Uint8Array, found: { attachments: InboundAttachment[]; dropped: boolean; total: number }) {
  const mime = type.split(";")[0].trim().toLowerCase().replace("image/jpg", "image/jpeg");
  if (found.attachments.length >= MAX_PHOTOS || bytes.length > MAX_PHOTO_BYTES || found.total + bytes.length > MAX_TOTAL_BYTES) {
    found.dropped = true;
    return;
  }
  found.total += bytes.length;
  const name = filenameOf(headers) || "photo";
  found.attachments.push({ name, mime, base64: bytesToBase64(bytes) });
}

function filenameOf(headers: Map<string, string>): string {
  const disposition = headers.get("content-disposition") || "";
  return parameter(disposition, "filename") || parameter(headers.get("content-type") || "", "name");
}

function unfold(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function parseHeaders(block: string): Map<string, string> {
  const headers = new Map<string, string>();
  const lines = block.replace(/\n[ \t]+/g, " ").split("\n");
  for (const line of lines) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    headers.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
  }
  return headers;
}

function decodeTransferBytes(headers: Map<string, string>, body: string): Uint8Array {
  const encoding = (headers.get("content-transfer-encoding") || "").toLowerCase();
  if (encoding === "base64") return base64Bytes(body);
  if (encoding === "quoted-printable") return quotedPrintableBytes(body);
  return Uint8Array.from(body, (char) => char.charCodeAt(0) & 0xff);
}

function parameter(header: string, name: string): string {
  const match = header.match(new RegExp(`${name}=(?:"([^"]+)"|([^;\\s]+))`, "i"));
  return match?.[1] || match?.[2] || "";
}

function decodeWords(value: string): string {
  return value
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, charset: string, encoding: string, text: string) => {
      const bytes = encoding.toUpperCase() === "B" ? base64Bytes(text) : quotedPrintableBytes(text.replace(/_/g, " "));
      return decodeBytes(bytes, charset);
    })
    .replace(/\s+(?==\?)/g, "");
}

function quotedPrintableBytes(value: string): Uint8Array {
  const stripped = value.replace(/=\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < stripped.length; i += 1) {
    if (stripped[i] === "=" && /[0-9A-Fa-f]{2}/.test(stripped.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(stripped.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    bytes.push(stripped.charCodeAt(i) & 0xff);
  }
  return Uint8Array.from(bytes);
}

function base64Bytes(value: string): Uint8Array {
  const cleaned = value.replace(/\s/g, "");
  const binary = atob(cleaned);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeBytes(bytes: Uint8Array, charset = "utf-8"): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|blockquote|h[1-6]|li|table)>/gi, "\n")
    .replace(/<blockquote\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
