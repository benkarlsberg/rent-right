import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { colors } from "@/theme";
import { ErrorLine, LearnMore } from "@/ui";
import { useLoad } from "@/use-load";

type ChatData = {
  landlord: string;
  items: { id: string; side: "tenant" | "landlord"; text: string; detail: string | null; time: string; status: string }[];
};

export default function Chat() {
  const { data, error, reload, setError, token } = useLoad<ChatData>("chat");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const text = draft.trim();
    if (!text || !token) return;
    try {
      setSending(true);
      setError("");
      await api("chat", { token, body: { text } });
      setDraft("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.title}>{data?.landlord || "Landlord"}</Text>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          data={data?.items || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => undefined}
          renderItem={({ item }) => {
            const mine = item.side === "tenant";
            return (
              <View style={[styles.row, mine ? styles.right : styles.left]}>
                <View style={[styles.bubble, mine ? styles.tenant : styles.landlord]}>
                  <Text style={{ color: mine ? "white" : colors.ink, fontSize: 16 }}>{item.text}</Text>
                </View>
                <Text style={styles.meta}>{item.time} · {item.status}</Text>
                {item.detail ? <LearnMore label="Email details">{item.detail}</LearnMore> : null}
              </View>
            );
          }}
        />
        <ErrorLine message={error} />
        <View style={styles.composer}>
          <TextInput value={draft} onChangeText={setDraft} placeholder="Message" style={styles.input} />
          <Text onPress={sending ? undefined : send} style={styles.send}>{sending ? "…" : "Send"}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  title: { fontSize: 28, fontWeight: "600", paddingHorizontal: 20, paddingTop: 8, color: colors.ink },
  list: { padding: 16, gap: 12 },
  row: { maxWidth: "86%", marginBottom: 12 },
  right: { alignSelf: "flex-end", alignItems: "flex-end" },
  left: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  tenant: { backgroundColor: colors.tenant, borderBottomRightRadius: 4 },
  landlord: { backgroundColor: colors.landlord, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  meta: { color: colors.mute, fontSize: 11, marginTop: 4 },
  composer: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: "#fffdf8" },
  input: { flex: 1, backgroundColor: "white", borderRadius: 20, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  send: { color: colors.pine, fontWeight: "700", fontSize: 16, padding: 8 },
});
