import { randomUUID } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createNamedUser, createUnit, readFileForUser, saveFile, type UnitInput } from "@/lib/db";
import { one, withActor } from "@/lib/pg";
import { blobDestination, deleteBlob } from "@/lib/storage";

const previous = process.env.BLOB_STORE;

afterEach(() => {
  if (previous === undefined) delete process.env.BLOB_STORE;
  else process.env.BLOB_STORE = previous;
});

function unitInput(street: string): UnitInput {
  return {
    street,
    unitNumber: "1",
    city: "San Diego",
    postalCode: "92101",
    region: "San Diego County",
    jurisdiction: "city_sd",
    jurisdictionConfirmed: true,
    rsoStatus: "unsure",
    rstpoTier: "unsure",
    landlordName: "Landlord",
    landlordEmail: `land-${street.slice(0, 8)}@example.com`,
    landlordPhone: "",
    rentCents: 200_000,
    depositCents: 200_000,
    moveInDate: "2024-01-01",
    leaseEndDate: null,
  };
}

describe("database file bytes", () => {
  it("stores encrypted bytes in Postgres for the owner and hides them from another tenant", async () => {
    process.env.BLOB_STORE = "database";
    expect(blobDestination()).toBe("database");
    const suffix = randomUUID().slice(0, 8);
    const userA = await createNamedUser(`blob-a-${suffix}@example.com`, "Ada Tenant");
    const userB = await createNamedUser(`blob-b-${suffix}@example.com`, "Blair Tenant");
    const unit = await createUnit(userA.id, unitInput(`${suffix} Harbor Dr`));
    const payload = Buffer.from(`shower-photo-${suffix}`);
    const fileId = await withActor(userA.id, () => saveFile(userA.id, unit.id, "shower.jpg", "image/jpeg", payload));
    const own = await withActor(userA.id, () => readFileForUser(userA.id, fileId));
    expect(own?.bytes.toString("utf8")).toBe(payload.toString("utf8"));
    const other = await withActor(userB.id, () => readFileForUser(userB.id, fileId));
    expect(other).toBeNull();
    const leaked = await withActor(userB.id, () => one("select id from file_blobs where id = ?", [fileId]));
    expect(leaked).toBeUndefined();
    await withActor(userA.id, () => deleteBlob(fileId));
    const gone = await withActor(userA.id, () => readFileForUser(userA.id, fileId));
    expect(gone).toBeNull();
  });
});
