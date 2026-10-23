import { randomUUID } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeMagicLink, createMagicLink, profileForAuthUser } from "@/lib/db";
import { startGoogleSignIn, userFromGoogleCode } from "@/lib/supabase-auth";

const generateLink = vi.hoisted(() => vi.fn());
const signInWithOtp = vi.hoisted(() => vi.fn());
const signInWithOAuth = vi.hoisted(() => vi.fn());
const exchangeCodeForSession = vi.hoisted(() => vi.fn());
const verifyOtp = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const seenKeys = vi.hoisted(() => [] as string[]);

vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, key: string) => {
    seenKeys.push(key);
    return {
      auth: {
        signInWithOtp,
        signInWithOAuth,
        exchangeCodeForSession,
        verifyOtp,
        getUser,
        admin: { generateLink },
      },
    };
  },
}));

describe("Supabase Auth", () => {
  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    generateLink.mockReset();
    signInWithOtp.mockReset();
    signInWithOAuth.mockReset();
    exchangeCodeForSession.mockReset();
    verifyOtp.mockReset();
    seenKeys.length = 0;
  });

  it("mints a magic link with the service role and verifies that hash", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "sb_publishable_test_key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test_key";
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: "hash-1" } }, error: null });
    const link = await createMagicLink("supa@example.com");
    expect(link).toEqual({ token: "hash-1", supabase: true });
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "magiclink", email: "supa@example.com" }));
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(seenKeys).toContain("sb_secret_test_key");

    const id = randomUUID();
    verifyOtp.mockResolvedValue({ data: { user: { id, email: "supa@example.com" } }, error: null });
    const user = await consumeMagicLink("hash-1");
    expect(user.id).toBe(id);
    expect(user.email).toBe("supa@example.com");
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-1", type: "magiclink" });
    expect(seenKeys).toContain("sb_publishable_test_key");
  });

  it("asks Supabase to email the code when only the anon key is set", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "sb_publishable_otp_key";
    signInWithOtp.mockResolvedValue({ error: null });
    const link = await createMagicLink("otp@example.com");
    expect(link).toEqual({ token: "", supabase: true });
    expect(signInWithOtp).toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
    expect(seenKeys).toContain("sb_publishable_otp_key");
  });

  it("starts Google sign-in and creates the same profile from the returned code", async () => {
    process.env.APP_URL = "https://app.rentrightportal.com";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "sb_publishable_test_key";
    signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth2/auth", flowId: "flow-1" }, error: null });
    const started = await startGoogleSignIn();
    expect(started.url).toBe("https://accounts.google.com/o/oauth2/auth");
    expect(JSON.parse(started.pkce).flowId).toBe("flow-1");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://app.rentrightportal.com/auth/verify", skipBrowserRedirect: true },
    });

    const id = randomUUID();
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id, email: "google@example.com" } }, error: null });
    const remote = await userFromGoogleCode("auth-code", started.pkce);
    expect(remote).toEqual({ id, email: "google@example.com" });
    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code", { flowId: "flow-1" });
    const user = await profileForAuthUser(id, remote!.email);
    expect(user.id).toBe(id);
    expect(user.email).toBe("google@example.com");
    delete process.env.APP_URL;
  });
});
