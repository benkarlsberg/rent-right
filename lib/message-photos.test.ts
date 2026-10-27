import { describe, expect, it } from "vitest";
import { buildPacket, packetLines } from "@/lib/packet";
import { messagePhotoError, rejectPhotoSet } from "@/lib/message-photos";
import type { Unit, User } from "@/lib/db";

describe("message photo limits", () => {
  it("names the real limit", () => {
    expect(messagePhotoError("image/heic", 100)).toMatch(/not supported/i);
    expect(messagePhotoError("image/jpeg", 0)).toMatch(/empty/i);
    expect(messagePhotoError("image/jpeg", 5 * 1024 * 1024)).toMatch(/too large/i);
    expect(rejectPhotoSet([
      { mime: "image/jpeg", bytes: 3 * 1024 * 1024 },
      { mime: "image/jpeg", bytes: 3 * 1024 * 1024 },
      { mime: "image/jpeg", bytes: 3 * 1024 * 1024 },
    ])).toMatch(/too large to email together/i);
    expect(rejectPhotoSet(Array.from({ length: 5 }, () => ({ mime: "image/png", bytes: 100 })))).toMatch(/up to 4/);
    expect(rejectPhotoSet([{ mime: "image/png", bytes: 100 }])).toBeNull();
  });
});

describe("packet message photos", () => {
  it("lists an attached photo with the sent message", () => {
    const lines = packetLines({
      user: { name: "Maya Chen", email: "demo@rentright.local" } as User,
      unit: {
        street: "10 Main St",
        unitNumber: "",
        city: "Los Angeles",
        postalCode: "90026",
        jurisdiction: "ca",
        landlordName: "Pat",
        rentCents: 200000,
      } as Unit,
      logs: [{
        id: "log-1",
        eventDate: "2026-10-23",
        createdAt: "2026-10-23T18:00:00.000Z",
        type: "repair",
        description: "Kitchen sink leak.",
      }],
      messages: [{
        id: "msg-1",
        createdAt: "2026-10-24T16:00:00.000Z",
        direction: "outbound",
        subject: "Repair request",
        body: "Please repair the sink.",
        deliveryStatus: "sent",
        logEntryId: "log-1",
      }],
      deadlines: [],
      ledger: [],
      deposit: null,
      conditions: [],
      images: [{ id: "file-1", bytes: new Uint8Array([1, 2, 3]), mime: "image/jpeg", caption: "Sink" }],
      messageImages: [{ messageId: "msg-1", fileId: "file-1" }],
    });
    const text = lines.join("\n");
    expect(text).toMatch(/1 photo with this message/);
    const model = buildPacket({
      user: { name: "Maya Chen", email: "demo@rentright.local" } as User,
      unit: {
        street: "10 Main St",
        unitNumber: "",
        city: "Los Angeles",
        postalCode: "90026",
        jurisdiction: "ca",
        landlordName: "Pat",
        rentCents: 200000,
      } as Unit,
      logs: [{
        id: "log-1",
        eventDate: "2026-10-23",
        createdAt: "2026-10-23T18:00:00.000Z",
        type: "repair",
        description: "Kitchen sink leak.",
      }],
      messages: [{
        id: "msg-1",
        createdAt: "2026-10-24T16:00:00.000Z",
        direction: "outbound",
        subject: "Repair request",
        body: "Please repair the sink.",
        deliveryStatus: "sent",
        logEntryId: "log-1",
      }],
      deadlines: [],
      ledger: [],
      deposit: null,
      conditions: [],
      images: [{ id: "file-1", bytes: new Uint8Array([1, 2, 3]), mime: "image/jpeg" }],
      messageImages: [{ messageId: "msg-1", fileId: "file-1" }],
    });
    expect(model.issues[0]?.messages[0]?.images).toHaveLength(1);
    expect(model.looseImages).toHaveLength(0);
  });
});
