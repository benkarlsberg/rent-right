import { createHash, createHmac } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "fs";
import path from "path";

function localPath(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Bad file id.");
  return path.join(process.cwd(), "data", "blobs", id);
}

function r2Ready(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

async function r2Request(method: "PUT" | "GET" | "DELETE", id: string, body?: Buffer): Promise<Buffer | null> {
  const bucket = process.env.R2_BUCKET!;
  const host = `${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const pathname = `/${bucket}/${id}`;
  const url = `https://${host}${pathname}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payload = body ?? Buffer.alloc(0);
  const payloadHash = createHash("sha256").update(payload).digest("hex");
  const contentType = "application/octet-stream";
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonical = [method, pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const kDate = hmac(`AWS4${process.env.R2_SECRET_ACCESS_KEY}`, dateStamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${process.env.R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(url, {
    method,
    body: method === "GET" || method === "DELETE" ? undefined : new Uint8Array(payload),
    headers: {
      "content-type": contentType,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      authorization,
    },
  });
  if (!response.ok) {
    throw new Error(`R2 ${method} failed (${response.status}).`);
  }
  if (method === "GET") return Buffer.from(await response.arrayBuffer());
  return null;
}

export async function putBlob(id: string, body: Buffer): Promise<void> {
  if (r2Ready()) {
    await r2Request("PUT", id, body);
    return;
  }
  const file = localPath(id);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
}

export async function getBlob(id: string): Promise<Buffer | null> {
  if (r2Ready()) return r2Request("GET", id);
  const file = localPath(id);
  if (!existsSync(file)) return null;
  return readFileSync(file);
}

export async function deleteBlob(id: string): Promise<void> {
  if (r2Ready()) {
    await r2Request("DELETE", id);
    return;
  }
  const file = localPath(id);
  if (existsSync(file)) rmSync(file);
}
