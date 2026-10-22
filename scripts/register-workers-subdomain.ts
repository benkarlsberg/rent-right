import { createHash } from "node:crypto";

function candidates(accountId: string): string[] {
  const suffix = createHash("sha256").update(accountId).digest("hex").slice(0, 6);
  return ["rent-right", "rentright", "rent-right-app", `rent-right-${suffix}`];
}

function redact(message: string, secrets: string[]): string {
  let out = message;
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out;
}

async function main(): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
  if (!accountId || !token) throw new Error("Cloudflare credentials are required.");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`;
  const current = await fetch(endpoint, { headers });
  const currentBody = (await current.json()) as { success?: boolean; result?: { subdomain?: string } };
  if (currentBody.success && currentBody.result?.subdomain) {
    console.log(`workers.dev subdomain: ${currentBody.result.subdomain}.workers.dev`);
    return;
  }

  for (const name of candidates(accountId)) {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers,
      body: JSON.stringify({ subdomain: name }),
    });
    const body = (await response.json()) as {
      success?: boolean;
      result?: { subdomain?: string };
      errors?: { code?: number; message?: string }[];
    };
    if (body.success && body.result?.subdomain) {
      console.log(`Registered workers.dev subdomain: ${body.result.subdomain}.workers.dev`);
      return;
    }
    const error = body.errors?.[0];
    console.log(`Could not register ${name}: ${error?.code ?? response.status} ${error?.message ?? ""}`.trim());
    if (response.status === 401 || response.status === 403) break;
  }
  throw new Error("Register a workers.dev subdomain in the Cloudflare dashboard, then rerun Deploy.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redact(message, [process.env.CLOUDFLARE_ACCOUNT_ID ?? "", process.env.CLOUDFLARE_API_TOKEN ?? ""]));
  process.exit(1);
});
