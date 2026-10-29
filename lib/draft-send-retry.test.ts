import { describe, expect, it } from "vitest";
import { retryTimedOutDraftSend } from "@/lib/phone-api";

describe("draft send retry", () => {
  it("retries one timed-out draft send and leaves other requests alone", () => {
    const timeout = new Error("The database connection timed out.");
    expect(retryTimedOutDraftSend("POST", "chat/draft/send", 1, timeout)).toBe(true);
    expect(retryTimedOutDraftSend("POST", "chat/draft/send", 2, timeout)).toBe(false);
    expect(retryTimedOutDraftSend("POST", "chat", 1, timeout)).toBe(false);
    expect(retryTimedOutDraftSend("POST", "thread", 1, timeout)).toBe(false);
    expect(retryTimedOutDraftSend("GET", "chat/draft/send", 1, timeout)).toBe(false);
    expect(retryTimedOutDraftSend("POST", "chat/draft/send", 1, new Error("Write a message."))).toBe(false);
  });
});
