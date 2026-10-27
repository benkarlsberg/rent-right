import { randomUUID } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashToken, SHORT_CODE_PATTERN } from "@/lib/crypto";
import { consumeMagicLink, createMagicLink, deleteUserAccount, fillEmptyProfileName, getUser as loadUser, profileForAuthUser, updateUser } from "@/lib/db";
import { nameFromAuthUser, userFromAppleIdToken } from "@/lib/supabase-auth";
import { getSql } from "@/lib/pg";

const generateLink = vi.hoisted(() => vi.fn());
const deleteUser = vi.hoisted(() => vi.fn());
const signInWithOtp = vi.hoisted(() => vi.fn());
const signInWithOAuth = vi.hoisted(() => vi.fn());
const signInWithIdToken = vi.hoisted(() => vi.fn());
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
        signInWithIdToken,
        exchangeCodeForSession,
        verifyOtp,
        getUser,
        admin: { generateLink, deleteUser },
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
    deleteUser.mockReset();
    signInWithOtp.mockReset();
    signInWithOAuth.mockReset();
    signInWithIdToken.mockReset();
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
    expect(link.supabase).toBe(true);
    expect(link.token).toMatch(SHORT_CODE_PATTERN);
    expect(link.token).not.toContain("hash-1");
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "magiclink", email: "supa@example.com" }));
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(seenKeys).toContain("sb_secret_test_key");

    const rows = await getSql()<{ token_hash: string; provider_token: string | null }[]>`select token_hash, provider_token from magic_links where email = ${"supa@example.com"}`;
    expect(rows[0]?.token_hash).toBe(hashToken(link.token));
    expect(rows[0]?.token_hash).not.toBe(link.token);
    expect(rows[0]?.provider_token || "").not.toContain("hash-1");

    const id = randomUUID();
    verifyOtp.mockResolvedValue({ data: { user: { id, email: "supa@example.com" } }, error: null });
    const user = await consumeMagicLink(link.token);
    expect(user.id).toBe(id);
    expect(user.email).toBe("supa@example.com");
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-1", type: "magiclink" });
    expect(seenKeys).toContain("sb_publishable_test_key");
    await expect(consumeMagicLink("hash-1")).rejects.toThrow(/invalid or expired/i);
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

  it("returns the existing profile when the same email signs in again", async () => {
    const id = randomUUID();
    const email = `same-${id}@example.com`;
    const created = await profileForAuthUser(id, email);
    const again = await profileForAuthUser(randomUUID(), email);
    expect(again.id).toBe(created.id);
    expect(again.email).toBe(email);
    const sameId = await profileForAuthUser(id, email);
    expect(sameId.id).toBe(id);
  });

  it("exchanges an Apple identity token with the anon key", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "sb_publishable_test_key";
    const id = randomUUID();
    signInWithIdToken.mockResolvedValue({ data: { user: { id, email: "apple@example.com" } }, error: null });
    const remote = await userFromAppleIdToken("header.payload.sig", "nonce-raw");
    expect(remote).toEqual({ id, email: "apple@example.com", name: "" });
    signInWithIdToken.mockResolvedValue({ data: { user: { id, email: "apple@example.com", user_metadata: { full_name: "Ada Lovelace" } } }, error: null });
    expect((await userFromAppleIdToken("header.payload.sig", "nonce-raw"))?.name).toBe("Ada Lovelace");
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: "apple", token: "header.payload.sig", nonce: "nonce-raw" });
    expect(seenKeys).toContain("sb_publishable_test_key");
    expect(seenKeys).not.toContain("sb_secret_test_key");
  });

  it("fills an empty profile name from Apple or Google and does not replace an edited name", async () => {
    expect(nameFromAuthUser({ user_metadata: { full_name: "Ada Lovelace" } })).toBe("Ada Lovelace");
    expect(nameFromAuthUser({ user_metadata: { given_name: "Ada", family_name: "Lovelace" } })).toBe("Ada Lovelace");
    expect(nameFromAuthUser({ user_metadata: { name: "  Ada   Lovelace " } })).toBe("Ada Lovelace");
    expect(nameFromAuthUser({ identities: [{ identity_data: { full_name: "Grace Hopper" } }] })).toBe("Grace Hopper");
    expect(nameFromAuthUser(null)).toBe("");
    const created = await profileForAuthUser(randomUUID(), `named-${randomUUID()}@example.com`);
    await fillEmptyProfileName(created.id, "Ada Lovelace");
    expect((await loadUser(created.id))?.name).toBe("Ada Lovelace");
    await updateUser(created.id, { name: "Edited Name" });
    await fillEmptyProfileName(created.id, "Someone Else");
    expect((await loadUser(created.id))?.name).toBe("Edited Name");
  });

  it("deletes the auth user with the service role", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test_key";
    deleteUser.mockResolvedValue({ error: null });
    const created = await profileForAuthUser(randomUUID(), `gone-${randomUUID()}@example.com`);
    await deleteUserAccount(created.id);
    expect(deleteUser).toHaveBeenCalledWith(created.id);
    expect(seenKeys).toContain("sb_secret_test_key");
  });
});
