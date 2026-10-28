import { describe, expect, it } from "vitest";
import { mailRoute } from "./worker";

describe("inbound mail routing", () => {
  it("forwards support mail and leaves landlord replies on the relay path", () => {
    expect(mailRoute("Support <support@rentrightportal.com>")).toBe("support");
    expect(mailRoute("u-abc@rentrightportal.com")).toBe("relay");
  });
});