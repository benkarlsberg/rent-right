import { describe, expect, it, vi } from "vitest";
import { GET as packetPdf } from "@/app/api/packet/route";
import { handlePhone } from "@/lib/phone-api";
import { getSql } from "@/lib/pg";

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

describe("a home with no landlord", () => {
  it("keeps setup, messages, reminders, and the packet on a prompt instead of an error", async () => {
    const email = `skip-${Date.now()}@example.com`;
    const magic = await api("POST", "auth/magic", { email });
    expect(magic.status).toBe(200);
    expect(typeof magic.json?.devToken).toBe("string");
    const session = await api("POST", "auth/verify", { token: magic.json?.devToken });
    expect(session.status).toBe(200);
    const token = String(session.json?.token);

    const unit = await api("POST", "unit", {
      street: "1842 N Echo Park Ave",
      city: "Los Angeles",
      postalCode: "90026",
      region: "CA",
    }, token);
    expect(unit.status).toBe(200);
    expect(unit.json?.needsUnit).toBe(false);
    expect(unit.json?.needsLandlord).toBe(true);
    const unitId = String((unit.json?.unit as { id?: string } | undefined)?.id);
    expect(unitId).toBeTruthy();

    const boot = await api("GET", "bootstrap", undefined, token);
    expect(boot.status).toBe(200);
    expect(boot.json?.error).toBeUndefined();
    const chat = boot.json?.chat as { needsLandlord?: boolean; prompt?: string; items?: unknown[] };
    const thread = boot.json?.thread as { needsLandlord?: boolean; prompt?: string };
    const records = boot.json?.records as { needsLandlord?: boolean };
    expect(chat.needsLandlord).toBe(true);
    expect(chat.prompt).toBe("Add your landlord's name and email to send a message.");
    expect(thread.needsLandlord).toBe(true);
    expect(records.needsLandlord).toBe(true);

    auth.authorization = `Bearer ${token}`;
    const blockedPacket = await packetPdf();
    expect(blockedPacket.status).toBe(200);
    expect(blockedPacket.headers.get("content-type")).toContain("json");
    expect(await blockedPacket.json()).toEqual({ needsLandlord: true });

    const spanish = await api("POST", "settings", { locale: "es", name: "Ada" }, token);
    expect(spanish.status).toBe(200);
    const repair = await api("POST", "thread", { text: "The sink is leaking under the cabinet" }, token);
    expect(repair.status).toBe(200);
    expect(repair.json?.needsLandlord).toBe(true);
    const card = (repair.json?.items as { action?: { id: string; label: string } | null; detail?: string }[]).find((item) => item.action?.id === "add-landlord");
    expect(card?.action?.label).toBe("Agregar propietario");
    expect(card?.detail).toContain("Agregue el nombre y el correo del propietario para enviar un mensaje.");

    const hello = await api("POST", "chat", { text: "Hello" }, token);
    expect(hello.status).toBe(200);
    expect(hello.json?.needsLandlord).toBe(true);
    const outbound = await getSql()<{ n: number }[]>`
      select count(*)::int as n from messages
      where unit_id = ${unitId} and delivery_status not in ('draft', 'discarded')
    `;
    expect(outbound[0]?.n).toBe(0);

    const drafts = await api("GET", "chat", undefined, token);
    const draft = (drafts.json?.items as { id: string; draft?: boolean }[]).find((item) => item.draft);
    const draftId = String(draft?.id || "");
    expect(draftId).toBeTruthy();
    const held = await api("POST", "chat/draft/send", { id: draftId, body: "Please repair the sink." }, token);
    expect(held.status).toBe(200);
    expect(held.json?.needsLandlord).toBe(true);
    const still = await getSql()<{ delivery_status: string }[]>`select delivery_status from messages where id = ${draftId}`;
    expect(still[0]?.delivery_status).toBe("draft");

    const steps = await api("GET", "records", undefined, token);
    const items = (steps.json?.steps as { items: { action: string; button: string; href: string | null; detail: string }[] }).items;
    const send = items.find((item) => item.action === "send");
    expect(send?.button).toBe("Agregar propietario");
    expect(send?.href).toBe("/landlord");
    expect(send?.detail).toContain("La nota está guardada.");
    expect(items.some((item) => item.action === "export")).toBe(false);

    const draftRow = await getSql()<{ id: string }[]>`select id from chat_drafts where unit_id = ${unitId} and status = 'open' limit 1`;
    const chatDraftId = String(draftRow[0]?.id || "");
    expect(chatDraftId).toBeTruthy();
    const fromCard = await api("POST", "thread", { action: "send", draftId: chatDraftId }, token);
    expect(fromCard.status).toBe(200);
    const prompted = (fromCard.json?.items as { action?: { id: string } | null; headline?: string }[]).find((item) => item.action?.id === "add-landlord" && item.headline === "Agregar propietario");
    expect(prompted).toBeTruthy();
    const stillQuiet = await getSql()<{ n: number }[]>`
      select count(*)::int as n from messages
      where unit_id = ${unitId} and delivery_status not in ('draft', 'discarded')
    `;
    expect(stillQuiet[0]?.n).toBe(0);

    const saved = await api("POST", "landlord", { name: "Elena Vasquez", email: "elena@example.com", phone: "213-555-0100" }, token);
    expect(saved.status).toBe(200);
    expect(saved.json?.needsLandlord).toBe(false);
    expect(saved.json?.landlord).toBe("Elena Vasquez");
    const home = await api("GET", "me", undefined, token);
    expect(home.json?.needsLandlord).toBe(false);
    expect((home.json?.unit as { landlordName?: string; landlordEmail?: string }).landlordName).toBe("Elena Vasquez");
    expect((home.json?.unit as { landlordEmail?: string }).landlordEmail).toBe("elena@example.com");
    const contact = await getSql()<{ landlord_phone: string }[]>`select landlord_phone from units where id = ${unitId}`;
    expect(contact[0]?.landlord_phone).toBe("213-555-0100");

    auth.authorization = `Bearer ${token}`;
    const pdf = await packetPdf();
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toContain("pdf");
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });
});
