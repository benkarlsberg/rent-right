import { describe, expect, it } from "vitest";
import { GOOGLE_REDIRECT, parseGoogleCallback } from "./google-callback";

describe("Google app callback", () => {
  it("reads the code from the custom-scheme redirect", () => {
    expect(GOOGLE_REDIRECT).toBe("rentright://auth/callback");
    expect(parseGoogleCallback("rentright://auth/callback?code=abc-123")).toEqual({ code: "abc-123", error: "" });
    expect(parseGoogleCallback("rentright://auth/callback?error_description=Access+denied")).toEqual({
      code: "",
      error: "Access denied",
    });
    expect(parseGoogleCallback("rentright://auth/callback#code=from-hash")).toEqual({ code: "from-hash", error: "" });
    expect(parseGoogleCallback("not a url").error).toBe("Could not sign in with Google.");
  });
});
