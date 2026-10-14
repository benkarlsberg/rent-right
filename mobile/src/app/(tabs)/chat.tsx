import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { saveAuthorizedFile } from "@/files";
import type { Notice } from "@/session";
import { colors } from "@/theme";
import { ErrorLine, LearnMore } from "@/ui";
import { useLoad } from "@/use-load";
import * as ImagePicker from "expo-image-picker";

type Action = { id: string; label: string };
type Item =
  | { role: "user"; text: string }
  | { role: "card"; headline: string; status: string; action: Action | null; detail: string; ruleId: string | null; notice: Notice };
type Thread = { landlord: string; items: Item[]; chips: { label: string; text: string }[]; notice: Notice };
type Attachment = { name: string; mime: string; base64: string };

export default function AssistantChat() {
  const { data, error, reload, setError, token } = useLoad<Thread>("thread");
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  async function send(text: string, extra?: { action?: string; draftId?: string }) {
    if (!token || busy) return;
    try {
      setBusy(true);
      setError("");
      await api("thread", { token, body: { text, action: extra?.action, draftId: extra?.draftId, attachment: file } });
      setDraft("");
      setFile(null);
      setMenu(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  async function onAction(action: Action) {
    if (action.id === "open-landlord") {
      router.push("/landlord");
      return;
    }
    if (action.id === "download-packet") {
      if (!token) return;
      try { setError(""); await saveAuthorizedFile("/api/packet", "rent-right-records.pdf", token); }
      catch (err) { setError(err instanceof Error ? err.message : "Could not download."); }
      return;
    }
    if (action.id === "letter") {
      await send("", { action: "letter" });
      return;
    }
    if (action.id.startsWith("send:")) {
      await send("", { action: "send", draftId: action.id.slice(5) });
    }
  }

  function pickWeb(accept: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const chosen = input.files?.[0];
      if (!chosen) return;
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result || "");
        setFile({ name: chosen.name, mime: chosen.type || "application/octet-stream", base64: raw.split(",")[1] || "" });
        setMenu(false);
      };
      reader.readAsDataURL(chosen);
    };
    input.click();
  }

  async function pickPhoto() {
    if (Platform.OS === "web") {
      pickWeb("image/*");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, mediaTypes: ["images"], quality: 0.6 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset?.base64) setFile({ name: asset.fileName || "photo.jpg", mime: asset.mimeType || "image/jpeg", base64: asset.base64 });
    setMenu(false);
  }

  const items = data?.items || [];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.title}>Rent Right</Text>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          data={items}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View>
              <Text style={styles.intro}>Tell me what happened.</Text>
              {(data?.chips || []).map((chip) => (
                <Pressable key={chip.label} style={styles.chip} onPress={() => send(chip.text)}>
                  <Text style={styles.chipText}>{chip.label}</Text>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item }) => item.role === "user" ? (
            <View style={styles.userRow}>
              <View style={styles.userBubble}><Text style={styles.userText}>{item.text}</Text></View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.headline}>{item.headline}</Text>
              <Text style={styles.status}>{item.status}</Text>
              {item.action ? (
                <Pressable style={styles.action} onPress={() => onAction(item.action!)}>
                  <Text style={styles.actionText}>{item.action.label}</Text>
                </Pressable>
              ) : null}
              <Text style={styles.short}>{item.notice.short}</Text>
              <LearnMore>{`${item.detail}${item.ruleId ? `\n\n${item.ruleId}` : ""}\n\n${item.notice.full}\n\n${item.notice.clinicFull}`}</LearnMore>
            </View>
          )}
        />
        <ErrorLine message={error} />
        {file ? <Text style={styles.file}>{file.name}</Text> : null}
        {menu ? (
          <View style={styles.menu}>
            <Pressable style={styles.menuButton} onPress={pickPhoto}><Text style={styles.menuText}>Photo</Text></Pressable>
            <Pressable style={styles.menuButton} onPress={() => (Platform.OS === "web" ? pickWeb(".pdf,.txt,image/*") : pickPhoto())}><Text style={styles.menuText}>Lease or photo</Text></Pressable>
          </View>
        ) : null}
        <View style={styles.composer}>
          <Pressable style={styles.plus} onPress={() => setMenu((open) => !open)} accessibilityRole="button">
            <Text style={styles.plusText}>+</Text>
          </Pressable>
          <TextInput value={draft} onChangeText={setDraft} placeholder="Message" style={styles.input} />
          <Pressable style={styles.send} onPress={() => send(draft)} disabled={busy}>
            <Text style={styles.sendText}>{busy ? "…" : "Send"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  title: { fontSize: 34, fontWeight: "600", color: colors.ink, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  intro: { fontSize: 22, color: colors.ink, marginTop: 28, marginBottom: 8, lineHeight: 30 },
  chip: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingVertical: 16, paddingHorizontal: 18, marginTop: 12 },
  chipText: { fontSize: 18, color: colors.ink },
  userRow: { alignItems: "flex-end", marginTop: 16 },
  userBubble: { maxWidth: "82%", backgroundColor: colors.tenant, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 14 },
  userText: { color: "white", fontSize: 17, lineHeight: 24 },
  card: { marginTop: 16, backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 18 },
  headline: { fontSize: 26, color: colors.ink, fontWeight: "600" },
  status: { fontSize: 18, color: colors.pine, marginTop: 6 },
  action: { marginTop: 16, backgroundColor: colors.pine, borderRadius: 999, minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  actionText: { color: "white", fontSize: 17, fontWeight: "700" },
  short: { color: colors.mute, fontSize: 13, marginTop: 12 },
  file: { color: colors.pine, paddingHorizontal: 20, paddingBottom: 4 },
  menu: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  menuButton: { flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  menuText: { fontSize: 16, color: colors.ink, fontWeight: "600" },
  composer: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: "#fffdf8" },
  plus: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: "white" },
  plusText: { fontSize: 28, color: colors.pine, lineHeight: 32 },
  input: { flex: 1, minHeight: 48, backgroundColor: "white", borderRadius: 24, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, fontSize: 17, color: colors.ink },
  send: { minHeight: 48, justifyContent: "center", paddingHorizontal: 8 },
  sendText: { color: colors.pine, fontWeight: "700", fontSize: 17 },
});
