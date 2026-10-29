import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { CONNECT_BUDGET_MS, CONNECT_TIMEOUT_SECONDS, DATABASE_WAIT_MS } from "@/lib/pg";

describe("database connect budget", () => {
  it("lets a cold Hyperdrive handshake finish before the 8s query deadline", () => {
    expect(CONNECT_BUDGET_MS).toBeGreaterThan(DATABASE_WAIT_MS);
    expect(CONNECT_TIMEOUT_SECONDS * 1000).toBeGreaterThanOrEqual(CONNECT_BUDGET_MS);
    const source = readFileSync("lib/pg.ts", "utf8");
    const warm = source.indexOf("async function warmConnection");
    const call = source.indexOf("await warmConnection()");
    expect(warm).toBeGreaterThan(0);
    expect(call).toBeGreaterThan(0);
    expect(source.indexOf("pauseDatabaseClock()", warm)).toBeGreaterThan(warm);
    const body = source.slice(warm, source.indexOf("async function closeSql"));
    expect(body).toContain("select pg_backend_pid()");
    expect(body).toContain("CONNECT_BUDGET_MS");
  });

  it("reuses the open Hyperdrive socket when a write drops the role", () => {
    const source = readFileSync("lib/pg.ts", "utf8");
    const fn = source.slice(source.indexOf("export async function withActor"));
    const reuse = fn.indexOf("if (current)");
    const fresh = fn.indexOf("const scope: Scope = { userId, memo: new Map() };");
    expect(reuse).toBeGreaterThan(0);
    expect(fresh).toBeGreaterThan(reuse);
    const branch = fn.slice(reuse, fresh);
    expect(branch).toContain("await releaseReads()");
    expect(branch).toContain("sql: current.sql");
    expect(branch).not.toContain("warmConnection");
    expect(branch).not.toContain("armDatabaseClock");
    expect(source).toContain("scope.abort?.abort()");
    const mail = readFileSync("lib/email.ts", "utf8");
    const send = mail.slice(mail.indexOf("export async function sendRelayEmail"));
    const fetchAt = send.indexOf("https://api.resend.com/emails");
    expect(send.slice(0, fetchAt)).toContain("databaseClockExpired()");
    expect(send.slice(0, fetchAt)).toContain("pauseDatabaseClock()");
  });
});
