import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { useSession } from "@/session";
import { TabLoading } from "@/typing-dots";
import { colors } from "@/theme";
import { Button, ErrorLine, Field, LearnMore, clipX, wrapText } from "@/ui";
import { useLoad } from "@/use-load";
import { PhotoThumb } from "@/photo-thumb";

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

type ChatPhoto = { id: string; fileId: string };
type LibraryPhoto = { id: string; fileId: string; logId: string | null; caption: string };
type PendingPhoto = { key: string; name: string; photoId?: string; fileId?: string; mime?: string; base64?: string; preview?: string; issueId?: string | null };
type ChatItem = {
  id: string;
  side: "tenant" | "landlord";
  text: string;
  detail: string | null;
  subject?: string;
  time: string;
  status: string;
  draft?: boolean;
  logId?: string | null;
  photos?: ChatPhoto[];
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
  issues?: { id: string; title: string }[];
  library?: LibraryPhoto[];
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
  const [discarding, setDiscarding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [menu, setMenu] = useState<null | { where: "composer" | "draft" | "library"; id?: string }>(null);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [pickingIssue, setPickingIssue] = useState<PendingPhoto | null>(null);
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
    if (!text || !token || sending || discarding || data?.archived) return;
    try {
      setSending(true);
      setError("");
      await reload(await api<ChatData>("chat", {
        token,
        body: {
          text,
          photoIds: pending.filter((photo) => photo.photoId).map((photo) => photo.photoId),
          attachments: pending.filter((photo) => photo.base64).map((photo) => ({ name: photo.name, mime: photo.mime, base64: photo.base64, issueId: photo.issueId || "" })),
        },
      }));
      setDraft("");
      setPending([]);
      setMenu(null);
      setPickingIssue(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  function photoError(file: { type?: string; size?: number }): string | null {
    const type = (file.type || "").toLowerCase();
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"].includes(type)) {
      return spanish ? "Ese tipo de archivo no es compatible. Use una foto JPEG, PNG, WEBP o GIF." : "That file type is not supported. Use a JPEG, PNG, WEBP, or GIF photo.";
    }
    if ((file.size || 0) > 4 * 1024 * 1024) {
      return spanish ? "Esa foto es demasiado grande. Cada foto debe ser de 4 MB o menos." : "That photo is too large. Each photo must be 4 MB or smaller.";
    }
    return null;
  }

  function addPending(photo: PendingPhoto) {
    setPending((current) => current.some((item) => item.key === photo.key || (photo.photoId && item.photoId === photo.photoId)) ? current : [...current, photo].slice(0, 4));
    setMenu(null);
    setPickingIssue(null);
  }

  function chooseFile(onFile: (file: { name: string; mime: string; base64: string }) => void) {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp,image/gif";
      input.onchange = () => {
        const chosen = input.files?.[0];
        if (!chosen) return;
        const reason = photoError(chosen);
        if (reason) {
          setError(reason);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const raw = String(reader.result || "");
          onFile({ name: chosen.name, mime: chosen.type || "image/jpeg", base64: raw.split(",")[1] || "" });
        };
        reader.readAsDataURL(chosen);
      };
      input.click();
      return;
    }
    void ImagePicker.launchImageLibraryAsync({ base64: true, mediaTypes: ["images"], quality: 0.6 }).then((result) => {
      const asset = result.canceled ? null : result.assets[0];
      if (!asset?.base64) return;
      const mime = asset.mimeType || "image/jpeg";
      const reason = photoError({ type: mime, size: asset.fileSize });
      if (reason) {
        setError(reason);
        return;
      }
      onFile({ name: asset.fileName || "photo.jpg", mime, base64: asset.base64 });
    });
  }

  function stageNewPhoto() {
    const issues = data?.issues || [];
    chooseFile((file) => {
      const next = { key: `${Date.now()}`, name: file.name, mime: file.mime, base64: file.base64, preview: `data:${file.mime};base64,${file.base64}`, issueId: issues.length === 1 ? issues[0].id : null };
      if (issues.length > 1) setPickingIssue(next);
      else addPending(next);
      setMenu(null);
    });
  }

  async function saveDraftPhoto(messageId: string, body: Record<string, unknown>) {
    if (!token || sending) return;
    try {
      setSending(true);
      setError("");
      await reload(await api<ChatData>("chat/draft/photo", { token, body: { id: messageId, ...body } }));
      setMenu(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the photo.");
    } finally {
      setSending(false);
    }
  }

  async function removeDraftPhoto(messageId: string, photoId: string) {
    if (!token || sending) return;
    try {
      setSending(true);
      setError("");
      await reload(await api<ChatData>("chat/draft/photo/remove", { token, body: { id: messageId, photoId } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the photo.");
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
    if (!token || sending || discarding) return;
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
    if (!token || sending || discarding) return;
    try {
      setDiscarding(true);
      setError("");
      await reload(await api<ChatData>("chat/draft/discard", { token, body: { id } }));
      if (editingId === id) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not discard the draft.");
    } finally {
      setDiscarding(false);
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
                  {(item.photos || []).length ? (
                    <View style={styles.thumbs}>
                      {(item.photos || []).map((photo) => (
                        <View key={photo.id} style={styles.thumbWrap}>
                          <PhotoThumb fileId={photo.fileId} token={token} />
                          <Pressable accessibilityRole="button" accessibilityLabel={spanish ? "Quitar foto" : "Remove photo"} onPress={() => void removeDraftPhoto(item.id, photo.id)}>
                            <Text style={styles.removeText}>{spanish ? "Quitar" : "Remove"}</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {menu?.where === "draft" && menu.id === item.id ? (
                    <View style={styles.menu}>
                      <Pressable style={styles.menuButton} accessibilityRole="button" accessibilityLabel={spanish ? "Foto nueva" : "New photo"} onPress={() => chooseFile((file) => { void saveDraftPhoto(item.id, { attachment: file }); })}>
                        <Text style={styles.menuText}>{spanish ? "Foto nueva" : "New photo"}</Text>
                      </Pressable>
                      <Pressable style={styles.menuButton} accessibilityRole="button" accessibilityLabel={spanish ? "Foto ya guardada" : "Existing photo"} onPress={() => setMenu({ where: "library", id: item.id })}>
                        <Text style={styles.menuText}>{spanish ? "Foto ya guardada" : "Existing photo"}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {menu?.where === "library" && menu.id === item.id ? (
                    <View style={styles.thumbs}>
                      {(data?.library || []).filter((photo) => !item.logId || photo.logId === item.logId).map((photo) => (
                        <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={photo.caption || (spanish ? "Foto guardada" : "Saved photo")} onPress={() => void saveDraftPhoto(item.id, { photoId: photo.id })}>
                          <PhotoThumb fileId={photo.fileId} token={token} />
                        </Pressable>
                      ))}
                      {(data?.library || []).filter((photo) => !item.logId || photo.logId === item.logId).length === 0 ? <Text style={styles.prompt}>{spanish ? "Aún no hay fotos en esta solicitud." : "No saved photos on this request yet."}</Text> : null}
                    </View>
                  ) : null}
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
                    <Pressable style={styles.plus} accessibilityRole="button" accessibilityLabel={spanish ? "Agregar una foto" : "Add a photo"} disabled={Boolean(sending || data?.archived)} onPress={() => setMenu((open) => open?.id === item.id && open.where === "draft" ? null : { where: "draft", id: item.id })}>
                      <Text style={styles.plusText}>+</Text>
                    </Pressable>
                    <Pressable style={styles.primary} accessibilityRole="button" accessibilityLabel={labels?.send || "Send"} accessibilityState={{ disabled: Boolean(sending || discarding || data?.archived || data?.needsEmail) }} disabled={sending || discarding || data?.archived || data?.needsEmail} onPress={() => void sendDraftMessage(item.id, body)}>
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
                    <Pressable style={styles.ghost} accessibilityRole="button" accessibilityLabel={labels?.discard || "Discard"} disabled={sending || discarding || data?.archived} onPress={() => void discard(item.id)}>
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
                    {(item.photos || []).length ? (
                      <View style={styles.thumbs}>
                        {(item.photos || []).map((photo) => <PhotoThumb key={photo.id} fileId={photo.fileId} token={token} />)}
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.meta}>{item.time} · {item.status}</Text>
                </View>
                {item.detail ? <LearnMore label="Email details">{item.detail}</LearnMore> : null}
              </View>
            );
          }}
        />
        <ErrorLine message={error} />
        {pending.length ? (
          <View style={styles.pending}>
            {pending.map((photo) => (
              <View key={photo.key} style={styles.thumbWrap}>
                {photo.preview ? <Image source={{ uri: photo.preview }} style={styles.preview} /> : photo.fileId ? <PhotoThumb fileId={photo.fileId} token={token} /> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={spanish ? "Quitar foto" : "Remove photo"} onPress={() => setPending((current) => current.filter((item) => item.key !== photo.key))}>
                  <Text style={styles.removeText}>{spanish ? "Quitar" : "Remove"}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {menu?.where === "composer" ? (
          <View style={styles.menu}>
            <Pressable style={styles.menuButton} accessibilityRole="button" accessibilityLabel={spanish ? "Foto nueva" : "New photo"} onPress={stageNewPhoto}>
              <Text style={styles.menuText}>{spanish ? "Foto nueva" : "New photo"}</Text>
            </Pressable>
            <Pressable style={styles.menuButton} accessibilityRole="button" accessibilityLabel={spanish ? "Foto ya guardada" : "Existing photo"} onPress={() => setMenu({ where: "library" })}>
              <Text style={styles.menuText}>{spanish ? "Foto ya guardada" : "Existing photo"}</Text>
            </Pressable>
          </View>
        ) : null}
        {menu?.where === "library" && !menu.id ? (
          <View style={styles.thumbs}>
            {(data?.library || []).map((photo) => (
              <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={photo.caption || (spanish ? "Foto guardada" : "Saved photo")} onPress={() => addPending({ key: photo.id, name: photo.caption || "photo.jpg", photoId: photo.id, fileId: photo.fileId, issueId: photo.logId })}>
                <PhotoThumb fileId={photo.fileId} token={token} />
              </Pressable>
            ))}
            {(data?.library || []).length === 0 ? <Text style={styles.prompt}>{spanish ? "Aún no hay fotos guardadas." : "No saved photos yet."}</Text> : null}
          </View>
        ) : null}
        {pickingIssue ? (
          <View style={styles.menu}>
            <Pressable style={styles.menuButton} accessibilityRole="button" accessibilityLabel={spanish ? "Cancelar" : "Cancel"} onPress={() => setPickingIssue(null)}>
              <Text style={styles.menuText}>{spanish ? "Cancelar" : "Cancel"}</Text>
            </Pressable>
            {(data?.issues || []).map((issue) => (
              <Pressable key={issue.id} style={styles.menuButton} accessibilityRole="button" accessibilityLabel={issue.title} onPress={() => addPending({ ...pickingIssue, issueId: issue.id })}>
                <Text style={styles.menuText}>{issue.title}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.composer}>
          <Pressable style={styles.plus} onPress={() => setMenu((open) => open?.where === "composer" ? null : { where: "composer" })} disabled={Boolean(data?.archived)} accessibilityRole="button" accessibilityLabel={spanish ? "Agregar una foto" : "Add a photo"}>
            <Text style={styles.plusText}>+</Text>
          </Pressable>
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
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  thumbWrap: { alignItems: "flex-start" },
  preview: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.line },
  removeText: { color: colors.bad, fontSize: 13, fontWeight: "700", marginTop: 4 },
  pending: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.card },
  menu: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.card },
  menuButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, justifyContent: "center", paddingHorizontal: 12 },
  menuText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  plus: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: "white", flexShrink: 0 },
  plusText: { fontSize: 28, color: colors.pine, lineHeight: 32 },
  composer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
  input: { flex: 1, minHeight: 48, backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, fontSize: 16, color: colors.ink },
  send: { minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 },
  sendText: { color: colors.pine, fontWeight: "700", fontSize: 17 },
});
