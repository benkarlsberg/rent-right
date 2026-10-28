import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api";
import { saveAuthorizedFile } from "@/files";
import { PhotoThumb } from "@/photo-thumb";
import { colors } from "@/theme";
import { Button, ErrorLine, Field, H1, Muted, Page } from "@/ui";
import { useLoad } from "@/use-load";

type PhotoRef = { id: string; fileId: string; room: string; caption: string };
type Report = { id: string; kind: string; when: string; count: number; photos: PhotoRef[] };
type Loose = PhotoRef & { link: string; issueId: string | null; issueTitle: string };
type Payload = {
  why: string;
  issues: { id: string; title: string }[];
  reports: Report[];
  loose: Loose[];
};
type Draft = { id: string; name: string; mime: string; base64: string; uri: string; room: string; caption: string };

const LINKS = [
  { id: "move_in", label: "Move-in" },
  { id: "move_out", label: "Move-out" },
  { id: "issue", label: "An issue" },
  { id: "none", label: "None" },
] as const;

export default function Photos() {
  const params = useLocalSearchParams<{ issue?: string }>();
  const preset = typeof params.issue === "string" ? params.issue : "";
  const { data, error, reload, token, setError } = useLoad<Payload>("condition");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [link, setLink] = useState<(typeof LINKS)[number]["id"]>(preset ? "issue" : "none");
  const [issueId, setIssueId] = useState(preset);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chooser, setChooser] = useState(false);

  function addAssets(assets: { base64?: string | null; mimeType?: string | null; fileName?: string | null; uri?: string | null }[]) {
    const next = assets.filter((asset) => asset.base64).map((asset, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      name: asset.fileName || "photo.jpg",
      mime: asset.mimeType || "image/jpeg",
      base64: asset.base64 || "",
      uri: asset.uri || `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`,
      room: "",
      caption: "",
    }));
    if (next.length) setDrafts((current) => [...current, ...next]);
  }

  function pickWeb(capture: boolean) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    if (capture) input.setAttribute("capture", "environment");
    input.onchange = () => {
      const files = [...(input.files || [])];
      files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = () => {
          const raw = String(reader.result || "");
          const base64 = raw.split(",")[1] || "";
          if (!base64) return;
          setDrafts((current) => [...current, {
            id: `${Date.now()}-${index}`,
            name: file.name,
            mime: file.type || "image/jpeg",
            base64,
            uri: raw,
            room: "",
            caption: "",
          }]);
        };
        reader.readAsDataURL(file);
      });
    };
    input.click();
  }

  async function pick(source: "camera" | "library") {
    setChooser(false);
    if (Platform.OS === "web") {
      pickWeb(source === "camera");
      return;
    }
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Camera permission is needed to take a photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
      if (!result.canceled) addAssets(result.assets);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, mediaTypes: ["images"], quality: 0.5, allowsMultipleSelection: true });
    if (!result.canceled) addAssets(result.assets);
  }

  async function save() {
    if (!drafts.length || busy) return;
    if (link === "issue" && !issueId) {
      setError("Choose an open request, or choose None.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await api("condition", {
        token,
        body: {
          photos: drafts.map((photo) => ({
            base64: photo.base64,
            mime: photo.mime,
            room: photo.room,
            caption: photo.caption,
            link,
            issueId: link === "issue" ? issueId : "",
          })),
        },
      });
      setDrafts([]);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const issues = data?.issues || [];

  return (
    <Page onRefresh={reload}>
      <H1>Photos</H1>
      <Muted>{data?.why || "Move-in and move-out photos show the condition of the place. They matter if there is a deposit dispute."}</Muted>
      <ErrorLine message={error} />
      <Button label="Add a photo" onPress={() => setChooser(true)} />
      {chooser ? (
        <View style={styles.row}>
          <Pressable style={styles.choice} accessibilityRole="button" accessibilityLabel="Camera" onPress={() => void pick("camera")}>
            <Text style={styles.choiceText}>Camera</Text>
          </Pressable>
          <Pressable style={styles.choice} accessibilityRole="button" accessibilityLabel="Photo library" onPress={() => void pick("library")}>
            <Text style={styles.choiceText}>Photo library</Text>
          </Pressable>
        </View>
      ) : null}
      {drafts.map((photo) => (
        <View key={photo.id} style={styles.card}>
          <Image source={{ uri: photo.uri }} style={styles.preview} />
          <Field label="Room (optional)" value={photo.room} onChange={(room) => setDrafts((current) => current.map((item) => item.id === photo.id ? { ...item, room } : item))} placeholder="Bathroom" />
          <Field label="Caption (optional)" value={photo.caption} onChange={(caption) => setDrafts((current) => current.map((item) => item.id === photo.id ? { ...item, caption } : item))} placeholder="No hot water" />
        </View>
      ))}
      {drafts.length ? (
        <View>
          <Text style={styles.label}>Tag these photos</Text>
          <View style={styles.row}>
            {LINKS.map((item) => {
              const on = link === item.id;
              return (
                <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={item.label} onPress={() => setLink(item.id)} style={[styles.choice, on && styles.choiceOn]}>
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {link === "issue" ? (
            <View>
              <Text style={styles.label}>Link to a request</Text>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: issueId === "" }} accessibilityLabel="None" onPress={() => { setIssueId(""); setLink("none"); }} style={styles.issue}>
                <Text style={styles.choiceText}>None</Text>
              </Pressable>
              {issues.map((issue) => {
                const on = issueId === issue.id;
                return (
                  <Pressable key={issue.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={issue.title} onPress={() => setIssueId(issue.id)} style={[styles.issue, on && styles.choiceOn]}>
                    <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{issue.title}</Text>
                  </Pressable>
                );
              })}
              {!issues.length ? <Muted>No open requests yet.</Muted> : null}
            </View>
          ) : null}
          <Button label={busy ? "Saving" : "Save photos"} onPress={() => void save()} disabled={busy} />
          <Button label="Discard" ghost onPress={() => setDrafts([])} />
        </View>
      ) : null}
      {(data?.reports || []).map((report) => {
        const open = openId === report.id;
        return (
          <View key={report.id} style={styles.card}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${report.kind}, ${report.count} photos`} onPress={() => setOpenId(open ? null : report.id)}>
              <Text style={styles.cardTitle}>{report.kind}</Text>
              <Text style={styles.meta}>{report.when}</Text>
              <Text style={styles.meta}>{report.count === 1 ? "1 photo" : `${report.count} photos`}</Text>
            </Pressable>
            {token ? (
              <Button
                label="Download PDF"
                ghost
                onPress={() => {
                  void saveAuthorizedFile(`/api/condition/${report.id}/pdf`, "condition-report.pdf", token).catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : "Could not download the report.");
                  });
                }}
              />
            ) : null}
            <View style={styles.thumbs}>
              {report.photos.slice(0, 4).map((photo) => <PhotoThumb key={photo.id} fileId={photo.fileId} token={token} />)}
            </View>
            {open ? report.photos.map((photo) => (
              <View key={photo.id} style={styles.full}>
                <PhotoThumb fileId={photo.fileId} token={token} size={220} />
                {photo.room ? <Text style={styles.meta}>{photo.room}</Text> : null}
                {photo.caption ? <Text style={styles.body}>{photo.caption}</Text> : null}
              </View>
            )) : null}
          </View>
        );
      })}
      {(data?.loose || []).length ? <Text style={styles.label}>Other photos</Text> : null}
      {(data?.loose || []).map((photo) => (
        <View key={photo.id} style={styles.card}>
          <PhotoThumb fileId={photo.fileId} token={token} size={120} />
          <Text style={styles.meta}>{photo.issueTitle || photo.room || "Not tagged"}</Text>
          {photo.caption ? <Text style={styles.body}>{photo.caption}</Text> : null}
        </View>
      ))}
      {!data?.reports.length && !data?.loose.length ? <Muted>No photos yet.</Muted> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, minHeight: 44, justifyContent: "center", paddingHorizontal: 14, backgroundColor: "white" },
  choiceOn: { backgroundColor: colors.pine, borderColor: colors.pine },
  choiceText: { color: colors.ink, fontWeight: "700" },
  choiceTextOn: { color: "white" },
  card: { marginTop: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16 },
  preview: { width: 120, height: 120, borderRadius: 12, backgroundColor: colors.line },
  label: { marginTop: 18, fontWeight: "700", color: colors.ink, fontSize: 15 },
  issue: { marginTop: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 14, minHeight: 44, justifyContent: "center", paddingHorizontal: 14, backgroundColor: "white" },
  cardTitle: { fontSize: 20, color: colors.ink, fontWeight: "600" },
  meta: { color: colors.mute, marginTop: 4 },
  body: { color: colors.ink, marginTop: 6, lineHeight: 22 },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  full: { marginTop: 12 },
});
