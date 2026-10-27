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
  const rawText = (collected.text || collected.html).trim();
  const stripped = stripQuotedReply(rawText);
  const note = collected.dropped ? "A photo was left off because it was too large to store." : "";
  return {
    subject,
    text: [stripped || rawText, note].filter(Boolean).join("\n\n").trim(),
    messageId: unfold(headers.get("message-id") || ""),
    inReplyTo: unfold(headers.get("in-reply-to") || ""),
    rawText,
    attachments: collected.attachments,
  };
}

/** Drop quoted history so the chat shows the landlord's new words. */
export function stripQuotedReply(value: string): string {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^>/.test(trimmed)) break;
    if (/^on .+wrote:\s*$/i.test(trimmed)) break;
    if (/^-{2,}\s*original message\s*-{2,}$/i.test(trimmed)) break;
    if (/^el .+escribi[oó]:\s*$/i.test(trimmed)) break;
    if (/respond without an account:/i.test(trimmed)) break;
    kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}
