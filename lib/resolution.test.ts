import { describe, expect, it } from "vitest";
import { issueTitle, isResolvedClaim, matchOpenIssue, resolutionPhrase, resolutionSpan, resolutionTimestamp, timelineSummary } from "@/lib/resolution";

const reported = "2026-10-01T18:00:00.000Z";

describe("resolution duration", () => {
  it("uses hours under a day and days after that", () => {
    expect(resolutionSpan(reported, "2026-10-01T18:20:00.000Z")).toEqual({ unit: "hours", count: 0 });
    expect(resolutionSpan(reported, "2026-10-01T19:00:00.000Z")).toEqual({ unit: "hours", count: 1 });
    expect(resolutionSpan(reported, "2026-10-01T20:30:00.000Z")).toEqual({ unit: "hours", count: 2 });
    expect(resolutionSpan(reported, "2026-10-02T17:00:00.000Z")).toEqual({ unit: "hours", count: 23 });
    expect(resolutionSpan(reported, "2026-10-02T18:00:00.000Z")).toEqual({ unit: "days", count: 1 });
    expect(resolutionSpan(reported, "2026-10-06T12:00:00.000Z")).toEqual({ unit: "days", count: 5 });
    expect(resolutionSpan(reported, "2026-10-01T12:00:00.000Z")).toEqual({ unit: "hours", count: 0 });
  });

  it("phrases the duration in English and Spanish", () => {
    expect(resolutionPhrase(reported, "2026-10-01T18:20:00.000Z", "en")).toBe("Resolved in less than an hour");
    expect(resolutionPhrase(reported, "2026-10-01T19:00:00.000Z", "en")).toBe("Resolved in 1 hour");
    expect(resolutionPhrase(reported, "2026-10-01T20:30:00.000Z", "es")).toBe("Resuelto en 2 horas");
    expect(resolutionPhrase(reported, "2026-10-02T18:00:00.000Z", "en")).toBe("Resolved in 1 day");
    expect(resolutionPhrase(reported, "2026-10-06T12:00:00.000Z", "en")).toBe("Resolved in 5 days");
    expect(resolutionPhrase(reported, "2026-10-06T12:00:00.000Z", "es")).toBe("Resuelto en 5 días");
  });

  it("accepts an earlier resolution date and rejects dates outside the request", () => {
    const now = new Date("2026-10-23T20:00:00.000Z");
    expect(resolutionTimestamp({ reportedAt: reported, eventDate: "2026-10-01", chosen: "2026-10-06", now })).toBe("2026-10-06T12:00:00.000Z");
    expect(resolutionTimestamp({ reportedAt: reported, eventDate: "2026-10-01", chosen: null, now })).toBe(now.toISOString());
    expect(() => resolutionTimestamp({ reportedAt: reported, eventDate: "2026-10-01", chosen: "2026-10-24", now })).toThrow(/future/);
    expect(() => resolutionTimestamp({ reportedAt: reported, eventDate: "2026-10-01", chosen: "2026-09-30", now })).toThrow(/before/);
    expect(() => resolutionTimestamp({ reportedAt: reported, eventDate: "2026-10-01", chosen: "2026-02-31", now })).toThrow(/real date/);
  });

  it("matches the open request the tenant named", () => {
    const sink = { id: "sink", description: "Kitchen sink leak.", room: "Kitchen" };
    const heat = { id: "heat", description: "No heat in the bedroom.", room: "Bedroom" };
    expect(matchOpenIssue("the sink is fixed", [sink])?.id).toBe("sink");
    expect(matchOpenIssue("the sink is fixed", [sink, heat])?.id).toBe("sink");
    expect(matchOpenIssue("it is fixed", [sink, heat])).toBeNull();
    expect(isResolvedClaim("the sink is fixed")).toBe(true);
    expect(isResolvedClaim("my sink is leaking")).toBe(false);
    expect(isResolvedClaim("I'd like to request a fix")).toBe(false);
    expect(issueTitle("Kitchen sink leak. Water under the cabinet.")).toBe("Kitchen sink leak");
    expect(timelineSummary({
      locale: "en",
      reportedLabel: "Oct 1, 2026",
      messages: 1,
      replies: 1,
      sourceLabel: "Tenant marked",
      resolvedLabel: "Oct 6, 2026",
    })).toBe("Reported Oct 1, 2026 · 1 message · 1 reply · Tenant marked · Oct 6, 2026");
  });
});
