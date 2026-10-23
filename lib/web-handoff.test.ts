import { afterEach, describe, expect, it } from "vitest";
import {
  finishSessionHandoff,
  forgetSessionHandoff,
  readWebCallback,
  resetWebHandoffForTests,
  takeWebSession,
} from "../mobile/src/web-handoff";

afterEach(() => {
  resetWebHandoffForTests();
});

describe("web session handoff", () => {
  it("keeps the session token after the URL is stripped and still signs in if the first caller is dropped", async () => {
    const token = takeWebSession("?session=user.123.sig");
    expect(token).toBe("user.123.sig");
    expect(takeWebSession("")).toBe("user.123.sig");

    let persisted = "";
    let loads = 0;
    let release: (value: { user: { name: string } }) => void = () => {};
    const pending = new Promise<{ user: { name: string } }>((resolve) => {
      release = resolve;
    });
    const first = finishSessionHandoff({
      token,
      loadMe: () => {
        loads += 1;
        return pending;
      },
      persist: async (session) => {
        persisted = session.token;
      },
    });

    const second = finishSessionHandoff({
      token,
      loadMe: () => {
        throw new Error("A re-render started a second /me request.");
      },
      persist: async () => {
        throw new Error("A re-render persisted a second time.");
      },
    });
    expect(second).toBe(first);

    release({ user: { name: "Maya Chen" } });
    await expect(first).resolves.toEqual({ ok: true });
    expect(loads).toBe(1);
    expect(persisted).toBe(token);
    expect(takeWebSession("?session=other")).toBe("");
  });

  it("logs a timeout and can be tried again", async () => {
    const token = "user.123.sig";
    const reasons: string[] = [];
    const slow = finishSessionHandoff({
      token,
      timeoutMs: 15,
      loadMe: (_token, signal) => new Promise<object>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
      persist: async () => {
        throw new Error("A timed-out sign-in was saved.");
      },
      log: (reason) => reasons.push(reason),
    });
    await expect(slow).resolves.toEqual({ ok: false, error: "Sign-in is taking too long. Try again." });
    expect(reasons).toEqual(["Sign-in is taking too long. Try again."]);

    forgetSessionHandoff(token);
    let persisted = "";
    const retry = await finishSessionHandoff({
      token,
      loadMe: async () => ({ user: { name: "Maya Chen" } }),
      persist: async (session) => {
        persisted = session.token;
      },
    });
    expect(retry).toEqual({ ok: true });
    expect(persisted).toBe(token);
  });

  it("logs a failed /me response", async () => {
    const reasons: string[] = [];
    const result = await finishSessionHandoff({
      token: "bad",
      loadMe: async () => {
        throw new Error("Sign in to continue.");
      },
      persist: async () => undefined,
      log: (reason) => reasons.push(reason),
    });
    expect(result).toEqual({ ok: false, error: "Sign in to continue." });
    expect(reasons).toEqual(["Sign in to continue."]);
    expect(readWebCallback("?error=Could%20not%20sign%20in%20with%20Google.&expired=1&code=1")).toEqual({
      session: "",
      error: "Could not sign in with Google.",
      expired: true,
      showCode: true,
    });
  });
});
