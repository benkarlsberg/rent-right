export function messageText(raw: string, subjectHint = ""): { subject: string; text: string } {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const splitAt = normalized.indexOf("\n\n");
  const headerBlock = splitAt === -1 ? normalized : normalized.slice(0, splitAt);
  const body = splitAt === -1 ? "" : normalized.slice(splitAt + 2);
  const headers = parseHeaders(headerBlock);
  const subject = decodeWords(subjectHint || headers.get("subject") || "");
  return { subject, text: bodyText(headers, body).trim() };
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

function bodyText(headers: Map<string, string>, body: string): string {
  const type = headers.get("content-type") || "text/plain";
  if (/multipart\//i.test(type)) {
    const boundary = parameter(type, "boundary");
    if (!boundary) return "";
    const parts = body.split(`--${boundary}`).slice(1, -1);
    const parsed = parts.map((part) => {
      const trimmed = part.replace(/^\n/, "");
      const at = trimmed.indexOf("\n\n");
      const partHeaders = parseHeaders(at === -1 ? trimmed : trimmed.slice(0, at));
      const partBody = at === -1 ? "" : trimmed.slice(at + 2).replace(/\n--$/, "");
      return { headers: partHeaders, body: partBody };
    });
    const plain = parsed.find((part) => /text\/plain/i.test(part.headers.get("content-type") || ""));
    const html = parsed.find((part) => /text\/html/i.test(part.headers.get("content-type") || ""));
    const chosen = plain || html;
    if (!chosen) return "";
    const decoded = decodeTransfer(chosen.headers, chosen.body);
    return plain ? decoded : stripHtml(decoded);
  }
  return decodeTransfer(headers, body);
}

function decodeTransfer(headers: Map<string, string>, body: string): string {
  const encoding = (headers.get("content-transfer-encoding") || "").toLowerCase();
  if (encoding === "base64") return decodeBytes(base64Bytes(body));
  if (encoding === "quoted-printable") return decodeBytes(quotedPrintableBytes(body));
  return body;
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
