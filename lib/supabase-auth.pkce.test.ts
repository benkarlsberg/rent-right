import { afterEach, describe, expect, it, vi } from "vitest";
import { startGoogleSignIn, userFromGoogleCode } from "@/lib/supabase-auth";

const userId = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.APP_URL;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function sessionResponse() {
  return new Response(JSON.stringify({
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: userId, email: "google@example.com", aud: "authenticated", role: "authenticated" },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("Google PKCE", () => {
  it("stores the verifier for the flow id and exchanges that same verifier", async () => {
    process.env.APP_URL = "https://app.rentrightportal.com";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "sb_publishable_test_key";
    const started = await startGoogleSignIn();
    const url = new URL(started.url);
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("redirect_to")).toBe("https://app.rentrightportal.com/auth/verify");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    const saved = JSON.parse(started.pkce) as { flowId: string; entries: [string, string][] };
    expect(saved.flowId).toMatch(/^[a-z0-9]{32}$/);
    const slot = saved.entries.find(([key]) => key.includes(`-flow-${saved.flowId}-code-verifier`));
    expect(slot).toBeTruthy();
    const verifier = JSON.parse(slot![1]) as string;
    expect(verifier.length).toBeGreaterThan(40);
    expect(started.pkce.length).toBeLessThan(3500);

    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body || ""));
      return sessionResponse();
    }));
    const remote = await userFromGoogleCode("auth-code", started.pkce);
    expect(remote).toEqual({ id: userId, email: "google@example.com" });
    expect(bodies.some((body) => body.includes(verifier) && body.includes("auth-code"))).toBe(true);
    expect(bodies.join("\n")).not.toContain("access-token");
  });

  it("reports a missing verifier without throwing", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "sb_publishable_test_key";
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const remote = await userFromGoogleCode("auth-code", JSON.stringify({ flowId: null, entries: [] }));
    expect(remote).toBeNull();
    expect(error).toHaveBeenCalledWith("Google sign-in exchange failed: stored verifier was missing");
    expect(String(error.mock.calls)).not.toContain("auth-code");
  });
});
