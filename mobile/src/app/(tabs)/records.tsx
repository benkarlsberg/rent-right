import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api";
import { DateField } from "@/date-field";
import { DeleteAccount } from "@/delete-account";
import { saveAuthorizedFile } from "@/files";
import { NextSteps, type StepItem } from "@/next-steps";
import type { Me, Notice } from "@/session";
import { useSession } from "@/session";
import { colors } from "@/theme";
import { LanguageToggle } from "@/language-toggle";
import { Button, Card, ErrorLine, Field, H1, LearnMore, Muted, Page, wrapText } from "@/ui";
import { useLoad } from "@/use-load";

type DeadlineCard = {
  id: string;
  kind: string;
  title: string;
  started: string;
  owes: string;
  due: string | null;
  reminder: string | null;
  aside: string | null;
  reminderOn: string | null;
  learnMore: string;
  status: string;
};

type Records = {
  name: string;
  address: string;
  sample: boolean;
  locale: "en" | "es";
  notice: Notice;
  deadlines: DeadlineCard[];
  notes: { id: string; line: string; title: string; status: string; when: string; issue: string; message: string | null }[];
  steps: { title: string; held: string; items: StepItem[] };
  lease: { filename: string; headline: string; detail: string } | null;
  labels: {
    editReminder: string;
    saveReminder: string;
    addTitle: string;
    addHelp: string;
    reminderFor: string;
    dateLabel: string;
    exportLabel: string;
    packetTitle: string;
    packetBody: string;
    learnMore: string;
    hide: string;
  };
  reminderNote: string;
  packetFile: string;
  archived?: boolean;
  archivedNote?: string | null;
};

