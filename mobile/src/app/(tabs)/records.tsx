import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { api } from "@/api";
import { Address } from "@/address";
import { DeleteAccount } from "@/delete-account";
import { saveAuthorizedFile } from "@/files";
import { LanguageToggle } from "@/language-toggle";
import type { StepItem } from "@/next-steps";
import { ResolvePanel } from "@/resolve-panel";
import type { Me, Notice } from "@/session";
import { useSession } from "@/session";
import { TabLoading } from "@/typing-dots";
import { colors } from "@/theme";
import { Button, ErrorLine, clipX, wrapText } from "@/ui";
import { useLoad } from "@/use-load";

type Segment = "issues" | "documents" | "evidence";

export type Records = {
  name: string;
  address: string;
  street?: string;
  unitNumber?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  sample: boolean;
  locale: "en" | "es";
  notice: Notice;
  deadlines: {
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
    sortOn?: string;
    closed?: boolean;
    deletable?: boolean;
    legalNote?: string | null;
  }[];
  notes: { id: string; line: string; title: string; status: string; when: string; issue: string; message: string | null }[];
  issues?: {
    id: string;
    title: string;
    status: string;
    when: string;
    reported?: string;
    issue: string;
    message: string | null;
    pending: boolean;
    pendingTitle: string | null;
    pendingNote: string | null;
    earliest: string;
  }[];
  archive?: {
    id: string;
    title: string;
    reported: string;
    resolved: string;
    duration: string;
    summary: string;
    source: string | null;
    note: string | null;
  }[];
  today?: string;
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
    openTitle?: string;
    markResolved?: string;
    confirmResolved?: string;
    resolutionNote?: string;
    resolutionDate?: string;
    reopen?: string;
    history?: string;
    archiveTitle?: string;
    issues?: string;
    documents?: string;
    evidence?: string;
    reminders?: string;
    change?: string;
    seeAll?: string;
    addButton?: string;
    photos?: string;
    notes?: string;
    emptyIssues?: string;
    emptyDocs?: string;
    emptyReminders?: string;
    account?: string;
    logOut?: string;
    menu?: string;
    downloadData?: string;
    close?: string;
    overdue?: string;
    soon?: string;
    later?: string;
    markDone?: string;
    nextStepsLink?: string;
    deleteReminder?: string;
    deleteConfirm?: string;
    dismissReminder?: string;
    cancelAction?: string;
    undo?: string;
    deletedToast?: string;
    dismissedToast?: string;
  };
  reminderNote: string;
  packetFile: string;
  archived?: boolean;
  archivedNote?: string | null;
};

