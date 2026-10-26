import { appendFileSync } from "node:fs";

type CfError = { code?: number; message?: string };
type CfBody = {
  success?: boolean;
  errors?: CfError[];
  result?: unknown;
};

const zoneName = "rentrightportal.com";
const appHost = "app.rentrightportal.com";
const apiHost = "api.rentrightportal.com";
const pagesProject = "rent-right-web";
const workerScript = "rent-right";
const pagesTarget = "rent-right-web.pages.dev";
const workerTarget = "rent-right.rent-right.workers.dev";

const appRoutes = [
  `${appHost}/api/*`,
  `${appHost}/auth/*`,
  `${appHost}/invite/*`,
  `${appHost}/r/*`,
  `${appHost}/ack/*`,
  `${appHost}/open*`,
  `${appHost}/s/*`,
  `${appHost}/email/*`,
  `${appHost}/brand/*`,
  // /og.png is a Pages file, so it is not a Worker route.
  `${appHost}/icons/*`,
  `${appHost}/privacy*`,
  `${appHost}/terms*`,
  `${appHost}/support*`,
  `${appHost}/delete-account*`,
  `${appHost}/_next/*`,
];

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

class Cf {
  constructor(
    private readonly accountId: string,
    private readonly token: string,
  ) {}

  async call(method: string, url: string, payload?: unknown): Promise<{ status: number; body: CfBody }> {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as CfBody;
    return { status: response.status, body };
  }
}

function resultList(body: CfBody): Record<string, unknown>[] {
  return Array.isArray(body.result) ? (body.result as Record<string, unknown>[]) : [];
}

function manualSteps(): string {
  return [
    "The API token cannot edit DNS. These steps use the Cloudflare dashboard, or Zone → DNS → Edit on the token.",
    "",
    `1. Dashboard → ${zoneName} → DNS → Records → Add record`,
    `   CNAME  app  ${pagesTarget}  Proxied`,
    `   CNAME  api  ${workerTarget}  Proxied`,
    "2. If app.rentrightportal.com is not listed on the Pages project:",
    `   Workers & Pages → ${pagesProject} → Custom domains → Set up a domain → ${appHost}`,
    "3. If api.rentrightportal.com is not listed on the Worker:",
    `   Workers & Pages → ${workerScript} → Settings → Domains & Routes → Add → Custom domain → ${apiHost}`,
    "4. To let the next deploy create the records itself:",
    `   My Profile → API Tokens → edit the deploy token → add Zone → DNS → Edit for ${zoneName}.`,
    "",
    "Worker routes only receive traffic after those proxied records exist.",
    "A CNAME alone, without the Pages custom domain, returns error 522.",
  ].join("\n");
}

async function attachPages(cf: Cf, accountId: string): Promise<string> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${pagesProject}/domains`;
  const listed = await cf.call("GET", endpoint);
  if (!listed.body.success) return `Pages domain list failed: ${errorText(listed.body, listed.status)}`;
  const existing = resultList(listed.body).find((domain) => domain.name === appHost);
  if (existing) {
    const status = String(existing.status ?? "active");
    if (status === "active") return `Pages already serves ${appHost}.`;
    if (status === "error" || status === "blocked" || status === "deactivated") {
      return `Pages domain was not attached: status ${status}.`;
    }
    return `Attached ${appHost} to Pages (${status}).`;
  }
  const created = await cf.call("POST", endpoint, { name: appHost });
  if (!created.body.success) return `Pages domain was not attached: ${errorText(created.body, created.status)}`;
  const result = created.body.result as { status?: string } | undefined;
  const status = result?.status ?? "created";
  if (status === "error" || status === "blocked" || status === "deactivated") {
    return `Pages domain was not attached: status ${status}.`;
  }
  return `Attached ${appHost} to Pages (${status}).`;
}

async function attachWorkerDomain(cf: Cf, accountId: string): Promise<string> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/domains`;
  const listed = await cf.call("GET", endpoint);
  if (listed.body.success) {
    const hostnames = resultList(listed.body).map((domain) => String(domain.hostname ?? ""));
    if (hostnames.includes(apiHost)) return `Worker already serves ${apiHost}.`;
  }
  const created = await cf.call("PUT", endpoint, {
    hostname: apiHost,
    service: workerScript,
    environment: "production",
  });
  if (!created.body.success) return `Worker custom domain was not attached: ${errorText(created.body, created.status)}`;
  return `Attached ${apiHost} to Worker ${workerScript}.`;
}

