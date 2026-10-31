import { afterEach, describe, expect, it } from "vitest";
import {
  actionChangesReminders,
  applyBootstrap,
  bootstrapRequestPlan,
  clearTabMemory,
  needsBootstrap,
  publishSlice,
  readSlice,
  shouldFetchBootstrap,
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

  it("keeps Reminders stale after a landlord send so the next open refetches", () => {
    const opened = 1_700_000_000_000;
    const sent = opened + 4_000;
    const started = tabGeneration();
    applyBootstrap(alice, {
      thread: { items: [] },
      chat: { items: [{ draft: true }] },
      records: { deadlines: [], steps: { items: [{ action: "send" }] } },
    }, started, opened);
    publishSlice(alice, "chat", { items: [{ status: "Sent" }] }, sent);
    expect(sliceStale(alice, "chat", sent)).toBe(false);
    expect(sliceStale(alice, "records", sent)).toBe(true);
    expect(readSlice(alice, "records")).toEqual({ deadlines: [], steps: { items: [{ action: "send" }] } });
    expect(shouldFetchBootstrap({ force: false, stale: true })).toBe(true);
    expect(shouldFetchBootstrap({ force: false, stale: false })).toBe(false);
    expect(shouldFetchBootstrap({ force: true, stale: false })).toBe(true);
    const generation = tabGeneration();
    expect(bootstrapRequestPlan({ force: false, stale: true, flight: null, userId: userIdFromToken(alice), generation })).toBe("start");
    expect(bootstrapRequestPlan({
      force: true,
      stale: true,
      flight: { userId: userIdFromToken(alice), generation },
      userId: userIdFromToken(alice),
      generation,
    })).toBe("reuse");
    expect(bootstrapRequestPlan({
      force: true,
      stale: true,
      flight: { userId: userIdFromToken(alice), generation: generation - 1 },
      userId: userIdFromToken(alice),
      generation,
    })).toBe("start");
  });

  it("replaces the reminder list and the next steps together after a send", () => {
    const beforeSend = tabGeneration();
    applyBootstrap(alice, {
      thread: { items: [] },
      chat: { items: [{ draft: true }] },
      records: { deadlines: [], steps: { items: [{ action: "send" }] } },
    }, beforeSend, 1_000);
    publishSlice(alice, "chat", { items: [{ status: "Sent" }] }, 2_000);
    const started = tabGeneration();
    expect(applyBootstrap(alice, {
      thread: { items: [] },
      chat: { items: [{ status: "Sent" }] },
      records: {
        deadlines: [{ id: "d1", title: "Follow up: kitchen sink", closed: false }],
        steps: { items: [{ action: "wait" }] },
      },
    }, started, 3_000)).toBe(true);
    expect(readSlice(alice, "records")).toEqual({
      deadlines: [{ id: "d1", title: "Follow up: kitchen sink", closed: false }],
      steps: { items: [{ action: "wait" }] },
    });
    expect(sliceStale(alice, "records", 3_000)).toBe(false);
    expect(sliceStale(alice, "chat", 3_000)).toBe(false);
  });

  it("names the actions that change a reminder", () => {
    expect(actionChangesReminders("send")).toBe(true);
    expect(actionChangesReminders("repair-save:1")).toBe(true);
    expect(actionChangesReminders("repair-undo:1")).toBe(true);
    expect(actionChangesReminders("resolve:1")).toBe(true);
    expect(actionChangesReminders("merge:1")).toBe(true);
    expect(actionChangesReminders("repair-new")).toBe(true);
    expect(actionChangesReminders("repair-keep:1")).toBe(false);
    expect(actionChangesReminders(undefined)).toBe(false);
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
