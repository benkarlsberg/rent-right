import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { DateField } from "@/date-field";
import { saveAuthorizedFile } from "@/files";
import { NextSteps, type StepItem } from "@/next-steps";
import type { Records } from "@/app/(tabs)/records";
import { useSession } from "@/session";
import { colors } from "@/theme";
import { Button, ErrorLine, Field, LearnMore, clipX, wrapText } from "@/ui";
import { useLoad } from "@/use-load";

export default function Reminders() {
  const { data, error, reload, token, setError } = useLoad<Records>("records");
  const { me } = useSession();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [held, setHeld] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const es = me?.user.locale === "es" || (!me && data?.locale === "es");
  const labels = data?.labels;

  async function download() {
    if (!token || !data) return;
    try {
      setError("");
      await saveAuthorizedFile("/api/packet", data.packetFile || "rent-right-evidence.pdf", token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the records.");
    }
  }

  async function onStep(step: StepItem) {
    if (step.action === "wait") {
      setHeld(data?.steps.held || "Nothing was sent.");
      return;
    }
    if (step.action === "followup" || step.action === "send") {
      router.push("/landlord");
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
      await api("records/reminder", { token, body: { id, date } });
      setEditing(null);
      await reload();
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
      await api("records/reminder/new", { token, body: { label: customLabel.trim(), date: customDate } });
      setCustomLabel("");
      setCustomDate("");
      setSheet(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the reminder.");
    } finally {
      setBusy(false);
    }
  }

  const deadlines = data?.deadlines || [];
  const canAdd = Boolean(token && data && !me?.needsUnit && !data.archived);

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
      <ErrorLine message={error} />
      <ScrollView
        style={clipX}
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.pine} />}
      >
        {data?.steps ? (
          <NextSteps
            title={data.steps.title}
            steps={data.steps.items}
            note={held}
            moreLabel={labels?.seeAll || (es ? "Ver todos los pasos" : "See all steps")}
            hideLabel={labels?.hide || (es ? "Ocultar" : "Hide")}
            onAction={(step) => void onStep(step)}
          />
        ) : null}
        {!deadlines.length ? <Text style={styles.empty}>{labels?.emptyReminders || (es ? "Aún no hay recordatorios." : "No reminders yet.")}</Text> : null}
        {deadlines.map((card) => {
          const open = openId === card.id;
          const line = card.due || card.reminder;
          return (
            <View key={card.id} style={styles.card}>
              <Pressable
                style={styles.row}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={card.title}
                onPress={() => setOpenId(open ? null : card.id)}
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
                  {card.learnMore ? <LearnMore label={labels?.learnMore} hideLabel={labels?.hide}>{card.learnMore}</LearnMore> : null}
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
                </View>
              ) : null}
            </View>
          );
        })}
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
