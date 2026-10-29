import { describe, expect, it } from "vitest";
import { PRODUCTION_API_URL, authFlagEnabled, resolveApiBase } from "./release-config";

describe("release config", () => {
  it("uses the production API when a release build has no EXPO_PUBLIC_API_URL", () => {
    expect(resolveApiBase({ dev: false })).toBe(PRODUCTION_API_URL);
    expect(resolveApiBase({ dev: false, host: "192.168.1.20", android: true })).toBe(PRODUCTION_API_URL);
  });

  it("keeps the dev host fallbacks", () => {
    expect(resolveApiBase({ dev: true, host: "192.168.1.20" })).toBe("http://192.168.1.20:3000");
    expect(resolveApiBase({ dev: true, android: true })).toBe("http://10.0.2.2:3000");
    expect(resolveApiBase({ dev: true })).toBe("http://localhost:3000");
  });

  it("prefers an explicit API URL in dev and in release", () => {
    expect(resolveApiBase({ configured: "https://api.example.com/", dev: false })).toBe("https://api.example.com");
    expect(resolveApiBase({ configured: "http://192.168.1.9:3000", dev: true })).toBe("http://192.168.1.9:3000");
  });

  it("turns Apple and Google on for production unless the flag is 0", () => {
    expect(authFlagEnabled(undefined, false)).toBe(true);
    expect(authFlagEnabled("", false)).toBe(true);
    expect(authFlagEnabled("0", false)).toBe(false);
    expect(authFlagEnabled("1", true)).toBe(true);
    expect(authFlagEnabled(undefined, true)).toBe(false);
  });
});