const gearXml = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="#0B5C6E" stroke-width="1.8"/><path d="M12 2.6v2.2M12 19.2v2.2M4.2 6.2l1.9 1.1M17.9 16.7l1.9 1.1M4.2 17.8l1.9-1.1M17.9 7.3l1.9-1.1M2.6 12h2.2M19.2 12h2.2" stroke="#0B5C6E" stroke-width="1.8" stroke-linecap="round"/></svg>`;

function Gear() {
  return <SvgXml xml={gearXml} width={22} height={22} />;
}

export default function Records() {
  const { data, error, loading, reload, token, setError } = useLoad<Records>("records");
  const { me, signIn, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [openIssue, setOpenIssue] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [openArchive, setOpenArchive] = useState<string | null>(null);
  const [section, setSection] = useState<Segment>("issues");
  const [menu, setMenu] = useState(false);
  const [pendingLocale, setPendingLocale] = useState<"en" | "es" | null>(null);

  const locale: "en" | "es" = pendingLocale ?? (me?.user.locale === "es" || (!me && data?.locale === "es") ? "es" : "en");
  const labels = data?.labels;
  const es = locale === "es";

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
      const saved = await saveAuthorizedFile("/api/packet", data.packetFile || "rent-right-evidence.pdf", token);
      if (saved === "needs-landlord") router.push("/landlord");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the records.");
    }
  }

  async function resolveIssue(id: string, input: { note: string; date: string }, source: "landlord" | null) {
    if (!token || busy || !data) return;
    if (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      setError(es ? "Use una fecha real." : "Use a real date.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await reload(await api<Records>("records/resolve", { token, body: { id, note: input.note, date: input.date, source } }));
      setOpenIssue(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve the request.");
    } finally {
      setBusy(false);
    }
  }

  async function reopenIssue(id: string) {
    if (!token || busy) return;
    try {
      setBusy(true);
      setError("");
      await reload(await api<Records>("records/reopen", { token, body: { id } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reopen the request.");
    } finally {
      setBusy(false);
    }
  }

  const issues = data?.issues || [];
  const archive = data?.archive || [];
  const notes = data?.notes || [];
  const place = data?.street
    ? data
    : me?.unit?.street
      ? me.unit
      : null;
  const address = data?.address || me?.unit?.address || (me?.needsUnit ? (es ? "Agregue su vivienda cuando pueda." : "Add your place when you are ready.") : (es ? "Sus solicitudes, documentos y evidencia." : "Your requests, documents, and evidence."));

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          {place ? (
            <Address street={place.street} unit={place.unitNumber} city={place.city} region={place.region} postalCode={place.postalCode} style={styles.address} />
          ) : (
            <Text style={styles.address}>{address}</Text>
          )}
          {data?.sample ? <Text style={styles.sample}>{es ? "Muestra" : "Sample"}</Text> : null}
          {data?.archivedNote ? <Text style={styles.note}>{data.archivedNote}</Text> : null}
          {me?.needsUnit ? (
            <Pressable style={styles.linkHit} accessibilityRole="button" accessibilityLabel={es ? "Agregar su vivienda" : "Add your place"} onPress={() => router.push("/setup")}>
              <Text style={styles.link}>{es ? "Agregar su vivienda" : "Add your place"}</Text>
            </Pressable>
          ) : data?.address ? (
            <Pressable style={styles.linkHit} accessibilityRole="link" accessibilityLabel={labels?.change || (es ? "Cambiar" : "Change")} onPress={() => router.push("/residence")}>
              <Text style={styles.link}>{labels?.change || (es ? "Cambiar" : "Change")}</Text>
            </Pressable>
          ) : null}
        </View>
        {token ? (
          <Pressable
            style={styles.gear}
            accessibilityRole="button"
            accessibilityLabel={labels?.menu || (es ? "Menú de la cuenta" : "Account menu")}
            accessibilityState={{ expanded: menu }}
            onPress={() => setMenu(true)}
          >
            <Gear />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.segment} accessibilityRole="tablist">
        {(["issues", "documents", "evidence"] as Segment[]).map((item) => {
          const label = item === "issues"
            ? labels?.issues || (es ? "Solicitudes" : "Issues")
            : item === "documents"
              ? labels?.documents || (es ? "Documentos" : "Documents")
              : labels?.evidence || (es ? "Evidencia" : "Evidence");
          const on = section === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: on }}
              onPress={() => setSection(item)}
              style={[styles.segmentItem, on && styles.segmentOn]}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorLine message={error} />
      <ScrollView
        style={clipX}
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.pine} />}
      >
        {loading && !data ? <TabLoading label={es ? "Cargando" : "Loading"} /> : null}
        {data?.steps?.items?.length ? (
          <Pressable
            style={styles.linkHit}
            accessibilityRole="link"
            accessibilityLabel={labels?.nextStepsLink || (es ? "Sus próximos pasos están en Recordatorios" : "Your next steps are on Reminders")}
            onPress={() => router.push("/reminders")}
          >
            <Text style={styles.link}>{labels?.nextStepsLink || (es ? "Sus próximos pasos están en Recordatorios" : "Your next steps are on Reminders")}</Text>
          </Pressable>
        ) : null}
        {section === "issues" ? (
          <View>
            {data && !issues.length && !archive.length ? <Text style={styles.empty}>{labels?.emptyIssues || (es ? "No hay solicitudes abiertas." : "No open requests.")}</Text> : null}
            {issues.map((issue) => {
              const open = openIssue === issue.id;
              return (
                <View key={issue.id} style={styles.card}>
                  <Pressable
                    style={styles.row}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={issue.title}
                    onPress={() => setOpenIssue(open ? null : issue.id)}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.cardTitle}>{issue.title}</Text>
                      <Text style={styles.meta}>{issue.reported || issue.when}</Text>
                    </View>
                    <View style={[styles.chip, issue.pending && styles.chipPending]}>
                      <Text style={[styles.chipText, issue.pending && styles.chipTextPending]}>{issue.status}</Text>
                    </View>
                  </Pressable>
                  {open ? (
                    <View style={styles.expand}>
                      <Text style={styles.body}>{issue.issue}</Text>
                      {issue.message ? <Text style={styles.body}>{issue.message}</Text> : null}
                      <Pressable style={styles.linkHit} accessibilityRole="button" accessibilityLabel={labels?.history || "History"} onPress={() => router.push(`/log/${issue.id}`)}>
                        <Text style={styles.link}>{labels?.history || (es ? "Historial" : "History")}</Text>
                      </Pressable>
                      {labels && !data?.archived ? (
                        <ResolvePanel
                          pending={issue.pending}
                          pendingTitle={issue.pendingTitle}
                          pendingNote={issue.pendingNote}
                          markLabel={labels.markResolved || "Mark as resolved"}
                          confirmLabel={labels.confirmResolved || "Confirm"}
                          noteLabel={labels.resolutionNote || "Note (optional)"}
                          dateLabel={labels.resolutionDate || "Resolution date"}
                          earliest={issue.earliest}
                          today={data?.today || issue.earliest}
                          busy={busy}
                          quiet
                          onSubmit={(input) => resolveIssue(issue.id, input, issue.pending ? "landlord" : null)}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
            {archive.length ? (
              <View style={styles.archiveBlock}>
                <Pressable
                  style={styles.archiveHeader}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: archiveOpen }}
                  accessibilityLabel={`${labels?.archiveTitle || "Resolved"} (${archive.length})`}
                  onPress={() => setArchiveOpen((value) => !value)}
                >
                  <Text style={styles.sectionInline}>{`${labels?.archiveTitle || (es ? "Resueltos" : "Resolved")} (${archive.length})`}</Text>
                  <Text style={styles.link}>{archiveOpen ? labels?.hide || (es ? "Ocultar" : "Hide") : (es ? "Ver" : "Show")}</Text>
                </Pressable>
                {archiveOpen ? archive.map((item) => {
                  const open = openArchive === item.id;
                  return (
                    <View key={item.id} style={styles.card}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                        accessibilityLabel={`${item.title}. ${item.duration}`}
                        onPress={() => setOpenArchive(open ? null : item.id)}
                      >
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.duration}>{item.duration}</Text>
                        <Text style={styles.meta}>{item.reported}</Text>
                      </Pressable>
                      {open ? (
                        <View style={styles.expand}>
                          {item.source ? <Text style={styles.meta}>{item.source}</Text> : null}
                          <Text style={styles.body}>{item.resolved}</Text>
                          <Text style={styles.body}>{item.summary}</Text>
                          {item.note ? <Text style={styles.body}>{item.note}</Text> : null}
                          <Pressable style={styles.linkHit} accessibilityRole="button" accessibilityLabel={labels?.history || "History"} onPress={() => router.push(`/log/${item.id}`)}>
                            <Text style={styles.link}>{labels?.history || (es ? "Historial" : "History")}</Text>
                          </Pressable>
                          {labels && !data?.archived ? (
                            <Button label={labels.reopen || "Reopen"} ghost onPress={() => reopenIssue(item.id)} disabled={busy} />
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                }) : null}
              </View>
            ) : null}
          </View>
        ) : null}
        {section === "documents" ? (
          <View>
            {data?.lease ? (
              <View style={styles.card}>
                <Text style={styles.kicker}>{es ? "Contrato" : "Lease"}</Text>
                <Text style={styles.cardTitle}>{data.lease.filename}</Text>
                <Text style={styles.meta}>{data.lease.headline}</Text>
                {data.lease.detail ? <Text style={styles.body}>{data.lease.detail}</Text> : null}
              </View>
            ) : null}
            <Pressable style={styles.card} accessibilityRole="button" accessibilityLabel={labels?.photos || "Condition photos"} onPress={() => router.push("/photos")}>
              <View style={styles.row}>
                <Text style={[styles.cardTitle, styles.rowText]}>{labels?.photos || (es ? "Fotos del estado" : "Condition photos")}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
            {notes.length ? <Text style={styles.section}>{labels?.notes || (es ? "Notas" : "Notes")}</Text> : null}
            {notes.map((note) => {
              const open = openNote === note.id;
              return (
                <View key={note.id} style={styles.card}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={note.title} onPress={() => setOpenNote(open ? null : note.id)}>
                    <Text style={styles.cardTitle}>{note.title}</Text>
                    <Text style={styles.meta}>{note.status}</Text>
                    <Text style={styles.meta}>{note.when}</Text>
                  </Pressable>
                  {open ? (
                    <View style={styles.expand}>
                      <Text style={styles.body}>{note.issue}</Text>
                      {note.message ? <Text style={styles.body}>{note.message}</Text> : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
        {section === "evidence" && labels ? (
          <View style={styles.card}>
            <View style={styles.evidenceRow}>
              <View style={styles.rowText}>
                <Text style={styles.cardTitle}>{labels.packetTitle}</Text>
                <Text style={styles.body}>{labels.packetBody}</Text>
              </View>
            </View>
            <Button label={labels.exportLabel} ghost onPress={download} />
          </View>
        ) : null}
      </ScrollView>
      {menu && token ? (
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} accessibilityLabel={labels?.close || "Close"} onPress={() => setMenu(false)} />
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>{labels?.account || (es ? "Cuenta" : "Account")}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={labels?.close || "Close"} onPress={() => setMenu(false)} style={styles.linkHit}>
                  <Text style={styles.link}>{labels?.close || (es ? "Cerrar" : "Close")}</Text>
                </Pressable>
              </View>
              {me?.user.email ? <Text style={styles.body}>{me.user.email}</Text> : null}
              <Button label={labels?.downloadData || (es ? "Descargar mis datos" : "Download my data")} ghost onPress={() => saveAuthorizedFile("/api/export", "rent-right.json", token)} />
              <Text style={styles.section}>{es ? "Idioma" : "Language"}</Text>
              <LanguageToggle locale={locale} onChange={(next) => void language(next)} />
              <Button
                label={labels?.logOut || (es ? "Salir" : "Log out")}
                ghost
                onPress={async () => { setMenu(false); await signOut(); router.replace("/"); }}
              />
              <Text style={styles.section}>{es ? "Eliminar la cuenta" : "Delete account"}</Text>
              <DeleteAccount
                token={token}
                spanish={es}
                onDeleted={async () => {
                  await signOut();
                  router.replace("/");
                }}
              />
            </ScrollView>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, width: "100%", minWidth: 0 },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  headerText: { flex: 1, minWidth: 0 },
  address: { ...wrapText, fontSize: 17, lineHeight: 23, color: colors.ink, fontWeight: "600" },
  sample: { ...wrapText, marginTop: 4, color: colors.mute, fontSize: 13 },
  note: { ...wrapText, marginTop: 4, color: colors.mute, fontSize: 14, lineHeight: 20 },
  gear: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  linkHit: { minHeight: 44, justifyContent: "center" },
  link: { color: colors.pine, fontSize: 14, fontWeight: "700" },
  segment: { flexDirection: "row", marginHorizontal: 16, marginTop: 4, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 3 },
  segmentItem: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 9, paddingHorizontal: 4, paddingVertical: 6 },
  segmentOn: { backgroundColor: colors.pine },
  segmentText: { ...wrapText, fontSize: 13, lineHeight: 16, fontWeight: "700", color: colors.ink, textAlign: "center" },
  segmentTextOn: { color: "white" },
  page: { paddingHorizontal: 16, paddingBottom: 28 },
  empty: { ...wrapText, marginTop: 16, color: colors.mute, fontSize: 15, lineHeight: 21 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  rowText: { flex: 1, minWidth: 0 },
  cardTitle: { ...wrapText, fontSize: 16, lineHeight: 21, color: colors.ink, fontWeight: "600" },
  meta: { ...wrapText, fontSize: 13, lineHeight: 18, color: colors.mute, marginTop: 2 },
  body: { ...wrapText, fontSize: 14, lineHeight: 20, color: colors.mute, marginTop: 6 },
  duration: { ...wrapText, fontSize: 14, lineHeight: 20, color: colors.ink, fontWeight: "700", marginTop: 4 },
  chip: { maxWidth: "46%", backgroundColor: "#E7F3F1", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipPending: { backgroundColor: "#F8F1E4" },
  chipText: { ...wrapText, fontSize: 12, lineHeight: 16, color: colors.pine, fontWeight: "700", textAlign: "center" },
  chipTextPending: { color: colors.warn },
  expand: { paddingBottom: 4 },
  archiveBlock: { marginTop: 8 },
  archiveHeader: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  section: { marginTop: 14, fontSize: 13, lineHeight: 18, color: colors.mute, fontWeight: "700" },
  sectionInline: { fontSize: 13, lineHeight: 18, color: colors.mute, fontWeight: "700" },
  kicker: { fontSize: 12, lineHeight: 16, color: colors.mute, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  chevron: { color: colors.mute, fontSize: 22, lineHeight: 22, fontWeight: "400" },
  evidenceRow: { minHeight: 44 },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(20, 52, 60, 0.35)" },
  sheet: { maxHeight: "88%", backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: colors.line },
  sheetBody: { padding: 16, paddingBottom: 28 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 18, lineHeight: 24, color: colors.ink, fontWeight: "700" },
});
