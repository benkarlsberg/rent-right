import { afterEach, describe, expect, it, vi } from "vitest";
import { handlePhone } from "@/lib/phone-api";
import { getSql } from "@/lib/pg";

const auth = vi.hoisted(() => ({ authorization: "" }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
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

function saveAction(payload: Record<string, unknown> | null): string {
  const items = (payload?.items as { action?: { id?: string } | null; actions?: { id: string }[] }[]) || [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const id = item?.actions?.find((action) => action.id.startsWith("repair-save:"))?.id || item?.action?.id;
    if (id?.startsWith("repair-save:")) return id;
  }
  return "";
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
});

describe("landlord draft send", () => {
  it("records a sent draft once and a later tap returns that sent bubble", async () => {
    const providerId = "11111111-1111-4111-8111-111111111111";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).includes("api.resend.com/emails") && (!init || (init as RequestInit).method === "POST")) {
        return new Response(JSON.stringify({ id: providerId }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 404, headers: { "content-type": "application/json" } });
    });

    const email = `send-${Date.now()}@example.com`;
    const magic = await api("POST", "auth/magic", { email });
    const session = await api("POST", "auth/verify", { token: magic.json?.devToken });
    const token = String(session.json?.token);
    const unit = await api("POST", "unit", {
      name: "Ada Tenant",
      street: "1842 N Echo Park Ave",
      unitNumber: "9",
      city: "Los Angeles",
      postalCode: "90026",
      region: "CA",
      landlordName: "Elena Vasquez",
      landlordEmail: "elena@example.com",
    }, token);
    expect(unit.status).toBe(200);
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM = "Rent Right <mail@example.com>";
    const text = "The kitchen sink is leaking under the cabinet";
    const opened = await api("POST", "thread", { text }, token);
    const action = saveAction(opened.json);
    const saved = await api("POST", "thread", { action, summary: text, description: text }, token);
    expect(saved.status).toBe(200);
    const draftId = String((saved.json?.steps as { items: { href: string | null }[] }).items[0]?.href || "").split("draft=")[1];
    expect(draftId).toBeTruthy();

    const first = await api("POST", "chat/draft/send", { id: draftId, body: text }, token);
    expect(first.status).toBe(200);
    const sentBubble = (first.json?.items as { id: string; draft?: boolean; status: string; time: string }[]).find((item) => item.id === draftId);
    expect(sentBubble?.draft).toBeFalsy();
    expect(sentBubble?.status).toBe("Sent");
    expect(sentBubble?.time).toMatch(/\d/);
    const posts = fetchSpy.mock.calls.filter((call) => String(call[0]).includes("api.resend.com/emails") && (call[1] as RequestInit | undefined)?.method === "POST");
    expect(posts).toHaveLength(1);
    expect((posts[0]?.[1] as RequestInit).headers).toMatchObject({ "Idempotency-Key": draftId });

    const again = await api("POST", "chat/draft/send", { id: draftId, body: text }, token);
    expect(again.status).toBe(200);
    expect(again.json?.error).toBeUndefined();
    const still = (again.json?.items as { id: string; draft?: boolean; status: string }[]).find((item) => item.id === draftId);
    expect(still?.draft).toBeFalsy();
    expect(still?.status).toBe("Sent");
    const postsAfter = fetchSpy.mock.calls.filter((call) => String(call[0]).includes("api.resend.com/emails") && (call[1] as RequestInit | undefined)?.method === "POST");
    expect(postsAfter).toHaveLength(1);
    const rows = await getSql()<{ n: number; status: string }[]>`
      select count(*)::int as n, max(delivery_status) as status from messages where id = ${draftId}
    `;
    expect(rows[0]).toEqual({ n: 1, status: "sent" });
  });
});
