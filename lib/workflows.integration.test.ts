import { describe, expect, it, vi } from "vitest";
import { handlePhone } from "@/lib/phone-api";
import { sampleLeaseText } from "@/lib/workflow";
import { getSql } from "@/lib/pg";
import { DEMO_EMAIL, startSampleTenancy } from "@/lib/seed";
import { getUser } from "@/lib/db";

const auth = vi.hoisted(() => ({ authorization: "" }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === "authorization" ? auth.authorization || null : null),
  }),
}));

async function api(method: string, path: string, body?: unknown, token = "") {
  auth.authorization = token ? `Bearer ${token}` : "";
  const response = await handlePhone(
    new Request(`http://localhost/api/v1/${path}`, {
      method,
      headers: { authorization: auth.authorization, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    path.split("/").filter(Boolean),
  );
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) as Record<string, unknown> : null };
}

describe("renter workflows", () => {
  it("signs up, reviews a lease, and emails the landlord only after confirmation", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
    expect(process.env.RESEND_API_KEY).toBeUndefined();

    const email = `ada-${Date.now()}@example.com`;
    const magic = await api("POST", "auth/magic", { email });
    expect(magic.status).toBe(200);
    expect(typeof magic.json?.devToken).toBe("string");

    const session = await api("POST", "auth/verify", { token: magic.json?.devToken });
    expect(session.status).toBe(200);
    expect(session.json?.needsUnit).toBe(true);
    const token = String(session.json?.token);

    const unit = await api("POST", "unit", {
      name: "Ada Tenant",
      street: "1842 N Echo Park Ave",
      unitNumber: "9",
      city: "Los Angeles",
      postalCode: "90026",
      region: "Los Angeles County",
      landlordName: "Elena Vasquez",
      landlordEmail: "elena@example.com",
      rent: "2150",
    }, token);
    expect(unit.status).toBe(200);
    expect(unit.json?.needsUnit).toBe(false);

    const reviewed = await api("POST", "lease", {
      text: sampleLeaseText(),
      filename: "lease.txt",
    }, token);
    expect(reviewed.status).toBe(200);
    const reviews = reviewed.json?.reviews as { findings: { ruleId: string | null; status: string }[] }[];
    expect(reviews.length).toBeGreaterThan(0);
    const findings = reviews[0].findings;
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      if (finding.ruleId) expect(finding.ruleId).toMatch(/^[A-Z0-9.-]+$/);
      else expect(finding.status).toBe("Unsure");
    }
    const saved = await api("GET", "lease", undefined, token);
    expect(JSON.stringify(saved.json)).toContain(findings[0].ruleId || "Unsure");

    const repair = await api("POST", "thread", { text: "The kitchen sink is leaking under the cabinet" }, token);
    expect(repair.status).toBe(200);
    const items = repair.json?.items as { status?: string; action?: { id: string } | null; headline?: string }[];
    const waiting = items.find((item) => item.action?.id.startsWith("send:"));
    expect(waiting?.status).toBe("Not sent");
    const draftId = waiting!.action!.id.slice("send:".length);

    const confirmed = await api("POST", "thread", { action: "send", draftId }, token);
    expect(confirmed.status).toBe(200);
    const sentCard = (confirmed.json?.items as { headline?: string; status?: string }[]).find((item) => item.headline === "Landlord email");
    expect(sentCard?.status).toBe("Saved");

    const mail = await api("GET", "chat", undefined, token);
    const bubble = (mail.json?.items as { text: string; status: string }[]).find((item) => item.text.includes("leaking"));
    expect(bubble?.status).toBe("Saved");
    const rows = await getSql()`
      select delivery_status from messages
      where subject ilike '%repair%' or body_enc is not null
      order by created_at desc
      limit 5
    `;
    expect(rows.some((row) => row.delivery_status === "local_only")).toBe(true);
  });

  it("rejects missing, bad, reused, and expired sign-in, and short lease text", async () => {
    const missing = await api("GET", "me");
    expect(missing.status).toBe(401);

    const bad = await api("GET", "me", undefined, "not-a-session");
    expect(bad.status).toBe(401);

    const unknown = await api("POST", "auth/verify", { token: "missing-token" });
    expect(unknown.status).toBe(400);

    const email = `reuse-${Date.now()}@example.com`;
    const magic = await api("POST", "auth/magic", { email });
    const first = await api("POST", "auth/verify", { token: magic.json?.devToken });
    expect(first.status).toBe(200);
    const second = await api("POST", "auth/verify", { token: magic.json?.devToken });
    expect(second.status).toBe(400);
    expect(JSON.stringify(second.json)).toMatch(/invalid or expired/i);

    const expiring = await api("POST", "auth/magic", { email: `old-${Date.now()}@example.com` });
    await getSql()`update magic_links set expires_at = now() - interval '1 minute' where token_hash is not null and used_at is null`;
    const expired = await api("POST", "auth/verify", { token: expiring.json?.devToken });
    expect(expired.status).toBe(400);

    const token = String(first.json?.token);
    await api("POST", "unit", {
      name: "Ada Tenant",
      street: "10 Main St",
      city: "Los Angeles",
      postalCode: "90026",
      landlordName: "Pat Landlord",
      landlordEmail: "pat@example.com",
    }, token);
    const empty = await api("POST", "thread", { text: "" }, token);
    expect(empty.status).toBe(400);
    const short = await api("POST", "lease", { text: "too short" }, token);
    expect(short.status).toBe(400);
    expect(JSON.stringify(short.json)).toMatch(/No lease text/i);
  });

  it("loads the synthetic Los Angeles sample tenancy", async () => {
    const id = await startSampleTenancy();
    const user = await getUser(id);
    expect(user?.email).toBe(DEMO_EMAIL);
    expect(user?.name).toBe("Maya Chen");
    const opened = await api("POST", "auth/demo");
    expect(opened.status).toBe(200);
    expect(JSON.stringify(opened.json)).toContain("1842 N Echo Park Ave");
    expect(JSON.stringify(opened.json)).toContain("Maya Chen");
  });
});
