import { afterEach, describe, expect, it } from "vitest";
import { backAction, backFallback, captureLoadedPath, resetLoadedPathForTests } from "../mobile/src/back-nav";

afterEach(() => {
  resetLoadedPathForTests();
});

describe("back fallback", () => {
  it("sends record screens to Records and everything else to Chat", () => {
    expect(backFallback("/settings")).toBe("/chat");
    expect(backFallback("/setup")).toBe("/chat");
    expect(backFallback("/lease")).toBe("/chat");
    expect(backFallback("/deposit")).toBe("/chat");
    expect(backFallback("/increase")).toBe("/chat");
    expect(backFallback("/photos")).toBe("/records");
    expect(backFallback("/photos?issue=abc")).toBe("/records");
    expect(backFallback("/log/abc")).toBe("/records");
    expect(backFallback("/log-new")).toBe("/records");
    expect(backFallback("/packet")).toBe("/records");
    expect(backFallback("/ledger")).toBe("/records");
    expect(backFallback("/residence")).toBe("/records");
  });

  it("returns to the previous screen after an in-app push", () => {
    captureLoadedPath("/chat");
    expect(backAction({ path: "/settings", canGoBack: true, reloaded: false })).toEqual({ kind: "back" });
    expect(backAction({ path: "/residence", canGoBack: true, reloaded: false })).toEqual({ kind: "back" });
  });

  it("replaces to Chat when Settings was opened but the stack cannot go back", () => {
    captureLoadedPath("/chat");
    expect(backAction({ path: "/settings", canGoBack: false, reloaded: false })).toEqual({ kind: "replace", href: "/chat" });
  });

  it("replaces to Records when a record screen was opened but the stack cannot go back", () => {
    captureLoadedPath("/records");
    expect(backAction({ path: "/photos", canGoBack: false, reloaded: false })).toEqual({ kind: "replace", href: "/records" });
    expect(backAction({ path: "/log/abc", canGoBack: false, reloaded: false })).toEqual({ kind: "replace", href: "/records" });
    expect(backAction({ path: "/residence", canGoBack: false, reloaded: false })).toEqual({ kind: "replace", href: "/records" });
  });

  it("falls back on a direct load even when the stack reports it can go back", () => {
    captureLoadedPath("/settings");
    expect(backAction({ path: "/settings", canGoBack: true, reloaded: false })).toEqual({ kind: "replace", href: "/chat" });
    resetLoadedPathForTests();
    captureLoadedPath("/photos");
    expect(backAction({ path: "/photos", canGoBack: true, reloaded: false })).toEqual({ kind: "replace", href: "/records" });
  });

  it("falls back after a refresh even when the loaded path was not captured", () => {
    expect(backAction({ path: "/settings", canGoBack: true, reloaded: true })).toEqual({ kind: "replace", href: "/chat" });
    expect(backAction({ path: "/packet", canGoBack: true, reloaded: true })).toEqual({ kind: "replace", href: "/records" });
  });

  it("still pops after an in-app push when the document itself was refreshed earlier", () => {
    captureLoadedPath("/chat");
    expect(backAction({ path: "/settings", canGoBack: true, reloaded: true })).toEqual({ kind: "back" });
  });
});
