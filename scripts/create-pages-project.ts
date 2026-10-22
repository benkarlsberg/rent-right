type CfError = { code?: number; message?: string };
type CfBody = { success?: boolean; errors?: CfError[]; result?: { name?: string; subdomain?: string }[] | { subdomain?: string } };

function redact(message: string): string {
  let out = message;
  for (const secret of [process.env.CLOUDFLARE_ACCOUNT_ID, process.env.CLOUDFLARE_API_TOKEN]) {
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out;
}

function errorText(body: CfBody, status: number): string {
  const errors = body.errors ?? [];
  if (!errors.length) return `HTTP ${status}`;
  return errors.map((error) => `${error.code ?? status} ${error.message ?? ""}`.trim()).join("; ");
}

async function main(): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
  if (!accountId || !token) throw new Error("Cloudflare credentials are required.");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`;
  const listed = (await (await fetch(endpoint, { headers })).json()) as CfBody;
  const projects = Array.isArray(listed.result) ? listed.result : [];
  if (projects.some((project) => project.name === "rent-right-web")) {
    console.log("Pages project rent-right-web already exists.");
    return;
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "rent-right-web", production_branch: "main" }),
  });
  const body = (await response.json()) as CfBody;
  if (body.success) {
    const subdomain = !Array.isArray(body.result) ? body.result?.subdomain : undefined;
    console.log(subdomain ? `Created Pages project https://${subdomain}` : "Created Pages project rent-right-web.");
    return;
  }
  throw new Error(`Pages project was not created: ${errorText(body, response.status)}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redact(message));
  process.exit(1);
});
