import { describe, expect, it } from "vitest";
import { lettersForPeople, reminderLetter, type ReminderMailItem } from "@/lib/reminder-mail";
import { renderMail } from "@/lib/email-template";

const person = "11111111-1111-4111-8111-111111111111";

function item(patch: Partial<ReminderMailItem>): ReminderMailItem {
  return {
    deadlineId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    slot: "3d",
    kind: "repair",
    date: "2026-10-30",
    issue: "The kitchen sink is leaking under the cabinet",
    userIds: [person],
    ...patch,
  };
}

describe("reminder letters", () => {
  it("names the repair and the date, and does not say tracked date", () => {
    const letter = reminderLetter([item({})]);
    expect(letter.subject).toBe("Rent Right: Repair deadline Oct 30 — kitchen sink is leaking");
    expect(letter.paragraphs[0]).toBe("The repair deadline for “The kitchen sink is leaking under the cabinet” is October 30, 2026. Follow up if that repair is still not done.");
    expect(letter.paragraphs.join("\n")).not.toMatch(/tracked date|Rule ID|days away/i);
    expect(letter.paragraphs.at(-1)).toMatch(/not sent to your landlord/i);
    const mail = renderMail({ subject: letter.subject, heading: letter.heading, paragraphs: letter.paragraphs, footer: "General information, not legal advice." });
    expect(mail.text).toContain(letter.subject.replace("Rent Right: ", ""));
    expect(mail.text).toContain("October 30, 2026");
  });

  it("sends one letter that lists two different reminders", () => {
    const letters = lettersForPeople([
      item({}),
      item({
        deadlineId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        kind: "deposit",
        date: "2026-11-17",
        issue: "",
        slot: "0d",
      }),
    ], [{ id: person, email: "ada@example.com" }]);
    expect(letters).toHaveLength(1);
    expect(letters[0].subject).toBe("Rent Right: 2 reminders for Oct 30 and Nov 17");
    expect(letters[0].paragraphs[0]).toMatch(/kitchen sink/);
    expect(letters[0].paragraphs[1]).toMatch(/deposit deadline is November 17, 2026/i);
    expect(letters[0].email).toBe("ada@example.com");
  });

  it("lists one line when two records are the same repair", () => {
    const letters = lettersForPeople([
      item({}),
      item({ deadlineId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    ], [{ id: person, email: "Ada@Example.com" }]);
    expect(letters).toHaveLength(1);
    expect(letters[0].subject).toBe("Rent Right: Repair deadline Oct 30 — kitchen sink is leaking");
    expect(letters[0].paragraphs.filter((line) => line.includes("kitchen sink"))).toHaveLength(1);
    expect(letters[0].slots).toHaveLength(2);
  });

  it("sends one letter when two profiles share an email", () => {
    const roommate = "22222222-2222-4222-8222-222222222222";
    const letters = lettersForPeople([
      item({ userIds: [person, roommate] }),
    ], [
      { id: person, email: "ada@example.com" },
      { id: roommate, email: "ada@example.com" },
    ]);
    expect(letters).toHaveLength(1);
    expect(letters[0].userIds).toEqual([person, roommate]);
  });
});
