import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { colors } from "@/theme";
import { ErrorLine, LearnMore } from "@/ui";
import { useLoad } from "@/use-load";

type ChatData = {
  landlord: string;
  items: { id: string; side: "tenant" | "landlord"; text: string; detail: string | null; time: string; status: string }[];
};

export default function Landlord() {
  const { data, error, reload, setError, token } = useLoad<ChatData>("chat");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const text = draft.trim();
    if (!text || !token || sending) return;
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
          ListEmptyComponent={<Text style={styles.empty}>Messages you send to your landlord show up here. Nothing is sent until you confirm.</Text>}
          renderItem={({ item }) => {
            const mine = item.side === "tenant";
            return (
              <View style={[styles.row, mine ? styles.right : styles.left]}>
                <View style={[styles.bubble, mine ? styles.tenant : styles.landlord]}>
                  <Text style={{ color: mine ? "white" : colors.ink, fontSize: 17, lineHeight: 24 }}>{item.text}</Text>
                </View>
                <Text style={styles.meta}>{item.time} · {item.status}</Text>
                {item.detail ? <LearnMore label="Email details">{item.detail}</LearnMore> : null}
              </View>
            );
          }}
        />
        <ErrorLine message={error} />
        <View style={styles.composer}>
          <TextInput value={draft} onChangeText={setDraft} placeholder="Message" placeholderTextColor={colors.mute} accessibilityLabel="Message" style={styles.input} />
          <Pressable onPress={send} style={styles.send} accessibilityRole="button" accessibilityLabel="Send"><Text style={styles.sendText}>{sending ? "Sending" : "Send"}</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  title: { fontSize: 32, fontWeight: "600", letterSpacing: -0.4, paddingHorizontal: 24, paddingTop: 16, color: colors.ink },
  list: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28, flexGrow: 1 },
  empty: { fontSize: 16, lineHeight: 24, color: colors.mute, marginTop: 24 },
  row: { maxWidth: "86%", marginBottom: 18 },
  right: { alignSelf: "flex-end", alignItems: "flex-end" },
  left: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14 },
  tenant: { backgroundColor: colors.tenant, borderBottomRightRadius: 6 },
  landlord: { backgroundColor: colors.landlord, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  meta: { color: colors.mute, fontSize: 13, marginTop: 6 },
  composer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
  input: { flex: 1, minHeight: 48, backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, fontSize: 16, color: colors.ink },
  send: { minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 },
  sendText: { color: colors.pine, fontWeight: "700", fontSize: 17 },
});
