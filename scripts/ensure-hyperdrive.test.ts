import { describe, expect, it } from "vitest";
import { databaseOrigins } from "./ensure-hyperdrive";

describe("databaseOrigins", () => {
  it("tries the direct host before the session pooler", () => {
    const origins = databaseOrigins(
      "postgresql://postgres.abc:p%23ss@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
      "https://abc.supabase.co",
    );
    expect(origins.map((origin) => `${origin.user}@${origin.host}:${origin.port}/${origin.database}`)).toEqual([
      "postgres@db.abc.supabase.co:5432/postgres",
      "postgres.abc@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
    ]);
    expect(origins[0]?.password).toBe("p#ss");
  });

  it("keeps a direct URL as the only origin", () => {
    const origins = databaseOrigins("postgresql://postgres:secret@db.abc.supabase.co:5432/postgres", "https://abc.supabase.co");
    expect(origins).toHaveLength(1);
    expect(origins[0]?.host).toBe("db.abc.supabase.co");
    expect(origins[0]?.user).toBe("postgres");
  });
});
