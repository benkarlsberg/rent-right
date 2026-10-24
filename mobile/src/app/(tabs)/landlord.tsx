import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { useSession } from "@/session";
import { TabLoading } from "@/typing-dots";
import { colors } from "@/theme";
import { Button, ErrorLine, Field, LearnMore, clipX, wrapText } from "@/ui";
import { useLoad } from "@/use-load";

type DraftLabels = {
  draft: string;
  send: string;
  edit: string;
  discard: string;
  save: string;
  done: string;
  emailPrompt: string;
  emailLabel: string;
  subject: string;
};

type ChatItem = {
  id: string;
  side: "tenant" | "landlord";
  text: string;
  detail: string | null;
  subject?: string;
  time: string;
  status: string;
  draft?: boolean;
};

type ChatData = {
  landlord: string;
  archived?: boolean;
  archivedNote?: string | null;
  needsEmail?: boolean;
  needsUnit?: boolean;
  needsLandlord?: boolean;
  prompt?: string;
  labels?: DraftLabels;
  items: ChatItem[];
};

export default function Landlord() {
  const params = useLocalSearchParams<{ draft?: string | string[] }>();
  const focusId = Array.isArray(params.draft) ? params.draft[0] : params.draft || "";
  const { data, error, loading, reload, setError, token } = useLoad<ChatData>("chat");
  const { me } = useSession();
  const spanish = me?.user.locale === "es";
  const listRef = useRef<FlatList<ChatItem>>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [phone, setPhone] = useState("");
  const labels = data?.labels;
  const needsPrompt = Boolean(data && (data.needsLandlord || data.needsUnit));
  const emptyTitle = spanish ? "Aún no hay propietario" : "No landlord added yet";
  const prompt = data?.prompt || (spanish ? "Agregue el nombre y el correo del propietario para enviar un mensaje." : "Add your landlord's name and email to send a message.");
  const addLabel = spanish ? "Agregar propietario" : "Add landlord";
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (!focusId) return;
    void reloadRef.current();
  }, [focusId]);

  useEffect(() => {
    if (!focusId || !data?.items.length) return;
    const index = data.items.findIndex((item) => item.id === focusId);
    if (index < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
    }, 50);
    return () => clearTimeout(timer);
  }, [focusId, data?.items]);

  async function send() {
    const text = draft.trim();
    if (!text || !token || sending || data?.archived) return;
    try {
      setSending(true);
      setError("");
      await reload(await api<ChatData>("chat", { token, body: { text } }));
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  function openForm() {
    setName(me?.unit?.landlordName || "");
    setFormEmail(me?.unit?.landlordEmail || "");
    setPhone("");
    setError("");
    setAdding(true);
  }

  async function saveLandlord() {
    const trimmedName = name.trim();
    const trimmedEmail = formEmail.trim();
    if (!trimmedName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(spanish ? "Agregue el nombre y el correo del propietario." : "Add the landlord's name and email.");
      return;
    }
    if (!token || sending) return;
    try {
      setSending(true);
      setError("");
      await reload(await api<ChatData>("landlord", { token, body: { name: trimmedName, email: trimmedEmail, phone: phone.trim() } }));
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSending(false);
    }
  }

  async function saveEmail() {
    if (!token || sending) return;
    try {
      setSending(true);
      setError("");
      await reload(await api<ChatData>("chat/landlord-email", { token, body: { email } }));
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the email.");
    } finally {
      setSending(false);
    }
  }

  async function sendDraftMessage(id: string, body: string) {
    if (!token || sending) return;
    try {
      setSending(true);
      setError("");
      await reload(await api<ChatData>("chat/draft/send", { token, body: { id, body } }));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  async function discard(id: string) {
    if (!token || sending) return;
    try {
      setSending(true);
      setError("");
      await reload(await api<ChatData>("chat/draft/discard", { token, body: { id } }));
      if (editingId === id) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not discard the draft.");
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(id: string) {
    if (!token || sending) return;
    try {
      setSending(true);
      setError("");
      await reload(await api<ChatData>("chat/draft", { token, body: { id, body: editBody } }));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the draft.");
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.title}>{needsPrompt ? emptyTitle : (data?.landlord || me?.unit?.landlordName || (spanish ? "Propietario" : "Landlord"))}</Text>
      {needsPrompt ? (
        <View style={styles.promptCard}>
          {adding && !data?.needsUnit ? (
            <>
              <Text style={styles.promptText}>{prompt}</Text>
              <Field label={spanish ? "Nombre" : "Name"} value={name} onChange={setName} autoComplete="name" textContentType="name" />
              <Field label={spanish ? "Correo" : "Email"} value={formEmail} onChange={setFormEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
              <Field label={spanish ? "Teléfono, opcional" : "Phone, optional"} value={phone} onChange={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
              <ErrorLine message={error} />
              <Button label={sending ? (spanish ? "Guardando" : "Saving") : (spanish ? "Guardar" : "Save")} onPress={() => void saveLandlord()} disabled={sending} />
            </>
          ) : (
            <>
              <Text style={styles.promptText}>{loading && !data ? (spanish ? "Cargando" : "Loading") : prompt}</Text>
              <ErrorLine message={error} />
              <Button
                label={addLabel}
                onPress={() => {
                  if (data?.needsUnit) router.push("/setup");
                  else openForm();
                }}
              />
            </>
          )}
        </View>
      ) : (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ref={listRef}
          style={clipX}
          data={data?.items || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.2 }), 50);
          }}
          ListEmptyComponent={loading && !data ? <TabLoading label={spanish ? "Cargando" : "Loading"} /> : <Text style={styles.empty}>{spanish ? "Los mensajes que envíe a su propietario aparecen aquí. No se envía nada hasta que usted confirme." : "Messages you send to your landlord show up here. Nothing is sent until you confirm."}</Text>}
          renderItem={({ item }) => {
            const mine = item.side === "tenant";
            const highlighted = Boolean(focusId) && item.id === focusId;
            if (item.draft) {
              const editing = editingId === item.id;
              const body = editing ? editBody : item.text;
              return (
                <View nativeID={`draft-${item.id}`} style={[styles.draft, highlighted && styles.draftOn]}>
                  <Text style={styles.draftLabel}>{item.status}</Text>
                  {item.subject ? <Text style={styles.subject}>{labels?.subject || "Subject"}: {item.subject}</Text> : null}
                  {editing ? (
                    <TextInput
                      value={editBody}
                      onChangeText={setEditBody}
                      multiline
                      accessibilityLabel={labels?.edit || "Edit"}
                      style={styles.editor}
                    />
                  ) : (
                    <Text style={styles.draftBody}>{item.text}</Text>
                  )}
                  {data?.needsEmail ? (
                    <View>
                      <Text style={styles.prompt}>{labels?.emailPrompt}</Text>
                      <Field label={labels?.emailLabel || "Landlord email"} value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                      <Pressable style={styles.primary} accessibilityRole="button" accessibilityLabel={labels?.save || "Save"} disabled={sending} onPress={() => void saveEmail()}>
                        <Text style={styles.primaryText}>{labels?.save || "Save"}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <View style={styles.actions}>
                    <Pressable style={styles.primary} accessibilityRole="button" accessibilityLabel={labels?.send || "Send"} accessibilityState={{ disabled: Boolean(sending || data?.archived || data?.needsEmail) }} disabled={sending || data?.archived || data?.needsEmail} onPress={() => void sendDraftMessage(item.id, body)}>
                      <Text style={styles.primaryText}>{labels?.send || "Send"}</Text>
                    </Pressable>
                    {editing ? (
                      <Pressable style={styles.ghost} accessibilityRole="button" accessibilityLabel={labels?.done || "Done"} disabled={sending} onPress={() => void saveEdit(item.id)}>
                        <Text style={styles.ghostText}>{labels?.done || "Done"}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={styles.ghost}
                        accessibilityRole="button"
                        accessibilityLabel={labels?.edit || "Edit"}
                        disabled={sending || data?.archived}
                        onPress={() => {
                          setEditingId(item.id);
                          setEditBody(item.text);
                        }}
                      >
                        <Text style={styles.ghostText}>{labels?.edit || "Edit"}</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.ghost} accessibilityRole="button" accessibilityLabel={labels?.discard || "Discard"} disabled={sending || data?.archived} onPress={() => void discard(item.id)}>
                      <Text style={styles.dangerText}>{labels?.discard || "Discard"}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }
            return (
              <View style={styles.block}>
                <View style={[styles.row, mine ? styles.right : styles.left]}>
                  <View style={[styles.bubble, mine ? styles.tenant : styles.landlord]}>
                    <Text style={[styles.bubbleText, { color: mine ? "white" : colors.ink }]}>{item.text}</Text>
                  </View>
                  <Text style={styles.meta}>{item.time} · {item.status}</Text>
                </View>
                {item.detail ? <LearnMore label="Email details">{item.detail}</LearnMore> : null}
              </View>
            );
          }}
        />
        <ErrorLine message={error} />
        <View style={styles.composer}>
          <TextInput value={draft} onChangeText={setDraft} placeholder={spanish ? "Mensaje" : "Message"} placeholderTextColor={colors.mute} accessibilityLabel={spanish ? "Mensaje" : "Message"} editable={!data?.archived} style={styles.input} />
          <Pressable onPress={send} disabled={Boolean(data?.archived) || sending} style={styles.send} accessibilityRole="button" accessibilityLabel={spanish ? "Enviar" : "Send"} accessibilityState={{ disabled: Boolean(data?.archived) || sending }}><Text style={styles.sendText}>{sending ? (spanish ? "Enviando" : "Sending") : (spanish ? "Enviar" : "Send")}</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, width: "100%", minWidth: 0 },
  title: { fontSize: 32, fontWeight: "600", letterSpacing: -0.4, paddingHorizontal: 24, paddingTop: 16, color: colors.ink },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28, flexGrow: 1, width: "100%", maxWidth: "100%", minWidth: 0 },
  empty: { fontSize: 16, lineHeight: 24, color: colors.mute, marginTop: 24, paddingHorizontal: 8 },
  promptCard: { paddingHorizontal: 24, paddingTop: 8 },
  promptText: { fontSize: 16, lineHeight: 24, color: colors.mute, marginTop: 8 },
  block: { width: "100%", maxWidth: "100%", minWidth: 0, marginBottom: 18, alignSelf: "stretch" },
  row: { maxWidth: "86%", minWidth: 0, flexShrink: 1 },
  right: { alignSelf: "flex-end", alignItems: "flex-end" },
  left: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, maxWidth: "100%", minWidth: 0, flexShrink: 1 },
  bubbleText: { ...wrapText, fontSize: 17, lineHeight: 24 },
  tenant: { backgroundColor: colors.tenant, borderBottomRightRadius: 6 },
  landlord: { backgroundColor: colors.landlord, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  meta: { color: colors.mute, fontSize: 13, marginTop: 6 },
  draft: { alignSelf: "stretch", backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 16 },
  draftOn: { backgroundColor: "#E7F3F1", borderColor: colors.pine, borderWidth: 2 },
  draftLabel: { ...wrapText, color: colors.pine, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  subject: { ...wrapText, color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: "700", marginTop: 8 },
  draftBody: { ...wrapText, color: colors.ink, fontSize: 15, lineHeight: 22, marginTop: 8 },
  editor: { marginTop: 8, minHeight: 160, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, fontSize: 15, lineHeight: 22, color: colors.ink, backgroundColor: colors.card, textAlignVertical: "top" },
  prompt: { ...wrapText, color: colors.ink, fontSize: 15, lineHeight: 21, marginTop: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  primary: { backgroundColor: colors.pine, borderRadius: 12, minHeight: 44, justifyContent: "center", paddingHorizontal: 14, marginTop: 8 },
  primaryText: { color: "white", fontSize: 15, fontWeight: "700" },
  ghost: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 12, minHeight: 44, justifyContent: "center", paddingHorizontal: 14 },
  ghostText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  dangerText: { color: colors.bad, fontSize: 15, fontWeight: "700" },
  composer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
  input: { flex: 1, minHeight: 48, backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, fontSize: 16, color: colors.ink },
  send: { minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 },
  sendText: { color: colors.pine, fontWeight: "700", fontSize: 17 },
});