async function zoneId(cf: Cf, accountId: string): Promise<string> {
  const listed = await cf.call(
    "GET",
    `https://api.cloudflare.com/client/v4/zones?name=${zoneName}&account.id=${accountId}`,
  );
  if (!listed.body.success) throw new Error(`Zone lookup failed: ${errorText(listed.body, listed.status)}`);
  const zone = resultList(listed.body).find((item) => item.name === zoneName);
  const id = zone?.id;
  if (typeof id !== "string" || !id) throw new Error(`Zone ${zoneName} was not visible to this token.`);
  return id;
}

async function ensureRoute(cf: Cf, id: string, pattern: string): Promise<string> {
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${id}/workers/routes`;
  const listed = await cf.call("GET", endpoint);
  if (!listed.body.success) return `${pattern} list failed: ${errorText(listed.body, listed.status)}`;
  const existing = resultList(listed.body).find((route) => route.pattern === pattern);
  if (existing) return `${pattern} already routes to ${String(existing.script ?? workerScript)}.`;
  const created = await cf.call("POST", endpoint, { pattern, script: workerScript });
  if (!created.body.success) return `${pattern} was not added: ${errorText(created.body, created.status)}`;
  return `Added route ${pattern}.`;
}

function writeSummary(text: string): void {
  console.log(text);
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `\n${text}\n`);
}

async function main(): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
  if (!accountId || !token) throw new Error("Cloudflare credentials are required.");
  const cf = new Cf(accountId, token);
  const notes = [await attachPages(cf, accountId), await attachWorkerDomain(cf, accountId)];
  let id = "";
  try {
    id = await zoneId(cf, accountId);
  } catch (error) {
    notes.push(error instanceof Error ? error.message : String(error));
  }
  if (id) {
    const patterns = notes.some((note) => note.startsWith("Attached") && note.includes(apiHost)) || notes.some((note) => note.startsWith("Worker already"))
      ? appRoutes
      : [...appRoutes, `${apiHost}/*`];
    for (const pattern of patterns) notes.push(await ensureRoute(cf, id, pattern));
  }
  const report = notes.map((note) => `- ${note}`).join("\n");
  const pagesNote = notes[0] ?? "";
  const workerNote = notes[1] ?? "";
  const routeNotes = notes.slice(2);
  const pagesNeedsDns = /initializing|pending|was not|failed|not visible/i.test(pagesNote);
  const workerNeedsDns = /was not|failed/i.test(workerNote);
  const routesFailed = routeNotes.some((note) => /was not|failed/i.test(note));
  const extra: string[] = [];
  if (pagesNeedsDns || workerNeedsDns || routesFailed) {
    extra.push("The API token cannot edit DNS. Use the dashboard, or add Zone → DNS → Edit for rentrightportal.com.");
  }
  if (pagesNeedsDns) {
    extra.push(`DNS → ${zoneName} → Records → Add record → CNAME, Name app, Target ${pagesTarget}, Proxy status Proxied.`);
    extra.push(`${appHost} is already registered on Pages when the log says Attached. The CNAME is the missing piece.`);
  }
  if (workerNeedsDns) {
    extra.push(`Workers & Pages → ${workerScript} → Settings → Domains & Routes → Add → Custom domain → ${apiHost}.`);
  }
  writeSummary(["### Custom domains", report, extra.join("\n") || "Custom hostnames are attached."].join("\n\n"));
  if (extra.length) process.exitCode = 2;
}

main().catch((error: unknown) => {
  const message = redact(error instanceof Error ? error.message : String(error));
  console.error(message);
  console.error(manualSteps());
  process.exit(1);
});
