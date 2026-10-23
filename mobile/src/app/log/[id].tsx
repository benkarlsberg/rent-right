import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { api } from "@/api";
import { ResolvePanel } from "@/resolve-panel";
import type { Notice } from "@/session";
import { useSession } from "@/session";
import { colors } from "@/theme";
import { Button, Card, ErrorLine, H1, LearnMore, LegalNote, Muted, Page } from "@/ui";
import { useLoad } from "@/use-load";

type HistoryRow = { id: string; at: string; title: string; body: string };

type Detail = {
  kind: string;
  date: string;
  text: string;
  record: string;
  flag: { title: string; detail: string; notice: Notice } | null;
  history?: HistoryRow[];
  resolution?: {
    status: string;
    pending: boolean;
    canResolve: boolean;
    canReopen: boolean;
    source: string | null;
    duration: string | null;
    note: string | null;
    reported: string;
    resolved: string | null;
    pendingTitle: string | null;
    pendingNote: string | null;
    earliest: string;
    today: string;
  } | null;
  labels?: {
    markResolved: string;
    confirmResolved: string;
    resolutionNote: string;
    resolutionDate: string;
    reopen: string;
    history: string;
  };
};

export default function LogDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload, token, setError } = useLoad<Detail>(`log/${id}`);
  const { me } = useSession();
  const [busy, setBusy] = useState(false);
  const spanish = me?.user.locale === "es";

  async function resolve(input: { note: string; date: string }) {
    if (!token || !id || busy) return;
    try {
      setBusy(true);
      setError("");
      await api("records/resolve", { token, body: { id, note: input.note, date: input.date, source: data?.resolution?.pending ? "landlord" : null } });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve the request.");
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    if (!token || !id || busy) return;
    try {
      setBusy(true);
      setError("");
      await api("records/reopen", { token, body: { id } });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reopen the request.");
    } finally {
      setBusy(false);
    }
  }

  const resolution = data?.resolution;
  const labels = data?.labels;

  return (
    <Page onRefresh={reload}>
      <H1>{data?.kind || "Log"}</H1>
      <Text style={{ fontSize: 18, color: colors.mute, marginTop: 4 }}>{data?.date}</Text>
      {resolution?.source ? <Text style={{ fontSize: 16, color: colors.pine, marginTop: 8, fontWeight: "700" }}>{resolution.source}</Text> : null}
      {resolution?.duration ? <Text style={{ fontSize: 16, color: colors.ink, marginTop: 6, fontWeight: "700" }}>{resolution.duration}</Text> : null}
      <Text style={{ fontSize: 18, marginTop: 12, color: colors.ink }}>{data?.text}</Text>
      {resolution?.note ? <Muted>{resolution.note}</Muted> : null}
      <ErrorLine message={error} />
      {resolution && labels && resolution.canResolve ? (
        <Card>
          <ResolvePanel
            pending={resolution.pending}
            pendingTitle={resolution.pendingTitle}
            pendingNote={resolution.pendingNote}
            markLabel={labels.markResolved}
            confirmLabel={labels.confirmResolved}
            noteLabel={labels.resolutionNote}
            dateLabel={labels.resolutionDate}
            earliest={resolution.earliest}
            today={resolution.today}
            busy={busy}
            onSubmit={(input) => void resolve(input)}
          />
        </Card>
      ) : null}
      {resolution && labels && resolution.canReopen ? (
        <Button label={labels.reopen} ghost onPress={() => void reopen()} disabled={busy} />
      ) : null}
      {data?.flag ? (
        <Card>
          <Text style={{ fontSize: 20 }}>{data.flag.title}</Text>
          <LegalNote notice={data.flag.notice} />
          <LearnMore>{data.flag.detail}</LearnMore>
        </Card>
      ) : null}
      {data?.history && data.history.length > 0 ? (
        <Card>
          <Text style={{ fontSize: 20, color: colors.ink, fontWeight: "700" }}>{labels?.history || (spanish ? "Historial" : "History")}</Text>
          {data.history.map((row) => (
            <Text key={row.id} style={{ fontSize: 16, lineHeight: 22, color: colors.ink, marginTop: 12 }}>
              <Text style={{ fontWeight: "700" }}>{`${row.title}\n`}</Text>
              <Text style={{ color: colors.mute }}>{row.at}</Text>
              {`\n${row.body}`}
            </Text>
          ))}
        </Card>
      ) : null}
      {data?.record ? <LearnMore label={spanish ? "Detalles del registro" : "Record details"}>{data.record}</LearnMore> : null}
    </Page>
  );
}
