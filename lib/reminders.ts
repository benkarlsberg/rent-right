import type { Locale } from "@/lib/disclaimer";
import { getDeadline, insertLog, setReminderStatus, type Deadline, type User } from "@/lib/db";
import { todayISO } from "@/lib/rules/dates";
import { tx } from "@/lib/text";

export function tenantOwnedReminder(kind: string): boolean {
  return kind === "custom_reminder" || kind === "repair";
}

function fail(locale: Locale, en: string, es: string): never {
  throw new Error(tx(locale, en, es));
}

function labelFor(row: Deadline, locale: Locale): string {
  if (row.kind === "custom_reminder") {
    const label = (locale === "es" ? row.explanationEs : row.explanation).trim();
    return label || tx(locale, "Your reminder", "Su recordatorio");
  }
  if (row.kind === "repair") return tx(locale, "Follow-up reminder", "Recordatorio de seguimiento");
  if (row.kind === "deposit") return tx(locale, "Deposit deadline", "Fecha del depósito");
  if (row.kind === "notice_3day") return tx(locale, "Notice date", "Fecha del aviso");
  return tx(locale, "Saved date", "Fecha guardada");
}

async function audit(user: User, row: Deadline, event: string, description: string) {
  await insertLog({
    unitId: row.unitId,
    userId: user.id,
    type: "issue_event",
    description,
    eventDate: todayISO(),
    flags: { deadlineId: row.id, event, kind: row.kind },
  });
}

export async function deleteReminder(user: User, id: string) {
  const row = await getDeadline(user.id, id);
  if (!tenantOwnedReminder(row.kind)) {
    fail(
      user.locale,
      "This date stays in your records. Dismiss it from Reminders, or mark it done.",
      "Esta fecha se queda en sus registros. Descártela de Recordatorios, o márquela como hecha.",
    );
  }
  if (row.status === "deleted") fail(user.locale, "This reminder is already deleted.", "Este recordatorio ya está eliminado.");
  if (row.status !== "open" && row.status !== "done") {
    fail(user.locale, "This reminder is already closed.", "Este recordatorio ya está cerrado.");
  }
  await setReminderStatus(user.id, id, "deleted");
  const label = labelFor(row, user.locale);
  await audit(
    user,
    row,
    "reminder_deleted",
    tx(user.locale, `Tenant deleted the reminder “${label}”.`, `El inquilino eliminó el recordatorio “${label}”.`),
  );
}

export async function dismissReminder(user: User, id: string) {
  const row = await getDeadline(user.id, id);
  if (tenantOwnedReminder(row.kind)) {
    fail(user.locale, "Delete a reminder you added.", "Elimine un recordatorio que usted agregó.");
  }
  if (row.status === "dismissed") fail(user.locale, "This date is already dismissed.", "Esta fecha ya está descartada.");
  if (row.status !== "open" && row.status !== "done") {
    fail(user.locale, "This date is already closed.", "Esta fecha ya está cerrada.");
  }
  await setReminderStatus(user.id, id, "dismissed");
  const label = labelFor(row, user.locale);
  await audit(
    user,
    row,
    "reminder_dismissed",
    tx(
      user.locale,
      `Tenant dismissed “${label}” from Reminders. The date stays in the records.`,
      `El inquilino descartó “${label}” de Recordatorios. La fecha se queda en los registros.`,
    ),
  );
}

export async function restoreReminder(user: User, id: string) {
  const row = await getDeadline(user.id, id);
  if (row.status !== "deleted" && row.status !== "dismissed") {
    fail(user.locale, "This reminder is already on your list.", "Este recordatorio ya está en su lista.");
  }
  await setReminderStatus(user.id, id, "open");
  const label = labelFor(row, user.locale);
  await audit(
    user,
    row,
    "reminder_restored",
    tx(user.locale, `Tenant restored the reminder “${label}”.`, `El inquilino restauró el recordatorio “${label}”.`),
  );
}
