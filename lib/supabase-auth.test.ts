import { randomUUID } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeMagicLink, createMagicLink } from "@/lib/db";

const generateLink = vi.hoisted(() => vi.fn());
const signInWithOtp = vi.hoisted(() => vi.fn());
const verifyOtp = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp,
      verifyOtp,
      getUser,
      admin: { generateLink },
    },
  }),
}));

describe("Supabase Auth", () => {
  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    generateLink.mockReset();
    signInWithOtp.mockReset();
    verifyOtp.mockReset();
  });

  it("mints a magic link with the service role and verifies that hash", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: "hash-1" } }, error: null });
    const link = await createMagicLink("supa@example.com");
    expect(link).toEqual({ token: "hash-1", supabase: true });
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "magiclink", email: "supa@example.com" }));
    expect(signInWithOtp).not.toHaveBeenCalled();

    const id = randomUUID();
    verifyOtp.mockResolvedValue({ data: { user: { id, email: "supa@example.com" } }, error: null });
    const user = await consumeMagicLink("hash-1");
    expect(user.id).toBe(id);
    expect(user.email).toBe("supa@example.com");
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-1", type: "magiclink" });
  });

  it("asks Supabase to email the code when only the anon key is set", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    signInWithOtp.mockResolvedValue({ error: null });
    const link = await createMagicLink("otp@example.com");
    expect(link).toEqual({ token: "", supabase: true });
    expect(signInWithOtp).toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
  });
});