export default function Records() {
  const { data, error, reload, token, setError } = useLoad<Records>("records");
  const { me, signIn, signOut } = useSession();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [held, setHeld] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingLocale, setPendingLocale] = useState<"en" | "es" | null>(null);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const locale: "en" | "es" = pendingLocale ?? (me?.user.locale === "es" || (!me && data?.locale === "es") ? "es" : "en");

  async function language(next: "en" | "es") {
    if (!token || !me || next === locale) return;
    setPendingLocale(next);
    try {
      setError("");
      await signIn(await api<Me>("settings", { token, body: { locale: next, name: me.user.name, lowBandwidth: me.user.lowBandwidth } }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the language.");
    } finally {
      setPendingLocale(null);
    }
  }

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
    if (step.action === "small_claims" && step.href) {
      await Linking.openURL(step.href);
    }
  }

  async function saveDate(id: string, date: string) {
    if (!token || busy) return;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError(data?.locale === "es" ? "Use una fecha real." : "Use a real date.");
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
      setError(data.locale === "es" ? "Escriba para qué es y una fecha." : "Say what it is for, and enter a date.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await api("records/reminder/new", { token, body: { label: customLabel.trim(), date: customDate } });
      setCustomLabel("");
      setCustomDate("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the reminder.");
    } finally {
      setBusy(false);
    }
  }

  const labels = data?.labels;

  return (
    <Page onRefresh={reload}>
      <H1>{data?.name || "Records"}</H1>
      <Muted>{data?.address || (me?.needsUnit ? "Add your place when you are ready." : "Notes, your lease, and dates live here.")}</Muted>
      {data?.archivedNote ? <Muted>{data.archivedNote}</Muted> : null}
      {me?.needsUnit ? <Button label="Add your place" onPress={() => router.push("/setup")} /> : null}
      {data?.sample ? <Text style={styles.sample}>Sample</Text> : null}
      <ErrorLine message={error} />
      {data || me ? <LanguageToggle locale={locale} onChange={(next) => void language(next)} /> : null}
      {data?.steps ? <NextSteps title={data.steps.title} steps={data.steps.items} note={held} onAction={onStep} /> : null}
      {data?.deadlines.map((card) => (
        <Card key={card.id}>
          <Text style={styles.cardTitle}>{card.title}</Text>
          <Text style={styles.cardStatus}>{card.status}</Text>
          <Text style={styles.cardBody}>{card.started}</Text>
          <Text style={styles.cardBody}>{card.owes}</Text>
          {card.due ? <Text style={styles.due}>{card.due}</Text> : null}
          {card.reminder ? <Text style={styles.reminder}>{card.reminder}</Text> : null}
          {card.aside ? <Text style={styles.cardBody}>{card.aside}</Text> : null}
          {card.learnMore ? <LearnMore label={labels?.learnMore} hideLabel={labels?.hide}>{card.learnMore}</LearnMore> : null}
          {labels && !data?.archived ? (
            <Pressable
              style={styles.textButton}
              accessibilityRole="button"
              accessibilityLabel={labels.editReminder}
              onPress={() => {
                setEditing(editing === card.id ? null : card.id);
                setDraftDate(card.reminderOn || "");
              }}
            >
              <Text style={styles.textButtonLabel}>{labels.editReminder}</Text>
            </Pressable>
          ) : null}
          {editing === card.id && labels ? (
            <View>
              <DateField label={labels.dateLabel} value={draftDate} onChange={setDraftDate} />
              <Button label={labels.saveReminder} onPress={() => saveDate(card.id, draftDate)} disabled={busy} />
            </View>
          ) : null}
        </Card>
      ))}
      {data && labels && !me?.needsUnit && !data.archived ? (
        <Card>
          <Text style={styles.cardTitle}>{labels.addTitle}</Text>
          <Text style={styles.cardBody}>{labels.addHelp}</Text>
          <Text style={styles.cardBody}>{data.reminderNote}</Text>
          <Field label={labels.reminderFor} value={customLabel} onChange={setCustomLabel} />
          <DateField label={labels.dateLabel} value={customDate} onChange={setCustomDate} />
          <Button label={labels.saveReminder} onPress={addCustom} disabled={busy} />
        </Card>
      ) : null}
      {data?.notes.map((note) => (
        <Card key={note.id}>
          <Text style={styles.cardTitle}>{note.title}</Text>
          <Text style={styles.cardStatus}>{note.status}</Text>
          <Text style={styles.cardBody}>{note.when}</Text>
          <Text style={styles.cardBody}>{note.issue}</Text>
          {note.message ? <Text style={styles.cardBody}>{note.message}</Text> : null}
        </Card>
      ))}
      {data?.lease ? (
        <Card>
          <Text style={styles.cardTitle}>{data.lease.filename}</Text>
          <Text style={styles.cardStatus}>{data.lease.headline}</Text>
          {data.lease.detail ? <LearnMore label={labels?.learnMore} hideLabel={labels?.hide}>{data.lease.detail}</LearnMore> : null}
        </Card>
      ) : null}
      {data && labels ? (
        <Card>
          <Text style={styles.cardTitle}>{labels.packetTitle}</Text>
          <Text style={styles.cardBody}>{labels.packetBody}</Text>
          <Button label={labels.exportLabel} onPress={download} />
        </Card>
      ) : null}
      {token ? (
        <>
          <Pressable
            style={styles.textButton}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            onPress={async () => { await signOut(); router.replace("/"); }}
          >
            <Text style={styles.textButtonLabel}>Log out</Text>
          </Pressable>
          <LearnMore label={locale === "es" ? "Cuenta" : "Account"}>
            <Muted>{me?.user.email}</Muted>
            <Pressable onPress={() => saveAuthorizedFile("/api/export", "rent-right.json", token)} style={styles.textButton} accessibilityRole="button" accessibilityLabel={locale === "es" ? "Descargar mis datos" : "Download my data"}>
              <Text style={styles.textButtonLabel}>{locale === "es" ? "Descargar mis datos" : "Download my data"}</Text>
            </Pressable>
            <DeleteAccount
              token={token}
              spanish={locale === "es"}
              onDeleted={async () => {
                await signOut();
                router.replace("/");
              }}
            />
          </LearnMore>
        </>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  sample: { marginTop: 8, color: colors.mute, fontSize: 14 },
  cardTitle: { ...wrapText, fontSize: 22, lineHeight: 28, color: colors.ink, fontWeight: "600" },
  cardStatus: { ...wrapText, fontSize: 16, lineHeight: 22, color: colors.pine, marginTop: 6 },
  due: { ...wrapText, fontSize: 16, lineHeight: 22, color: colors.ink, fontWeight: "700", marginTop: 8 },
  reminder: { ...wrapText, fontSize: 16, lineHeight: 22, color: colors.pine, fontWeight: "700", marginTop: 8 },
  cardBody: { ...wrapText, fontSize: 16, lineHeight: 22, color: colors.mute, marginTop: 6 },
  textButton: { minHeight: 48, justifyContent: "center", marginTop: 8 },
  textButtonLabel: { color: colors.pine, fontSize: 16, fontWeight: "700" },
});
