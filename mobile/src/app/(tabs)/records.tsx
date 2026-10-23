import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api";
import { saveAuthorizedFile } from "@/files";
import type { Me, Notice } from "@/session";
import { useSession } from "@/session";
import { colors } from "@/theme";
import { Button, Card, ErrorLine, Field, H1, LearnMore, Muted, Page } from "@/ui";
import { useLoad } from "@/use-load";

type Records = {
  name: string;
  address: string;
  sample: boolean;
  locale: "en" | "es";
  notice: Notice;
  next: { title: string; status: string; detail: string } | null;
  notes: { id: string; line: string }[];
  lease: { filename: string; headline: string; detail: string } | null;
};

export default function Records() {
  const { data, error, reload, token, setError } = useLoad<Records>("records");
  const { me, signIn, signOut } = useSession();
  const [confirm, setConfirm] = useState("");
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  async function language(locale: "en" | "es") {
    if (!token || !me) return;
    await signIn(await api<Me>("settings", { token, body: { locale, name: me.user.name, lowBandwidth: me.user.lowBandwidth } }));
    await reload();
  }

  async function remove() {
    try {
      setError("");
      await api("account/delete", { token, body: { confirm } });
      await signOut();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the account.");
    }
  }

  async function download() {
    if (!token) return;
    try {
      setError("");
      await saveAuthorizedFile("/api/packet", "rent-right-records.pdf", token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the records.");
    }
  }

  return (
    <Page onRefresh={reload}>
      <H1>{data?.name || "Records"}</H1>
      <Muted>{data?.address || "Notes, your lease, and dates live here."}</Muted>
      {data?.sample ? <Text style={styles.sample}>Sample</Text> : null}
      <ErrorLine message={error} />
      {data ? (
        <View style={styles.segment} accessibilityRole="tablist">
          <Pressable accessibilityRole="button" accessibilityLabel="English" accessibilityState={{ selected: data.locale !== "es" }} style={[styles.segmentItem, data.locale !== "es" && styles.segmentOn]} onPress={() => language("en")}>
            <Text style={[styles.segmentText, data.locale !== "es" && styles.segmentTextOn]}>English</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Español" accessibilityState={{ selected: data.locale === "es" }} style={[styles.segmentItem, data.locale === "es" && styles.segmentOn]} onPress={() => language("es")}>
            <Text style={[styles.segmentText, data.locale === "es" && styles.segmentTextOn]}>Español</Text>
          </Pressable>
        </View>
      ) : null}
      {data?.next ? (
        <Card>
          <Text style={styles.cardTitle}>{data.next.title}</Text>
          <Text style={styles.cardStatus}>{data.next.status}</Text>
          {data.next.detail ? <LearnMore>{data.next.detail}</LearnMore> : null}
        </Card>
      ) : null}
      {data?.notes.length ? (
        <Card>
          {data.notes.map((note, index) => (
            <Text key={note.id} style={[styles.note, index === 0 && styles.noteFirst]}>{note.line}</Text>
          ))}
        </Card>
      ) : null}
      {data?.lease ? (
        <Card>
          <Text style={styles.cardTitle}>{data.lease.filename}</Text>
          <Text style={styles.cardStatus}>{data.lease.headline}</Text>
          {data.lease.detail ? <LearnMore>{data.lease.detail}</LearnMore> : null}
        </Card>
      ) : null}
      {data ? (
        <Card>
          <Text style={styles.cardTitle}>Your records</Text>
          <Text style={styles.cardBody}>A PDF of the notes and dates saved in this account.</Text>
          <Button label="Download records" onPress={download} />
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
          <LearnMore label="Account">
            <Muted>{me?.user.email}</Muted>
            <Pressable onPress={() => saveAuthorizedFile("/api/export", "rent-right.json", token)} style={styles.textButton} accessibilityRole="button" accessibilityLabel="Download my data">
              <Text style={styles.textButtonLabel}>Download my data</Text>
            </Pressable>
            <Field label="Type DELETE" value={confirm} onChange={setConfirm} autoCapitalize="characters" />
            <Button label="Delete account" onPress={remove} />
          </LearnMore>
        </>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  sample: { marginTop: 8, color: colors.mute, fontSize: 14 },
  segment: { flexDirection: "row", marginTop: 20, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 4 },
  segmentItem: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  segmentOn: { backgroundColor: colors.pine },
  segmentText: { fontSize: 16, fontWeight: "600", color: colors.ink },
  segmentTextOn: { color: "white" },
  cardTitle: { fontSize: 22, lineHeight: 28, color: colors.ink, fontWeight: "600" },
  cardStatus: { fontSize: 16, lineHeight: 22, color: colors.pine, marginTop: 6 },
  cardBody: { fontSize: 16, lineHeight: 22, color: colors.mute, marginTop: 6 },
  note: { fontSize: 16, lineHeight: 24, color: colors.ink, marginTop: 12 },
  noteFirst: { marginTop: 0 },
  textButton: { minHeight: 48, justifyContent: "center", marginTop: 8 },
  textButtonLabel: { color: colors.pine, fontSize: 16, fontWeight: "700" },
});
