import { readdirSync, readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { DISCLAIMER_EN } from "@/lib/disclaimer";
import { chainHash, GENESIS_HASH } from "@/lib/hash";
import { answerFromModelIds, answerQuestion, selectRules } from "@/lib/rules/assistant";
import { addDays } from "@/lib/rules/dates";
import {
  ab1482Quote,
  applyPpm,
  checkRentIncrease,
  depositReturnDeadline,
  entryNoticeCheck,
  increasePpm,
  inferJurisdiction,
  laRsoQuote,
  noticePeriodDays,
  pendingReminderSlots,
  repairReminder,
  retaliationWindow,
  rstpoQuote,
  threeDayNoticeDeadline,
  twelveMonthEarliest,
} from "@/lib/rules/engine";
import { libraryIntegrityErrors, RULES } from "@/lib/rules/library";
import { mergeModelFindings, redactPii, reviewLease } from "@/lib/lease/review";

describe("rules library", () => {
  it("is internally consistent and marked for clinic review", () => {
    expect(libraryIntegrityErrors()).toEqual([]);
    expect(RULES.length).toBeGreaterThan(15);
    for (const rule of RULES) {
      expect(rule.placeholder).toBe(true);
      expect(rule.clinicReview).toBe("pending_clinic_review");
    }
  });

  it("uses the required disclaimer wording", () => {
    expect(DISCLAIMER_EN).toBe(
      "This is general legal information, not legal advice, and no attorney-client relationship is created. Laws change and depend on your facts. For advice, contact a licensed California attorney or legal aid.",
    );
  });
});

describe("deposit and repair deadlines", () => {
  it("adds 21 calendar days", () => {
    expect(depositReturnDeadline("2026-01-10").dueDate).toBe("2026-01-31");
    expect(depositReturnDeadline("2026-01-20").dueDate).toBe("2026-02-10");
    expect(depositReturnDeadline("2024-02-10").dueDate).toBe("2024-03-02");
    expect(depositReturnDeadline("2026-01-10").ruleId).toBe("CA-CC-1950.5");
    expect(depositReturnDeadline("2026-01-10").computation).toContain("+ 21 calendar days");
  });

  it("uses the 30-day presumption and shorter presets for urgent conditions", () => {
    const ordinary = repairReminder("2026-10-01", "other");
    expect(ordinary.dueDate).toBe("2026-10-31");
    expect(ordinary.explanation).toContain("§1942");
    const urgent = repairReminder("2026-10-01", "no_heat");
    expect(urgent.dueDate).toBe("2026-10-04");
    expect(urgent.explanation).toMatch(/not in the statute/i);
    expect(repairReminder("2026-10-01", "leak").dueDate).toBe("2026-10-08");
  });

  it("checks 24-hour entry notice from the timestamps entered", () => {
    const ok = entryNoticeCheck("2026-10-01T15:00:00.000Z", "2026-10-02T16:00:00.000Z");
    expect(ok.atLeast24).toBe(true);
    const early = entryNoticeCheck("2026-10-01T15:00:00.000Z", "2026-10-02T10:00:00.000Z");
    expect(early.atLeast24).toBe(false);
    expect(early.ruleId).toBe("CA-CC-1954");
  });
});

describe("three-day notices", () => {
  it("skips the weekend and does not count the service date", () => {
    const result = threeDayNoticeDeadline("2026-10-09");
    expect(result.unsure).toBe(false);
    expect(result.dueDate).toBe("2026-10-14");
    expect(result.computation).toContain("2026-10-12");
  });

  it("skips a listed judicial holiday", () => {
    const result = threeDayNoticeDeadline("2026-03-26");
    expect(result.dueDate).toBe("2026-04-01");
    expect(result.computation).not.toContain("Counted 2026-03-31");
  });

  it("refuses a date outside the placeholder calendar", () => {
    const result = threeDayNoticeDeadline("2028-01-03");
    expect(result.unsure).toBe(true);
    expect(result.dueDate).toBeNull();
  });
});

describe("rent increase math", () => {
  it("sets 30 days at 10 percent and 90 days above it", () => {
    expect(noticePeriodDays(200_000, 220_000).requiredDays).toBe(30);
    expect(noticePeriodDays(200_000, 220_001).requiredDays).toBe(90);
    expect(increasePpm(200_000, 220_000)).toBe(100_000);
  });

  it("counts a 12-month gap on the calendar", () => {
    expect(twelveMonthEarliest("2025-08-01")).toBe("2026-08-01");
    expect(twelveMonthEarliest("2025-01-31")).toBe("2026-01-31");
  });

  it("reads the AB 1482 chart and does not invent a row", () => {
    const sd = ab1482Quote("2026-09-01", "san_diego", 100_000);
    expect(sd.ppm).toBe(82_000);
    expect(sd.maxRentCents).toBe(108_200);
    const la = ab1482Quote("2026-09-01", "los_angeles_orange", 100_000);
    expect(la.ppm).toBe(87_000);
    expect(la.maxRentCents).toBe(108_700);
    expect(ab1482Quote("2024-01-01", "san_diego", 100_000).unsure).toBe(true);
  });

  it("applies LA RSO only inside published dates", () => {
    const covered = laRsoQuote("2026-09-01", 215_000);
    expect(covered.ppm).toBe(30_000);
    expect(covered.maxRentCents).toBe(221_450);
    expect(laRsoQuote("2024-05-01", 215_000).unsure).toBe(true);
  });

  it("applies the unincorporated county tiers", () => {
    expect(rstpoQuote("2026-10-01", "fully_covered", 100_000).maxRentCents).toBe(101_919);
    expect(rstpoQuote("2026-10-01", "small_landlord", 100_000).maxRentCents).toBe(102_919);
    expect(rstpoQuote("2026-10-01", "luxury", 100_000).maxRentCents).toBe(103_919);
    expect(rstpoQuote("2024-06-01", "fully_covered", 100_000).unsure).toBe(true);
  });

  it("uses the stricter City of LA cap and stays unsure when coverage is unknown", () => {
    const over = checkRentIncrease({
      jurisdiction: "city_la",
      rsoStatus: "covered",
      rstpoTier: "unsure",
      lowestRentCents: 215_000,
      proposedRentCents: 225_750,
      noticeDate: "2026-08-01",
      effectiveDate: "2026-10-01",
      lastIncreaseDate: "2025-08-01",
      claimsExemption: false,
    });
    expect(over.applicable.status).toBe("over_cap");
    expect(over.applicable.ppm).toBe(30_000);
    expect(over.applicable.maxRentCents).toBe(221_450);
    expect(over.notice.requiredDays).toBe(30);
    expect(over.notice.ok).toBe(true);
    expect(over.frequency.ok).toBe(true);
    expect(over.utilityAddonAllowed).toBe(false);
    expect(over.ab1482?.ppm).toBe(87_000);

    const unknown = checkRentIncrease({ ...overInput(), rsoStatus: "unsure" });
    expect(unknown.applicable.status).toBe("unsure");
    expect(unknown.applicable.maxRentCents).toBeNull();
  });

  it("does not treat a claimed exemption as a pass", () => {
    const result = checkRentIncrease({
      ...overInput(),
      claimsExemption: true,
    });
    expect(result.applicable.status).toBe("over_cap");
    expect(result.exemptionUnverified).toBe(true);
  });

  it("uses AB 1482 alone when the tenant says the unit is not RSO", () => {
    const result = checkRentIncrease({ ...overInput(), rsoStatus: "not_covered" });
    expect(result.applicable.status).toBe("within_cap");
    expect(result.applicable.ruleId).toBe("CA-CC-1947.12");
    expect(result.local).toBeNull();
  });

  it("quotes the Oakland chart figure and uses the statewide chart when coverage was not confirmed", () => {
    const result = checkRentIncrease({
      jurisdiction: "oakland",
      rsoStatus: "unsure",
      rstpoTier: "unsure",
      lowestRentCents: 200_000,
      proposedRentCents: 210_000,
      noticeDate: "2026-08-01",
      effectiveDate: "2026-10-01",
      lastIncreaseDate: null,
      claimsExemption: false,
      localFacts: { builtYear: 1980, housingType: "multi", unitCount: 4, subsidized: false },
    });
    expect(result.local).toBeNull();
    expect(result.ab1482?.ppm).toBe(88_000);
    expect(result.applicable.status).toBe("within_cap");
    expect(result.applicable.ruleId).toBe("CA-CC-1947.12");
    expect(result.jurisdictionNote).toMatch(/2\.3%/);
    expect(result.jurisdictionNote).toMatch(/not applied/);
  });

  it("uses the statewide chart for a California city whose ordinance is not loaded", () => {
    const result = checkRentIncrease({
      jurisdiction: "ca",
      rsoStatus: "unsure",
      rstpoTier: "unsure",
      countyArea: "san_francisco_bay",
      localOrdinanceName: "Oakland",
      lowestRentCents: 200_000,
      proposedRentCents: 210_000,
      noticeDate: "2026-08-01",
      effectiveDate: "2026-10-01",
      lastIncreaseDate: null,
      claimsExemption: false,
    });
    expect(result.local).toBeNull();
    expect(result.ab1482?.ppm).toBe(88_000);
    expect(result.applicable.ruleId).toBe("CA-CC-1947.12");
    expect(result.jurisdictionNote).toMatch(/Local rules in Oakland may add protections/);
  });

  it("does not invent a San Diego percentage cap", () => {
    const result = checkRentIncrease({
      jurisdiction: "city_sd",
      rsoStatus: "unsure",
      rstpoTier: "unsure",
      lowestRentCents: 215_000,
      proposedRentCents: 225_750,
      noticeDate: "2026-08-01",
      effectiveDate: "2026-10-01",
      lastIncreaseDate: null,
      claimsExemption: false,
    });
    expect(result.local).toBeNull();
    expect(result.applicable.status).toBe("within_cap");
    expect(result.applicable.ppm).toBe(82_000);
    expect(result.frequency.ok).toBe("unknown");
    expect(result.jurisdictionNote).toMatch(/not a local percentage cap/i);
  });

  it("flags a short 90-day notice and a too-soon increase", () => {
    const result = checkRentIncrease({
      jurisdiction: "city_sd",
      rsoStatus: "unsure",
      rstpoTier: "unsure",
      lowestRentCents: 200_000,
      proposedRentCents: 230_000,
      noticeDate: "2026-08-01",
      effectiveDate: "2026-09-01",
      lastIncreaseDate: "2026-01-15",
      claimsExemption: false,
    });
    expect(result.notice.requiredDays).toBe(90);
    expect(result.notice.ok).toBe(false);
    expect(result.frequency.ok).toBe(false);
    expect(result.frequency.earliest).toBe("2027-01-15");
  });

  it("rounds caps in integer cents", () => {
    expect(applyPpm(215_000, 30_000)).toBe(221_450);
    expect(applyPpm(100_000, 19_190)).toBe(101_919);
  });
});

function overInput() {
  return {
    jurisdiction: "city_la" as const,
    rsoStatus: "covered" as const,
    rstpoTier: "unsure" as const,
    lowestRentCents: 215_000,
    proposedRentCents: 225_750,
    noticeDate: "2026-08-01",
    effectiveDate: "2026-10-01",
    lastIncreaseDate: "2025-08-01",
    claimsExemption: false,
  };
}

describe("retaliation window and reminders", () => {
  it("flags day 180 and not day 181", () => {
    const activity = "2026-01-01";
    const day180 = addDays(activity, 180);
    expect(retaliationWindow(activity, day180).flagged).toBe(true);
    expect(retaliationWindow(activity, day180).daysSince).toBe(180);
    expect(retaliationWindow(activity, addDays(activity, 181)).flagged).toBe(false);
    expect(retaliationWindow(activity, day180).explanation).toMatch(/does not decide|not a finding/i);
  });

  it("sends the 7, 3, and due-day reminders only on those days", () => {
    const due = "2026-10-20";
    expect(pendingReminderSlots(due, "2026-10-13", [])).toEqual(["7d"]);
    expect(pendingReminderSlots(due, "2026-10-17", [])).toEqual(["3d"]);
    expect(pendingReminderSlots(due, "2026-10-20", [])).toEqual(["0d"]);
    expect(pendingReminderSlots(due, "2026-10-15", [])).toEqual([]);
    expect(pendingReminderSlots(due, "2026-10-13", ["7d"])).toEqual([]);
  });
});

describe("jurisdiction hints", () => {
  it("does not treat a named city as City of LA or City of SD", () => {
    expect(inferJurisdiction("123 Main St, San Diego, CA").suggestion).toBe("city_sd");
    expect(inferJurisdiction("123 Main St, Los Angeles, CA").suggestion).toBe("city_la");
    expect(inferJurisdiction("123 Main St, Santa Monica, CA").suggestion).toBe("santa-monica");
    expect(inferJurisdiction("unincorporated Los Angeles County").suggestion).toBe("la_county_unincorporated");
    expect(inferJurisdiction("").suggestion).toBe("unsure");
  });
});

describe("lease review grounding", () => {
  const text = readFileSync("fixtures/sample-lease.txt", "utf8");
  const review = reviewLease(text, { monthlyRentCents: 215_000, jurisdiction: "city_la" });

  it("quotes the clause and cites a library id, or says unsure", () => {
    expect(review.disclaimer).toBe(DISCLAIMER_EN);
    expect(review.clinicReview).toBe("pending_clinic_review");
    const ids = new Set(RULES.map((rule) => rule.id));
    for (const finding of review.findings) {
      expect(finding.quote.length).toBeGreaterThan(10);
      expect(text.toLowerCase()).toContain(finding.quote.slice(0, 40).toLowerCase().replace(/\.\.\.$/, ""));
      if (finding.label === "unsure") {
        expect(finding.ruleId).toBeNull();
        expect(finding.reasonEn.toLowerCase()).toContain("unsure");
      } else {
        expect(finding.ruleId).toBeTruthy();
        expect(ids.has(finding.ruleId!)).toBe(true);
        expect(finding.citation).toBeTruthy();
      }
    }
  });

  it("flags the sample clauses the library knows", () => {
    const byRule = (id: string) => review.findings.find((finding) => finding.ruleId === id);
    expect(byRule("CA-CC-1942.1")?.label).toBe("likely_unenforceable");
    expect(byRule("CA-CC-1942.1")?.quote.toLowerCase()).toContain("no duty to repair");
    expect(byRule("CA-CC-1950.5")?.label).toBe("likely_unenforceable");
    expect(byRule("CA-CC-1954")?.quote.toLowerCase()).toContain("without notice");
    expect(byRule("CA-CASE-GRAFTON")?.label).toBe("likely_unenforceable");
    expect(byRule("CA-CC-1946.2")?.label).toBe("likely_unenforceable");
    expect(byRule("LA-JUST-CAUSE")?.ruleId).toBe("LA-JUST-CAUSE");
    expect(byRule("CA-CC-1671")?.label).toBe("check_this");
    expect(byRule("CA-CC-1717")?.label).toBe("check_this");
    expect(byRule("CA-GUIDE-ORDINARY-RENT")?.label).toBe("looks_standard");
    expect(byRule("CA-CC-1950.5-CAP")?.label).toBe("check_this");
    const useClause = review.findings.find((finding) => /unlawful purpose/i.test(finding.quote));
    expect(useClause?.label).toBe("unsure");
  });

  it("does not let a model erase a library flag or invent a rule id", () => {
    const merged = mergeModelFindings(
      review,
      text,
      [
        { quote: "Tenant waives all rights to a habitable premises", ruleId: "CA-GUIDE-ORDINARY-RENT" },
        { quote: "not in the lease", ruleId: "CA-CC-1954" },
        { quote: "Guests may stay", ruleId: "NOT-A-RULE" },
      ],
      "gemini-2.5-flash",
    );
    expect(merged.findings.some((finding) => finding.ruleId === "CA-CC-1942.1")).toBe(true);
    expect(merged.findings.some((finding) => finding.ruleId === "NOT-A-RULE")).toBe(false);
    expect(merged.model).toBe("gemini-2.5-flash");
  });

  it("redacts contact numbers before an AI call", () => {
    const redacted = redactPii("Email ada@example.com or 213-555-0199. SSN 123-45-6789.");
    expect(redacted).not.toContain("ada@example.com");
    expect(redacted).not.toContain("213-555-0199");
    expect(redacted).not.toContain("123-45-6789");
  });
});

describe("rights assistant", () => {
  it("answers a deposit question from the library", () => {
    const answer = answerQuestion("How long does my landlord have to return my security deposit?", "en");
    expect(answer.unsure).toBe(false);
    expect(answer.ruleIds).toContain("CA-CC-1950.5");
    expect(answer.text).toContain("CA-CC-1950.5");
    expect(answer.disclaimer).toBe(DISCLAIMER_EN);
    expect(answer.text.toLowerCase()).not.toContain("you should file");
  });

  it("answers the same topic in Spanish from the library text", () => {
    const answer = answerQuestion("¿Cuándo deben devolverme el depósito de seguridad?", "es");
    expect(answer.ruleIds).toContain("CA-CC-1950.5");
    expect(answer.text).toContain("21 días");
    expect(answer.spanishReview).toBe("pending_volunteer_review");
  });

  it("refuses an eviction strategy", () => {
    const answer = answerQuestion("How do I beat this eviction and what should I do?", "en");
    expect(answer.handoff).toBe(true);
    expect(answer.text).toMatch(/cannot tell you what to do/i);
    expect(answer.text.toLowerCase()).not.toContain("withhold");
  });

  it("says unsure when nothing matches", () => {
    const answer = answerQuestion("asdf qqq zzz", "en");
    expect(answer.unsure).toBe(true);
    expect(answer.ruleIds).toEqual([]);
    expect(answer.text).toMatch(/unsure/i);
  });

  it("drops model rule ids that were not retrieved", () => {
    const retrieved = selectRules("security deposit 21 days").rules;
    const answer = answerFromModelIds("security deposit 21 days", "en", retrieved, ["CA-CC-1950.5", "MADE-UP"]);
    expect(answer.ruleIds).toEqual(["CA-CC-1950.5"]);
    expect(answer.text).not.toContain("MADE-UP");
  });
});

describe("evidence hash chain", () => {
  it("changes when the payload changes and keeps the prior hash", () => {
    const first = chainHash(GENESIS_HASH, { description: "Leak under the sink", version: 1 });
    const second = chainHash(first, { description: "Leak under the sink, worse", version: 2 });
    const again = chainHash(GENESIS_HASH, { description: "Leak under the sink", version: 1 });
    expect(first).not.toBe(second);
    expect(again).toBe(first);
    expect(first).toHaveLength(64);
  });
});

describe("supabase row level security", () => {
  it("enables RLS and a policy on every tenant table", () => {
    const sql = readdirSync("supabase/migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .map((name) => readFileSync(`supabase/migrations/${name}`, "utf8"))
      .join("\n")
      .toLowerCase();
    const tables = [...sql.matchAll(/create table (?:if not exists )?public\.([a-z0-9_]+)/g)].map((match) => match[1]);
    expect(tables.length).toBeGreaterThan(5);
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`on public.${table}`);
    }
    expect(sql).not.toContain("using (true)");
    const storage = readFileSync("supabase/migrations/003_storage.sql", "utf8").toLowerCase();
    expect(storage).toContain("tenant-files");
    expect(storage).toContain("tenant_files_select");
    expect(storage).toContain("auth.uid()");
  });
});
