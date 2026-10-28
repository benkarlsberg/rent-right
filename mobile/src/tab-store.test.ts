import { afterEach, describe, expect, it } from "vitest";
import {
  applyBootstrap,
  clearTabMemory,
  needsBootstrap,
  readSlice,
  sliceStale,
  rememberSlice,
  tabGeneration,
  TAB_STALE_MS,
  userIdFromToken,
} from "./tab-store";

const alice = "11111111-1111-4111-8111-111111111111.10.sig";
const bob = "22222222-2222-4222-8222-222222222222.10.sig";

afterEach(() => {
  clearTabMemory();
});

describe("tab store", () => {
  it("shares one account's slices and hides them from another account", () => {
    expect(userIdFromToken(alice)).toBe("11111111-1111-4111-8111-111111111111");
    expect(needsBootstrap(alice, 1_000)).toBe(true);
    const started = tabGeneration();
    expect(applyBootstrap(alice, { thread: { name: "chat" }, chat: { name: "landlord" }, records: { name: "records" } }, started, 1_000)).toBe(true);
    expect(readSlice(alice, "thread")).toEqual({ name: "chat" });
    expect(readSlice(alice, "chat")).toEqual({ name: "landlord" });
    expect(readSlice(alice, "records")).toEqual({ name: "records" });
    expect(needsBootstrap(alice, 1_000 + TAB_STALE_MS)).toBe(false);
    expect(sliceStale(alice, "thread", 1_000 + TAB_STALE_MS)).toBe(false);
    expect(needsBootstrap(alice, 1_000 + TAB_STALE_MS + 1)).toBe(true);
    expect(sliceStale(alice, "chat", 1_000 + TAB_STALE_MS + 1)).toBe(true);
    expect(readSlice(bob, "thread")).toBeNull();
    expect(needsBootstrap(bob, 1_000)).toBe(true);
  });

  it("drops a late response after sign-out", () => {
    const started = tabGeneration();
    clearTabMemory();
    expect(applyBootstrap(alice, { thread: { leaked: true }, chat: {}, records: {} }, started, 2_000)).toBe(false);
    expect(readSlice(alice, "thread")).toBeNull();
  });

  it("drops a bootstrap that started before a newer slice", () => {
    const started = tabGeneration();
    rememberSlice(alice, "records", { tier: "routine" }, 6_000);
    expect(applyBootstrap(alice, { thread: {}, chat: {}, records: { tier: "urgent" } }, started, 7_000)).toBe(false);
    expect(readSlice(alice, "records")).toEqual({ tier: "routine" });
  });

  it("keeps a patched slice on that account until the other slices arrive", () => {
    rememberSlice(alice, "chat", { items: ["draft"] }, 5_000);
    expect(readSlice(alice, "chat")).toEqual({ items: ["draft"] });
    expect(readSlice(bob, "chat")).toBeNull();
    expect(needsBootstrap(alice, 5_000)).toBe(true);
    clearTabMemory();
    expect(readSlice(alice, "chat")).toBeNull();
  });
});
