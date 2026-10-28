const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type ReminderMailItem = {
  deadlineId: string;
  slot: string;
  kind: string;
  date: string;
  issue: string;
  userIds: string[];
};

export type ReminderLetter = {
  email: string;
  userIds: string[];
  slots: { deadlineId: string; slot: string }[];
  subject: string;
  heading: string;
  paragraphs: string[];
};

function prettyDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${SHORT_MONTHS[Number(match[2]) - 1]} ${Number(match[3])}`;
}

function longDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function shortIssue(value: string): string {
  const text = clean(value).replace(/^(the|a|an)\s+/i, "");
  if (!text) return "";
  return text.split(" ").slice(0, 4).join(" ");
}

function savedReminder(item: ReminderMailItem): boolean {
  return item.slot.startsWith("nudge:") || item.kind === "custom_reminder";
}

function itemKey(item: ReminderMailItem): string {
  return `${savedReminder(item) ? "saved" : item.kind}|${item.date}|${clean(item.issue).toLowerCase()}`;
}

function lineFor(item: ReminderMailItem): string {
  const date = longDate(item.date);
  const issue = clean(item.issue);
  if (savedReminder(item)) {
    const name = issue || "a reminder you saved";
    return `Your reminder “${name}” is ${date}. You set this date for yourself. It is not a legal deadline.`;
  }
  if (item.kind === "repair") {
    const name = issue ? `“${issue}”` : "a repair you logged";
    return `The repair deadline for ${name} is ${date}. Follow up if that repair is still not done.`;
  }
  if (item.kind === "deposit") {
    return `The deposit deadline is ${date}. That is the date for the itemized statement and any deposit still owed.`;
  }
  if (item.kind === "notice_3day") {
    const name = issue ? `“${issue}”` : "the notice you logged";
    return `The third day for ${name} is ${date}. Read that notice and decide what you need to do.`;
  }
  const name = issue ? `“${issue}”` : "a date you saved";
  return `The date for ${name} is ${date}. Open the record and see what it asks you to do.`;
}

function subjectFor(items: ReminderMailItem[]): string {
  if (items.length === 1) {
    const item = items[0];
    const date = prettyDate(item.date);
    const issue = shortIssue(item.issue);
    if (savedReminder(item)) {
      return issue ? `Rent Right: Reminder for ${issue} is ${date}` : `Rent Right: Your reminder is ${date}`;
    }
    if (item.kind === "repair") {
      return issue ? `Rent Right: Repair deadline ${date} — ${issue}` : `Rent Right: Repair deadline is ${date}`;
    }
    if (item.kind === "deposit") return `Rent Right: Deposit deadline is ${date}`;
    if (item.kind === "notice_3day") return `Rent Right: Notice date is ${date}`;
    return issue ? `Rent Right: ${issue} is ${date}` : `Rent Right: A saved date is ${date}`;
  }
  const dates = [...new Set(items.map((item) => prettyDate(item.date)))];
  const when = dates.length === 1 ? dates[0] : dates.slice(0, 3).join(" and ");
  return `Rent Right: ${items.length} reminders for ${when}`;
}

export function reminderLetter(items: ReminderMailItem[]): { subject: string; heading: string; paragraphs: string[] } {
  const subject = subjectFor(items);
  const heading = items.length === 1 ? subject.replace(/^Rent Right:\s*/, "") : `${items.length} reminders`;
  const paragraphs = [
    ...items.map(lineFor),
    "Open Rent Right to see the record. This note was not sent to your landlord.",
  ];
  if (items.some(savedReminder)) {
    paragraphs.splice(items.length, 0, "A reminder you set is not a legal deadline.");
  }
  return { subject, heading, paragraphs };
}

/** One letter per email address. The same item is listed once even if two records match. */
export function lettersForPeople(items: ReminderMailItem[], people: { id: string; email: string }[]): ReminderLetter[] {
  const byId = new Map(people.map((person) => [person.id, person.email.trim().toLowerCase()]));
  const groups = new Map<string, { email: string; userIds: string[]; slots: { deadlineId: string; slot: string }[]; items: ReminderMailItem[] }>();
  for (const item of items) {
    const seenEmails = new Set<string>();
    for (const userId of item.userIds) {
      const email = byId.get(userId);
      if (!email) continue;
      const current = groups.get(email) || { email, userIds: [], slots: [], items: [] };
      if (!current.userIds.includes(userId)) current.userIds.push(userId);
      if (!seenEmails.has(email)) {
        seenEmails.add(email);
        current.slots.push({ deadlineId: item.deadlineId, slot: item.slot });
        if (!current.items.some((existing) => itemKey(existing) === itemKey(item))) current.items.push(item);
      }
      groups.set(email, current);
    }
  }
  return [...groups.values()].map((group) => {
    const letter = reminderLetter(group.items);
    return { email: group.email, userIds: group.userIds, slots: group.slots, ...letter };
  });
}
