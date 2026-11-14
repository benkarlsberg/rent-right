import { describe, expect, it } from "vitest";
import { answerQuestion, selectRules } from "@/lib/rules/assistant";
import { detectPlace } from "@/lib/rules/detect";
import { depositReturnDeadline, repairReminder, retaliationWindow } from "@/lib/rules/engine";
import { lawStateOf, stateRentAnswer } from "@/lib/rules/states";

describe("added state coverage", () => {
  it("classifies covered states and leaves New York unsupported", () => {
    expect(detectPlace({ city: "Phoenix", region: "AZ", postalCode: "85004" }).jurisdiction).toBe("az");
    expect(detectPlace({ city: "Las Vegas", region: "NV", postalCode: "89101" }).jurisdiction).toBe("nv");
    expect(detectPlace({ city: "Portland", region: "OR", postalCode: "97201" }).jurisdiction).toBe("or");
    expect(detectPlace({ city: "Seattle", region: "WA", postalCode: "98101" }).jurisdiction).toBe("wa");
    expect(detectPlace({ city: "Houston", region: "TX", postalCode: "77002" }).jurisdiction).toBe("tx");
    expect(detectPlace({ city: "Miami", region: "FL", postalCode: "33101" }).jurisdiction).toBe("fl");
    expect(detectPlace({ city: "New York", region: "NY", postalCode: "10001" }).jurisdiction).toBe("city_nyc");
    expect(detectPlace({ city: "Chicago", region: "IL", postalCode: "60601" }).jurisdiction).toBe("il");
    expect(detectPlace({ city: "Boston", region: "MA", postalCode: "02108" }).jurisdiction).toBe("ma");
    expect(detectPlace({ city: "Charlotte", region: "NC", postalCode: "28202" }).jurisdiction).toBe("nc");
    expect(detectPlace({ city: "Philadelphia", region: "PA", postalCode: "19103" }).jurisdiction).toBe("pa");
    expect(detectPlace({ city: "Columbus", region: "OH", postalCode: "43215" }).jurisdiction).toBe("oh");
    expect(detectPlace({ city: "Washington", region: "DC", postalCode: "20001" }).jurisdiction).toBe("dc");
    expect(detectPlace({ city: "Los Angeles", region: "CA", postalCode: "90026" }).jurisdiction).toBe("city_la");
    expect(detectPlace({ city: "Detroit", region: "MI", postalCode: "48201" }).jurisdiction).toBe("mi");
    expect(detectPlace({ city: "Richmond", region: "VA", postalCode: "23219" }).jurisdiction).toBe("va");
    expect(detectPlace({ city: "Baltimore", region: "MD", postalCode: "21201" }).jurisdiction).toBe("md");
    expect(detectPlace({ city: "Minneapolis", region: "MN", postalCode: "55401" }).jurisdiction).toBe("mn");
    expect(detectPlace({ city: "Milwaukee", region: "WI", postalCode: "53202" }).jurisdiction).toBe("wi");
    expect(detectPlace({ address: "1 Peachtree St, Atlanta, GA 30303" }).jurisdiction).toBe("unsupported");
  });

  it("counts Arizona deposit days without weekends or the observed July 4 holiday", () => {
    const due = depositReturnDeadline("2026-07-02", "AZ");
    expect(due.ruleId).toBe("AZ-ARS-33-1321");
    expect(due.citation).not.toContain("1950.5");
    expect(due.dueDate).toBe("2026-07-23");
    expect(due.explanation).toContain("14 days");
    expect(due.explanation).not.toContain("21 calendar");
  });

  it("uses each state's deposit count and does not borrow California", () => {
    expect(depositReturnDeadline("2026-09-01", "NV")).toMatchObject({ dueDate: "2026-10-01", ruleId: "NV-NRS-118A.242" });
    expect(depositReturnDeadline("2026-09-01", "OR")).toMatchObject({ dueDate: "2026-10-02", ruleId: "OR-ORS-90.300" });
    expect(depositReturnDeadline("2026-09-01", "WA")).toMatchObject({ dueDate: "2026-10-01", ruleId: "WA-RCW-59.18.280" });
    expect(depositReturnDeadline("2026-09-01", "TX")).toMatchObject({ dueDate: "2026-10-01", ruleId: "TX-PROP-92.103" });
    expect(depositReturnDeadline("2026-09-01", "TX").explanation).toContain("92.107");
    expect(depositReturnDeadline("2026-09-01", "FL").dueDate).toBeNull();
    expect(depositReturnDeadline("2026-09-01", "FL").unsure).toBe(true);
    expect(depositReturnDeadline("2026-09-01").ruleId).toBe("CA-CC-1950.5");
    expect(depositReturnDeadline("2026-09-01", "WA").explanation).not.toContain("§1950.5");
  });

  it("uses Washington's 10-day repair period and does not store an hour-based date", () => {
    const ordinary = repairReminder("2026-10-01", "leak", undefined, "WA");
    expect(ordinary.dueDate).toBe("2026-10-11");
    expect(ordinary.ruleId).toBe("WA-RCW-59.18.070");
    expect(ordinary.explanation).not.toContain("§1942");
    const heat = repairReminder("2026-10-01", "no_heat", undefined, "WA");
    expect(heat.dueDate).toBeNull();
    expect(heat.unsure).toBe(true);
    expect(heat.explanation).toContain("24 hours");
  });

  it("uses Arizona's five-day health period and ten-day other period from receipt", () => {
    expect(repairReminder("2026-10-01", "no_heat", undefined, "AZ").dueDate).toBe("2026-10-06");
    const leak = repairReminder("2026-10-01", "leak", undefined, "AZ");
    expect(leak.dueDate).toBe("2026-10-11");
    expect(leak.explanation).toContain("not permission to withhold rent");
    expect(repairReminder("2026-10-01", "leak", undefined, "NV").dueDate).toBe("2026-10-15");
    expect(repairReminder("2026-10-01", "no_heat", undefined, "OR").dueDate).toBe("2026-10-08");
    expect(repairReminder("2026-10-01", "leak", undefined, "OR").dueDate).toBe("2026-10-31");
    const texas = repairReminder("2026-10-01", "leak", undefined, "TX");
    expect(texas.dueDate).toBe("2026-10-08");
    expect(texas.unsure).toBe(true);
    expect(texas.explanation).toContain("not permission");
    expect(repairReminder("2026-10-01", "leak", undefined, "FL").dueDate).toBeNull();
  });

  it("does not apply California's 180-day retaliation window outside California", () => {
    const activity = "2026-01-01";
    const later = "2026-06-01";
    expect(retaliationWindow(activity, later, "NV").flagged).toBe(false);
    expect(retaliationWindow(activity, later, "NV").explanation).not.toContain("§1942.5");
    expect(retaliationWindow(activity, later, "OR").flagged).toBe(false);
    expect(retaliationWindow(activity, "2026-04-01", "WA").flagged).toBe(true);
    expect(retaliationWindow(activity, "2026-04-02", "WA").flagged).toBe(false);
    expect(retaliationWindow(activity, "2026-07-01", "AZ").flagged).toBe(true);
    expect(retaliationWindow(activity, "2026-07-02", "AZ").flagged).toBe(false);
    expect(retaliationWindow(activity, "2026-07-01", "TX").flagged).toBe(true);
    expect(retaliationWindow(activity, "2026-07-02", "TX").flagged).toBe(false);
    expect(retaliationWindow(activity, later, "FL").flagged).toBe(false);
    expect(retaliationWindow(activity, later).ruleId).toBe("CA-CC-1942.5");
  });

  it("answers a Washington rent question from Washington rules only", () => {
    const selected = selectRules("Is a rent increase over 10 percent allowed?", "WA");
    expect(selected.rules.every((item) => item.jurisdiction === "WA")).toBe(true);
    expect(selected.rules.some((item) => item.id.startsWith("CA-"))).toBe(false);
    const answer = answerQuestion("Is a rent increase over 10 percent allowed?", "en", "WA");
    expect(answer.text).not.toContain("Civil Code");
    expect(answer.ruleIds).toContain("WA-RCW-59.18.700");
  });

  it("keeps an old Los Angeles jurisdiction on California law", () => {
    expect(lawStateOf({ jurisdiction: "city_la", supported: true })).toBe("CA");
    expect(depositReturnDeadline("2026-01-10").ruleId).toBe("CA-CC-1950.5");
    expect(detectPlace({ city: "Los Angeles", region: "CA", postalCode: "90026" }).jurisdiction).toBe("city_la");
  });

  it("does not invent an Arizona deposit date outside the loaded holiday years", () => {
    expect(depositReturnDeadline("2025-07-02", "AZ").dueDate).toBeNull();
    expect(depositReturnDeadline("2025-07-02", "AZ").unsure).toBe(true);
    expect(depositReturnDeadline("2028-03-01", "AZ").dueDate).toBeNull();
  });

  it("states Arizona's termination notice without grading a rent increase against it", () => {
    const note = stateRentAnswer({
      state: "AZ",
      lowestCents: 200_000,
      proposedCents: 220_000,
      noticeDate: "2026-10-01",
      effectiveDate: "2026-11-15",
      weekToWeek: false,
      firstYear: null,
      claimsExemption: false,
    });
    expect(note.abovePublishedMax).toBe(false);
    expect(note.detailEn).toContain("33-1375");
    expect(note.detailEn).toContain("30 days");
    expect(note.detailEn).toContain("did not treat");
    expect(note.detailEn).not.toContain("meets");
  });

  it("does not call a 2026 Oregon increase above 9.5 percent lawful when exemptions are unknown", () => {
    const note = stateRentAnswer({
      state: "OR",
      lowestCents: 200_000,
      proposedCents: 230_000,
      noticeDate: "2026-09-01",
      effectiveDate: "2026-12-15",
      weekToWeek: false,
      firstYear: null,
      claimsExemption: false,
      homeKind: "dwelling",
    });
    expect(note.abovePublishedMax).toBe(true);
    expect(note.detailEn).toContain("9.5%");
    expect(note.detailEn).toContain("not a finding");
    expect(note.detailEn).not.toContain("1947.12");
    const exempt = stateRentAnswer({ ...{
      state: "OR" as const,
      lowestCents: 200_000,
      proposedCents: 230_000,
      noticeDate: "2026-09-01",
      effectiveDate: "2026-12-15",
      weekToWeek: false,
      firstYear: null,
      claimsExemption: true,
      homeKind: "dwelling" as const,
    } });
    expect(exempt.abovePublishedMax).toBe(false);
    expect(exempt.detailEn).toContain("exemption was marked");
    const nextYear = stateRentAnswer({
      state: "OR",
      lowestCents: 200_000,
      proposedCents: 230_000,
      noticeDate: "2026-11-01",
      effectiveDate: "2027-03-01",
      weekToWeek: false,
      firstYear: false,
      claimsExemption: false,
      homeKind: "dwelling",
    });
    expect(nextYear.abovePublishedMax).toBe(false);
    expect(nextYear.detailEn).toContain("was not used");
    expect(nextYear.detailEn).not.toContain("not above the 9.5%");
    const unknownHome = stateRentAnswer({
      state: "OR",
      lowestCents: 200_000,
      proposedCents: 230_000,
      noticeDate: "2026-09-01",
      effectiveDate: "2026-12-15",
      weekToWeek: false,
      firstYear: null,
      claimsExemption: false,
    });
    expect(unknownHome.abovePublishedMax).toBe(false);
    expect(unknownHome.detailEn).toContain("90.505");
  });

  it("keeps a boundary deposit date on the statute's own count", () => {
    expect(depositReturnDeadline("2026-01-10", "WA").dueDate).toBe("2026-02-09");
    expect(depositReturnDeadline("2026-01-31", "OR").dueDate).toBe("2026-03-03");
    expect(depositReturnDeadline("2024-02-10", "NV").dueDate).toBe("2024-03-11");
  });

  it("does not use the Washington dwelling cap for a manufactured-home lot or an unknown home", () => {
    const shared = {
      lowestCents: 200_000,
      proposedCents: 220_000,
      noticeDate: "2026-08-01",
      effectiveDate: "2026-11-15",
      weekToWeek: false,
      firstYear: false as boolean | null,
      claimsExemption: false,
    };
    const lot = stateRentAnswer({ state: "WA", ...shared, homeKind: "manufactured_lot" });
    expect(lot.ruleId).toBe("WA-RCW-59.20.370");
    expect(lot.abovePublishedMax).toBe(true);
    expect(lot.detailEn).toContain("5%");
    expect(lot.detailEn).not.toContain("9.683%");
    const unknown = stateRentAnswer({ state: "WA", ...shared });
    expect(unknown.abovePublishedMax).toBe(false);
    expect(unknown.detailEn).toContain("was not entered");
    const later = stateRentAnswer({
      state: "WA",
      ...shared,
      effectiveDate: "2028-02-01",
      homeKind: "dwelling",
    });
    expect(later.abovePublishedMax).toBe(false);
    expect(later.detailEn).toContain("no cap comparison was made");
  });

  it("keeps Texas and Florida rent answers off California and off a graded notice period", () => {
    const shared = {
      lowestCents: 200_000,
      proposedCents: 240_000,
      noticeDate: "2026-09-01",
      effectiveDate: "2026-09-20",
      weekToWeek: false,
      firstYear: null,
      claimsExemption: false,
    };
    const texas = stateRentAnswer({ state: "TX", ...shared });
    expect(texas.abovePublishedMax).toBe(false);
    expect(texas.detailEn).toContain("does not cap");
    expect(texas.detailEn).not.toContain("1950.5");
    expect(selectRules("Can the landlord raise my rent?", "TX").rules.every((item) => item.jurisdiction === "TX")).toBe(true);
    const florida = stateRentAnswer({ state: "FL", ...shared });
    expect(florida.abovePublishedMax).toBe(false);
    expect(florida.detailEn).toContain("83.57");
    expect(florida.detailEn).toContain("were not graded");
    expect(selectRules("Is a rent increase allowed?", "FL").rules.some((item) => item.id.startsWith("CA-"))).toBe(false);
    expect(selectRules("security deposit return", "CA").rules.some((item) => item.id.startsWith("TX-") || item.id.startsWith("FL-"))).toBe(false);
  });

  it("uses the opened clocks for the second batch and leaves Georgia uncovered", () => {
    expect(depositReturnDeadline("2026-09-01", "NY")).toMatchObject({ dueDate: "2026-09-15", ruleId: "NY-GOL-7-108", unsure: true });
    expect(depositReturnDeadline("2026-09-01", "NY").explanation).toContain("7-107");
    expect(depositReturnDeadline("2026-09-01", "IL").dueDate).toBeNull();
    expect(depositReturnDeadline("2026-09-01", "MA").dueDate).toBe("2026-10-01");
    expect(depositReturnDeadline("2026-09-01", "OH").dueDate).toBe("2026-10-01");
    expect(depositReturnDeadline("2026-09-01", "DC").dueDate).toBeNull();
    const ohioRepair = repairReminder("2026-10-01", "leak", undefined, "OH");
    expect(ohioRepair.dueDate).toBe("2026-10-31");
    expect(ohioRepair.unsure).toBe(true);
    expect(ohioRepair.explanation).toContain("not permission to withhold rent");
    expect(repairReminder("2026-10-01", "leak", undefined, "NY").dueDate).toBeNull();
    expect(repairReminder("2026-10-01", "co_alarm", undefined, "NC").dueDate).toBe("2026-10-16");
    expect(repairReminder("2026-10-01", "leak", undefined, "DC").explanation).toContain("not funded");
    expect(retaliationWindow("2026-01-01", "2026-12-01", "NY").flagged).toBe(true);
    expect(retaliationWindow("2026-01-01", "2027-01-02", "NY").flagged).toBe(false);
    expect(retaliationWindow("2026-01-01", "2026-06-01", "MA").flagged).toBe(true);
    expect(retaliationWindow("2026-01-01", "2026-07-02", "MA").flagged).toBe(false);
    expect(retaliationWindow("2026-01-01", "2026-06-01", "OH").flagged).toBe(false);
    const nyRent = stateRentAnswer({
      state: "NY",
      lowestCents: 200_000,
      proposedCents: 220_000,
      noticeDate: "2026-09-01",
      effectiveDate: "2026-09-20",
      weekToWeek: false,
      firstYear: null,
      claimsExemption: false,
    });
    expect(nyRent.abovePublishedMax).toBe(false);
    expect(nyRent.detailEn).toContain("no notice period was graded");
    expect(nyRent.detailEn).toContain("rent stabilization");
    const dcRent = stateRentAnswer({
      state: "DC",
      lowestCents: 200_000,
      proposedCents: 230_000,
      noticeDate: null,
      effectiveDate: "2026-12-01",
      weekToWeek: false,
      firstYear: null,
      claimsExemption: false,
    });
    expect(dcRent.abovePublishedMax).toBe(false);
    expect(dcRent.detailEn).toContain("did not apply");
    expect(selectRules("Can the landlord raise my rent?", "NY").rules.some((item) => item.id.startsWith("CA-"))).toBe(false);
    expect(selectRules("security deposit return", "CA").rules.some((item) => item.jurisdiction === "NY" || item.jurisdiction === "DC")).toBe(false);
    expect(lawStateOf({ jurisdiction: "city_la", supported: true })).toBe("CA");
  });

  it("loads New York City rules without assuming rent stabilization", () => {
    expect(detectPlace({ city: "Brooklyn", region: "NY", postalCode: "11201" }).jurisdiction).toBe("city_nyc");
    expect(detectPlace({ city: "Buffalo", region: "NY", postalCode: "14201" }).jurisdiction).toBe("ny");
    expect(lawStateOf({ jurisdiction: "city_nyc", supported: true })).toBe("NY");
    const shared = {
      state: "NY" as const,
      lowestCents: 200_000,
      proposedCents: 220_000,
      noticeDate: "2026-09-01",
      effectiveDate: "2026-11-01",
      weekToWeek: false,
      firstYear: null,
      claimsExemption: false,
      inNewYorkCity: true,
    };
    const unknown = stateRentAnswer(shared);
    expect(unknown.abovePublishedMax).toBe(false);
    expect(unknown.detailEn).toContain("not confirmed");
    expect(unknown.detailEn).toContain("0%");
    const confirmed = stateRentAnswer({ ...shared, stabilized: "yes" });
    expect(confirmed.abovePublishedMax).toBe(true);
    expect(confirmed.detailEn).not.toContain("illegal");
    const older = stateRentAnswer({ ...shared, effectiveDate: "2026-01-15", stabilized: "yes" });
    expect(older.abovePublishedMax).toBe(false);
    expect(older.detailEn).toContain("lease length was not entered");
    const outside = stateRentAnswer({ ...shared, effectiveDate: "2028-02-01", stabilized: "yes" });
    expect(outside.abovePublishedMax).toBe(false);
    expect(outside.detailEn).toContain("was not used");
    expect(selectRules("rent stabilization increase", "NY").rules.some((item) => item.jurisdiction === "CITY_NYC")).toBe(false);
    expect(selectRules("rent stabilization increase", "NY", "city_nyc").rules.some((item) => item.id === "NYC-RGB-ORDER")).toBe(true);
    expect(selectRules("rent stabilization increase", "CA").rules.some((item) => item.jurisdiction === "CITY_NYC")).toBe(false);
  });

  it("uses the opened clocks for Michigan, Virginia, Maryland, Minnesota, and Wisconsin", () => {
    expect(depositReturnDeadline("2026-09-01", "MI")).toMatchObject({ dueDate: "2026-10-01", unsure: true, ruleId: "MI-554.609" });
    expect(depositReturnDeadline("2026-09-01", "VA").dueDate).toBe("2026-10-16");
    expect(depositReturnDeadline("2026-09-01", "MD").dueDate).toBe("2026-10-16");
    expect(depositReturnDeadline("2026-09-01", "MN")).toMatchObject({ dueDate: "2026-09-22", unsure: true });
    expect(depositReturnDeadline("2026-09-01", "WI").dueDate).toBe("2026-09-22");
    for (const state of ["MI", "VA", "MD", "MN", "WI"] as const) {
      const repair = repairReminder("2026-10-01", "leak", undefined, state);
      expect(repair.dueDate).toBeNull();
      expect(repair.explanation.toLowerCase()).toContain("not permission to withhold rent");
    }
    expect(retaliationWindow("2026-01-01", "2026-04-01", "MN").flagged).toBe(true);
    expect(retaliationWindow("2026-01-01", "2026-04-02", "MN").flagged).toBe(false);
    expect(retaliationWindow("2026-01-01", "2026-07-01", "MD").flagged).toBe(true);
    expect(retaliationWindow("2026-01-01", "2026-07-02", "MD").flagged).toBe(false);
    expect(retaliationWindow("2026-01-01", "2026-03-01", "MI").flagged).toBe(false);
    expect(retaliationWindow("2026-01-01", "2026-03-01", "VA").flagged).toBe(false);
    expect(retaliationWindow("2026-01-01", "2026-03-01", "WI").flagged).toBe(false);
    const shared = {
      lowestCents: 200_000,
      proposedCents: 230_000,
      noticeDate: "2026-09-01",
      effectiveDate: "2026-10-01",
      weekToWeek: false,
      firstYear: null,
      claimsExemption: false,
    };
    expect(stateRentAnswer({ state: "VA", ...shared }).detailEn).toContain("60 days");
    expect(stateRentAnswer({ state: "VA", ...shared }).abovePublishedMax).toBe(false);
    expect(stateRentAnswer({ state: "MD", ...shared }).detailEn).toContain("Montgomery County");
    expect(stateRentAnswer({ state: "MN", ...shared }).detailEn).toContain("Minneapolis");
    expect(stateRentAnswer({ state: "WI", ...shared }).detailEn).toContain("704.19");
    expect(selectRules("security deposit", "CA").rules.some((item) => item.jurisdiction === "MI" || item.jurisdiction === "WI")).toBe(false);
    expect(detectPlace({ address: "1 Peachtree St, Atlanta, GA 30303" }).jurisdiction).toBe("unsupported");
  });

  it("uses the opened clocks for Indiana, South Carolina, Connecticut, and Iowa", () => {
    expect(detectPlace({ city: "Indianapolis", region: "IN", postalCode: "46204" }).jurisdiction).toBe("in");
    expect(detectPlace({ city: "Columbia", region: "SC", postalCode: "29201" }).jurisdiction).toBe("sc");
    expect(detectPlace({ city: "Hartford", region: "CT", postalCode: "06103" }).jurisdiction).toBe("ct");
    expect(detectPlace({ city: "Des Moines", region: "IA", postalCode: "50309" }).jurisdiction).toBe("ia");
    expect(depositReturnDeadline("2026-09-01", "IN")).toMatchObject({ dueDate: "2026-10-16", unsure: true });
    expect(depositReturnDeadline("2026-09-01", "CT").dueDate).toBeNull();
    expect(depositReturnDeadline("2026-09-01", "IA").explanation).toContain("two months");
    for (const state of ["IN", "SC", "CT", "IA"] as const) {
      expect(repairReminder("2026-10-01", "leak", undefined, state).explanation.toLowerCase()).toContain("not permission to withhold rent");
    }
    expect(retaliationWindow("2026-01-01", "2026-07-01", "CT").flagged).toBe(true);
    expect(retaliationWindow("2026-01-01", "2027-01-01", "IA").flagged).toBe(true);
    expect(retaliationWindow("2026-01-01", "2026-06-01", "IN").flagged).toBe(false);
    expect(stateRentAnswer({ state: "CT", lowestCents: 100_000, proposedCents: 110_000, noticeDate: null, effectiveDate: "2026-12-01", weekToWeek: false, firstYear: null, claimsExemption: false }).detailEn).toContain("45 days");
    expect(stateRentAnswer({ state: "IA", lowestCents: 100_000, proposedCents: 110_000, noticeDate: null, effectiveDate: "2026-12-01", weekToWeek: false, firstYear: null, claimsExemption: false }).abovePublishedMax).toBe(false);
    expect(detectPlace({ city: "Birmingham", region: "AL", postalCode: "35203" }).jurisdiction).toBe("unsupported");
  });

  it("uses the opened clocks for Kansas, Nebraska, Hawaii, New Hampshire, Idaho, and West Virginia", () => {
    expect(detectPlace({ city: "Wichita", region: "KS", postalCode: "67202" }).jurisdiction).toBe("ks");
    expect(detectPlace({ city: "Omaha", region: "NE", postalCode: "68102" }).jurisdiction).toBe("ne");
    expect(detectPlace({ city: "Honolulu", region: "HI", postalCode: "96813" }).jurisdiction).toBe("hi");
    expect(detectPlace({ city: "Manchester", region: "NH", postalCode: "03101" }).jurisdiction).toBe("nh");
    expect(detectPlace({ city: "Boise", region: "ID", postalCode: "83702" }).jurisdiction).toBe("id");
    expect(detectPlace({ city: "Charleston", region: "WV", postalCode: "25301" }).jurisdiction).toBe("wv");
    expect(depositReturnDeadline("2026-09-01", "NE")).toMatchObject({ dueDate: "2026-09-15", unsure: false });
    expect(depositReturnDeadline("2026-09-01", "HI")).toMatchObject({ dueDate: "2026-09-15", unsure: false });
    expect(depositReturnDeadline("2026-09-01", "KS")).toMatchObject({ dueDate: "2026-10-01", unsure: true });
    expect(depositReturnDeadline("2026-09-01", "WV").dueDate).toBeNull();
    for (const state of ["KS", "NE", "HI", "NH", "ID", "WV"] as const) {
      expect(repairReminder("2026-10-01", "leak", undefined, state).explanation.toLowerCase()).toContain("not permission to withhold rent");
    }
    expect(retaliationWindow("2026-01-01", "2026-07-01", "NH").flagged).toBe(true);
    expect(retaliationWindow("2026-01-01", "2026-07-02", "NH").flagged).toBe(false);
    expect(retaliationWindow("2026-01-01", "2026-06-01", "KS").flagged).toBe(false);
    expect(stateRentAnswer({ state: "HI", lowestCents: 100_000, proposedCents: 110_000, noticeDate: null, effectiveDate: "2026-12-01", weekToWeek: false, firstYear: null, claimsExemption: false }).detailEn).toContain("45");
    expect(stateRentAnswer({ state: "ID", lowestCents: 100_000, proposedCents: 110_000, noticeDate: null, effectiveDate: "2026-12-01", weekToWeek: false, firstYear: null, claimsExemption: false }).detailEn).toContain("30 days");
    expect(stateRentAnswer({ state: "WV", lowestCents: 100_000, proposedCents: 110_000, noticeDate: null, effectiveDate: "2026-12-01", weekToWeek: false, firstYear: null, claimsExemption: false }).abovePublishedMax).toBe(false);
    expect(detectPlace({ city: "Little Rock", region: "AR", postalCode: "72201" }).jurisdiction).toBe("unsupported");
  });
});
