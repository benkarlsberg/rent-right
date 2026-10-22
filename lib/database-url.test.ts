import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { normalizeDatabaseUrl } from "@/lib/pg";

describe("normalizeDatabaseUrl", () => {
  it("leaves a local URL unchanged", () => {
    expect(normalizeDatabaseUrl("postgres://rent:rent@127.0.0.1:5432/rent_right_test")).toBe(
      "postgres://rent:rent@127.0.0.1:5432/rent_right_test",
    );
  });

  it("encodes reserved characters in the password and requires SSL for Supabase", async () => {
    const url = normalizeDatabaseUrl("postgresql://postgres:abc#def@db.abc.supabase.co:5432/postgres");
    expect(url).toBe("postgresql://postgres:abc%23def@db.abc.supabase.co:5432/postgres?sslmode=require");
    const parsed = new URL(url);
    expect(decodeURIComponent(parsed.password)).toBe("abc#def");
    const sql = postgres(url);
    await sql.end({ timeout: 1 });
  });

  it("strips quotes and an env assignment", () => {
    const url = normalizeDatabaseUrl('DATABASE_URL="postgresql://postgres:secret@db.abc.supabase.co:5432/postgres"');
    expect(url).toBe("postgresql://postgres:secret@db.abc.supabase.co:5432/postgres?sslmode=require");
  });

  it("reads a libpq connection string", () => {
    const url = normalizeDatabaseUrl("host=db.abc.supabase.co port=5432 dbname=postgres user=postgres password=abc#def");
    expect(url).toBe("postgresql://postgres:abc%23def@db.abc.supabase.co:5432/postgres?sslmode=require");
  });

  it("keeps an already encoded password", () => {
    const url = normalizeDatabaseUrl("postgresql://postgres:abc%23def@db.abc.supabase.co:5432/postgres?sslmode=require");
    expect(url).toBe("postgresql://postgres:abc%23def@db.abc.supabase.co:5432/postgres?sslmode=require");
  });

  it("rejects a project HTTP URL without printing the secret", () => {
    expect(() => normalizeDatabaseUrl("https://abc.supabase.co")).toThrow(/HTTP URL/);
  });
});
