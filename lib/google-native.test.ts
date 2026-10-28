import { afterEach, describe, expect, it, vi } from "vitest";
import { handlePhone } from "@/lib/phone-api";
import { getUserByEmail } from "@/lib/db";
import { NATIVE_GOOGLE_REDIRECT, startGoogleSignIn } from "@/lib/supabase-auth";

const auth = vi.hoisted(() => ({ authorization: "" }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === "authorization" ? auth.authorization || null : null),
  }),
}));

const userId = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.APP_URL;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function sessionResponse(name = "Ada Google") {
  return new Response(JSON.stringify({
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      email: "ada.google@example.com",
      aud: "authenticated",
      role: "authenticated",
      user_metadata: { full_name: name },
    },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("native Google sign-in", () => {
  it("starts at the app scheme and finishes into a Rent Right session", async () => {
    process.env.APP_URL = "https://app.rentrightportal.com";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "sb_publishable_test_key";
    const started = await handlePhone(new Request("http://localhost/api/v1/auth/google/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }), ["auth", "google", "start"]);
    const startBody = await started.json() as { url: string; pkce: string };
    expect(started.status).toBe(200);
    expect(new URL(startBody.url).searchParams.get("redirect_to")).toBe(NATIVE_GOOGLE_REDIRECT);
    const direct = await startGoogleSignIn(NATIVE_GOOGLE_REDIRECT);
    expect(new URL(direct.url).searchParams.get("redirect_to")).toBe("rentright://auth/callback");

    vi.stubGlobal("fetch", vi.fn(async () => sessionResponse()));
    const finished = await handlePhone(new Request("http://localhost/api/v1/auth/google/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "auth-code", pkce: startBody.pkce }),
    }), ["auth", "google", "finish"]);
    const session = await finished.json() as { token?: string; user?: { email?: string; name?: string } };
    expect(finished.status).toBe(200);
    expect(session.token).toBeTruthy();
    expect(session.user?.email).toBe("ada.google@example.com");
    expect(session.user?.name).toBe("Ada Google");
    expect(await getUserByEmail("ada.google@example.com")).toBeTruthy();
  });
});
