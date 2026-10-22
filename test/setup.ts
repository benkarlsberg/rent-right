import { afterAll } from "vitest";

process.env.DATABASE_URL ||= "postgres://rent:rent@127.0.0.1:5432/rent_right_test";
process.env.AUTH_SECRET ||= "test-auth-secret";
process.env.DATA_ENCRYPTION_KEY ||= Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.RESEND_API_KEY;

const { resetDatabase } = await import("@/lib/migrate");
const { closeSql } = await import("@/lib/pg");

await resetDatabase();

afterAll(async () => {
  await closeSql();
});
