import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { DateField } from "@/date-field";
import { saveAuthorizedFile } from "@/files";
import { NextSteps, type StepItem } from "@/next-steps";
import type { Records } from "@/app/(tabs)/records";
import { useSession } from "@/session";
import { TabLoading } from "@/typing-dots";
import { colors } from "@/theme";
import { Button, ErrorLine, Field, LearnMore, clipX, wrapText } from "@/ui";
import { useLoad } from "@/use-load";

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function Reminders() {
  const { data, error, loading, reload, token, setError } = useLoad<Records>("records");
  const { me } = useSession();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [held, setHeld] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const es = me?.user.locale === "es" || (!me && data?.locale === "es");
  const labels = data?.labels;

  async function download() {
    if (!token || !data) return;
    try {
      setError("");
      const saved = await saveAuthorizedFile("/api/packet", data.packetFile || "rent-right-evidence.pdf", token);
      if (saved === "needs-landlord") router.push("/landlord");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the records.");
    }
  }

  async function onStep(step: StepItem) {
    if (step.action === "wait") {
      setHeld(data?.steps.held || "Nothing was sent.");
      return;
    }
    if (step.action === "followup" || step.action === "send" || step.href === "/landlord") {
      router.push((step.href || "/landlord") as "/landlord");
      return;
    }
    if (step.action === "export") {
      await download();
      return;
    }
    if (step.action === "small_claims" && step.href) await Linking.openURL(step.href);
  }

  async function saveDate(id: string, date: string) {
    if (!token || busy) return;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError(es ? "Use una fecha real." : "Use a real date.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await reload(await api<Records>("records/reminder", { token, body: { id, date } }));
      setEditing(null);
      const { offerPushRegistration } = await import("@/push");
      void offerPushRegistration(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the reminder.");
    } finally {
      setBusy(false);
    }
  }

  async function addCustom() {
    if (!token || busy || !data) return;
    if (!customLabel.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(customDate)) {
      setError(es ? "Escriba para qué es y una fecha." : "Say what it is for, and enter a date.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await reload(await api<Records>("records/reminder/new", { token, body: { label: customLabel.trim(), date: customDate } }));
      const { offerPushRegistration } = await import("@/push");
      void offerPushRegistration(token);
      setCustomLabel("");
      setCustomDate("");
      setSheet(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the reminder.");
    } finally {
      setBusy(false);
    }
  }

  const canAdd = Boolean(token && data && !me?.needsUnit && !data.archived);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  function showToast(id: string, text: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id, text });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  async function markDone(id: string) {
    if (!token || busy) return;
    try {
      setBusy(true);
      setError("");
      await reload(await api<Records>("records/done", { token, body: { id } }));
      if (openId === id) setOpenId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the reminder.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!token || busy) return;
    try {
      setBusy(true);
      setError("");
      await reload(await api<Records>("records/reminder/delete", { token, body: { id } }));
      setConfirmId(null);
      if (openId === id) setOpenId(null);
      showToast(id, labels?.deletedToast || (es ? "Recordatorio eliminado" : "Reminder deleted"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the reminder.");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(id: string) {
    if (!token || busy) return;
    try {
      setBusy(true);
      setError("");
      await reload(await api<Records>("records/reminder/dismiss", { token, body: { id } }));
      setConfirmId(null);
      if (openId === id) setOpenId(null);
      showToast(id, labels?.dismissedToast || (es ? "Recordatorio descartado" : "Reminder dismissed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dismiss the reminder.");
    } finally {
      setBusy(false);
    }
  }

  async function undo(id: string) {
    if (!token || busy) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
    try {
      setBusy(true);
      setError("");
      await reload(await api<Records>("records/reminder/restore", { token, body: { id } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore the reminder.");
    } finally {
      setBusy(false);
    }
  }

  function askDelete(id: string) {
    setEditing(null);
    setOpenId(id);
    setConfirmId(id);
  }

  const today = data?.today || "";
  const soonUntil = today ? shiftDate(today, 7) : "";
  const openDeadlines = (data?.deadlines || []).filter((card) => !card.closed).sort((a, b) => (a.sortOn || "9999-12-31").localeCompare(b.sortOn || "9999-12-31") || a.title.localeCompare(b.title));
  const groups = [
    { key: "overdue", title: labels?.overdue || (es ? "Vencidos" : "Overdue"), items: openDeadlines.filter((card) => Boolean(card.sortOn) && today && (card.sortOn || "") < today) },
    { key: "soon", title: labels?.soon || (es ? "Pronto" : "Soon"), items: openDeadlines.filter((card) => Boolean(card.sortOn) && today && (card.sortOn || "") >= today && (card.sortOn || "") <= soonUntil) },
    { key: "later", title: labels?.later || (es ? "Más adelante" : "Later"), items: openDeadlines.filter((card) => !card.sortOn || !today || (card.sortOn || "") > soonUntil) },
  ].filter((group) => group.items.length);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{labels?.reminders || (es ? "Recordatorios" : "Reminders")}</Text>
        {canAdd ? (
          <Pressable
            style={styles.add}
            accessibilityRole="button"
            accessibilityLabel={labels?.addButton || (es ? "Agregar recordatorio" : "Add reminder")}
            onPress={() => setSheet(true)}
          >
            <Text style={styles.addText}>{labels?.addButton || (es ? "+ Agregar recordatorio" : "+ Add reminder")}</Text>
          </Pressable>
        ) : null}
      </View>
      {me?.needsUnit ? (
        <Pressable style={styles.place} accessibilityRole="button" onPress={() => router.push("/setup")}>
          <Text style={styles.addText}>{es ? "Agregar su vivienda" : "Add your place"}</Text>
        </Pressable>
      ) : null}
      <ErrorLine message={error} onRetry={!data ? () => void reload() : undefined} retryLabel={es ? "Reintentar" : "Retry"} />
      <ScrollView
        style={clipX}
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.pine} />}
      >
        {loading && !data && !error ? <TabLoading label={es ? "Cargando" : "Loading"} /> : null}
        {data?.steps?.items?.length ? (
          <NextSteps
            title={data.steps.title}
            steps={data.steps.items}
            note={held}
            moreLabel={labels?.seeAll || (es ? "Ver todos los pasos" : "See all steps")}
            hideLabel={labels?.hide || (es ? "Ocultar" : "Hide")}
            onAction={(step) => void onStep(step)}
          />
        ) : null}
        {data && !openDeadlines.length ? <Text style={styles.empty}>{labels?.emptyReminders || (es ? "Aún no hay recordatorios." : "No reminders yet.")}</Text> : null}
        {groups.map((group) => (
          <View key={group.key}>
            <Text style={[styles.group, group.key === "overdue" && styles.groupOverdue]}>{group.title}</Text>
            {group.items.map((card) => {
          const open = openId === card.id;
          const line = card.due || card.reminder;
          const deletable = card.deletable ?? (card.kind === "custom_reminder" || card.kind === "repair");
          const confirming = confirmId === card.id;
          const deleteLabel = labels?.deleteReminder || (es ? "Eliminar" : "Delete");
          const dismissLabel = labels?.dismissReminder || (es ? "Descartar" : "Dismiss");
          return (
            <View key={card.id} style={styles.card}>
              <Pressable
                style={styles.row}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={card.title}
                onPress={() => {
                  setConfirmId(null);
                  setOpenId(open ? null : card.id);
                }}
              >
                <View style={styles.rowText}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  {line ? <Text style={styles.when}>{line}</Text> : null}
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{card.status}</Text>
                </View>
              </Pressable>
              {open ? (
                <View>
                  {card.started ? <Text style={styles.body}>{card.started}</Text> : null}
                  {card.owes ? <Text style={styles.body}>{card.owes}</Text> : null}
                  {card.due && card.reminder ? <Text style={styles.body}>{card.reminder}</Text> : null}
                  {card.aside ? <Text style={styles.body}>{card.aside}</Text> : null}
                  {!deletable && card.legalNote ? <Text style={styles.body}>{card.legalNote}</Text> : null}
                  {card.learnMore ? <LearnMore label={labels?.learnMore} hideLabel={labels?.hide}>{card.learnMore}</LearnMore> : null}
                  {confirming ? (
                    <View accessibilityRole="alert">
                      <Text style={styles.confirm}>{labels?.deleteConfirm || (es ? "¿Eliminar este recordatorio?" : "Delete this reminder?")}</Text>
                      <Pressable
                        style={styles.danger}
                        accessibilityRole="button"
                        accessibilityLabel={deleteLabel}
                        disabled={busy}
                        onPress={() => void remove(card.id)}
                      >
                        <Text style={styles.dangerText}>{deleteLabel}</Text>
                      </Pressable>
                      <Button label={labels?.cancelAction || (es ? "Cancelar" : "Cancel")} ghost onPress={() => setConfirmId(null)} disabled={busy} />
                    </View>
                  ) : (
                    <>
                      {labels && !data?.archived ? (
                        editing === card.id ? (
                          <View>
                            <DateField label={labels.dateLabel} value={draftDate} onChange={setDraftDate} />
                            <Button label={labels.saveReminder} onPress={() => saveDate(card.id, draftDate)} disabled={busy} />
                          </View>
                        ) : (
                          <Button
                            label={labels.editReminder}
                            ghost
                            onPress={() => {
                              setEditing(card.id);
                              setDraftDate(card.reminderOn || "");
                            }}
                          />
                        )
                      ) : null}
                      {labels?.markDone && !data?.archived ? (
                        <Button label={labels.markDone} ghost onPress={() => markDone(card.id)} disabled={busy} />
                      ) : null}
                      {!data?.archived && deletable ? (
                        <Button label={deleteLabel} ghost onPress={() => askDelete(card.id)} disabled={busy} />
                      ) : null}
                      {!data?.archived && !deletable ? (
                        <Button label={dismissLabel} ghost onPress={() => void dismiss(card.id)} disabled={busy} />
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}
              {!data?.archived && !open ? (
                <View style={styles.actions}>
                  {labels?.markDone ? (
                    <Pressable style={styles.linkHit} accessibilityRole="button" accessibilityLabel={labels.markDone} onPress={() => markDone(card.id)}>
                      <Text style={styles.addText}>{labels.markDone}</Text>
                    </Pressable>
                  ) : null}
                  {deletable ? (
                    <Pressable style={styles.linkHit} accessibilityRole="button" accessibilityLabel={deleteLabel} onPress={() => askDelete(card.id)}>
                      <Text style={styles.deleteText}>{deleteLabel}</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.linkHit} accessibilityRole="button" accessibilityLabel={dismissLabel} onPress={() => void dismiss(card.id)}>
                      <Text style={styles.addText}>{dismissLabel}</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </View>
          );
            })}
          </View>
        ))}
      </ScrollView>
      {sheet && labels && data ? (
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} accessibilityLabel={labels.close || "Close"} onPress={() => setSheet(false)} />
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>{labels.addTitle}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={labels.close || "Close"} onPress={() => setSheet(false)}>
                  <Text style={styles.close}>{labels.close || (es ? "Cerrar" : "Close")}</Text>
                </Pressable>
              </View>
              <Text style={styles.body}>{labels.addHelp}</Text>
              <Text style={styles.body}>{data.reminderNote}</Text>
              <Field label={labels.reminderFor} value={customLabel} onChange={setCustomLabel} />
              <DateField label={labels.dateLabel} value={customDate} onChange={setCustomDate} />
              <Button label={labels.saveReminder} onPress={addCustom} disabled={busy} />
            </ScrollView>
          </View>
        </View>
      ) : null}
      {toast ? (
        <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>{toast.text}</Text>
          <Pressable
            style={styles.toastHit}
            accessibilityRole="button"
            accessibilityLabel={labels?.undo || (es ? "Deshacer" : "Undo")}
            onPress={() => void undo(toast.id)}
          >
            <Text style={styles.toastAction}>{labels?.undo || (es ? "Deshacer" : "Undo")}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, width: "100%", minWidth: 0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  title: { ...wrapText, flex: 1, fontSize: 20, lineHeight: 26, color: colors.ink, fontWeight: "700", minWidth: 0 },
  add: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  addText: { color: colors.pine, fontSize: 14, fontWeight: "700" },
  place: { marginHorizontal: 16, marginTop: 8, minHeight: 44, justifyContent: "center" },
  page: { paddingHorizontal: 16, paddingBottom: 28 },
  empty: { ...wrapText, marginTop: 16, color: colors.mute, fontSize: 15, lineHeight: 21 },
  group: { ...wrapText, marginTop: 16, fontSize: 13, lineHeight: 18, color: colors.mute, fontWeight: "700" },
  groupOverdue: { color: colors.bad },
  linkHit: { minHeight: 44, justifyContent: "center", paddingRight: 12 },
  actions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  deleteText: { color: colors.bad, fontSize: 14, fontWeight: "700" },
  confirm: { ...wrapText, fontSize: 16, lineHeight: 22, color: colors.ink, fontWeight: "700", marginTop: 12 },
  danger: { backgroundColor: colors.bad, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 12 },
  dangerText: { color: "white", fontWeight: "700", fontSize: 16 },
  toast: { position: "absolute", left: 16, right: 16, bottom: 12, backgroundColor: colors.pine, borderRadius: 14, minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 },
  toastText: { ...wrapText, flex: 1, color: "white", fontSize: 15, lineHeight: 20, fontWeight: "600" },
  toastHit: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  toastAction: { color: "white", fontSize: 15, fontWeight: "700" },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  rowText: { flex: 1, minWidth: 0 },
  cardTitle: { ...wrapText, fontSize: 16, lineHeight: 21, color: colors.ink, fontWeight: "600" },
  when: { ...wrapText, fontSize: 14, lineHeight: 20, color: colors.ink, fontWeight: "600", marginTop: 2 },
  body: { ...wrapText, fontSize: 14, lineHeight: 20, color: colors.mute, marginTop: 6 },
  chip: { maxWidth: "42%", backgroundColor: "#E7F3F1", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { ...wrapText, fontSize: 12, lineHeight: 16, color: colors.pine, fontWeight: "700", textAlign: "center" },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(20, 52, 60, 0.35)" },
  sheet: { maxHeight: "88%", backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: colors.line },
  sheetBody: { padding: 16, paddingBottom: 28 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sheetTitle: { ...wrapText, flex: 1, fontSize: 18, lineHeight: 24, color: colors.ink, fontWeight: "700" },
  close: { color: colors.pine, fontSize: 14, fontWeight: "700", minHeight: 44, textAlignVertical: "center" },
});
