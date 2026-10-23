import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { saveAuthorizedFile } from "@/files";
import type { Notice } from "@/session";
import { useSession } from "@/session";
import { Logo } from "@/logo";
import { colors } from "@/theme";
import { ErrorLine, clipX, wrapMarker, wrapText } from "@/ui";
import { useLoad } from "@/use-load";
import { NextSteps, type StepItem } from "@/next-steps";
import * as ImagePicker from "expo-image-picker";

type Action = { id: string; label: string };
type Item =
  | { role: "user"; text: string }
  | { role: "card"; headline: string; status: string; action: Action | null; actions?: Action[]; detail: string; ruleId: string | null; notice: Notice };
type Thread = {
  landlord: string;
  needsUnit?: boolean;
  items: Item[];
  chips: { label: string; text: string }[];
  notice: Notice;
  steps?: { title: string; held: string; items: StepItem[] };
  packetFile?: string;
};
type Attachment = { name: string; mime: string; base64: string };

export default function AssistantChat() {
  const { data, error, reload, setError, token } = useLoad<Thread>("thread");
  const { me, signOut } = useSession();
  const spanish = me?.user.locale === "es";
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const [confirm, setConfirm] = useState<"new" | "clear" | null>(null);
  const [held, setHeld] = useState("");
  const lock = useRef(false);
  const shiftHeld = useRef(false);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const canSend = !busy && (draft.trim().length > 0 || Boolean(file));

  async function send(text: string, extra?: { action?: string; draftId?: string }) {
    const body = text.trim();
    if (!token || lock.current || busy) return;
    if (!body && !extra?.action && !file) return;
    try {
      lock.current = true;
      setBusy(true);
      setError("");
      await api("thread", { token, body: { text: body, action: extra?.action, draftId: extra?.draftId, attachment: file } });
      setDraft("");
      setFile(null);
      setMenu(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function clearChat() {
    if (!token || lock.current) return;
    try {
      lock.current = true;
      setBusy(true);
      setError("");
      await api("thread", { token, body: { action: "clear" } });
      setDraft("");
      setFile(null);
      setMenu(false);
      setAccount(false);
      setConfirm(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear the chat.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function logOut() {
    await signOut();
    router.replace("/");
  }

  function onEnter(shift: boolean) {
    if (shift || !canSend) return;
    void send(draft);
  }

  async function onAction(action: Action) {
    if (action.id === "open-landlord") {
      router.push("/landlord");
      return;
    }
    if (action.id === "download-packet") {
      if (!token) return;
      try { setError(""); await saveAuthorizedFile("/api/packet", data?.packetFile || "rent-right-evidence.pdf", token); }
      catch (err) { setError(err instanceof Error ? err.message : "Could not download."); }
      return;
    }
    if (action.id === "reset") {
      setConfirm("clear");
      return;
    }
    if (action.id.startsWith("prompt:")) {
      await send(action.id.slice("prompt:".length));
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
      <View style={styles.header} accessibilityRole="header">
        <Logo width={148} />
        <View style={styles.headerActions}>
          <Pressable onPress={() => setConfirm("new")} accessibilityRole="button" accessibilityLabel={spanish ? "Nuevo chat" : "New chat"} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>{spanish ? "Nuevo chat" : "New chat"}</Text>
          </Pressable>
          <Pressable onPress={() => setAccount((open) => !open)} accessibilityRole="button" accessibilityLabel={spanish ? "Menú de la cuenta" : "Account menu"} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>{spanish ? "Menú" : "Menu"}</Text>
          </Pressable>
        </View>
      </View>
      {account ? (
        <View style={styles.account}>
          <Pressable onPress={() => { setAccount(false); setConfirm("clear"); }} accessibilityRole="button" accessibilityLabel={spanish ? "Borrar chat" : "Clear chat"} style={styles.accountButton}>
            <Text style={styles.headerButtonText}>{spanish ? "Borrar chat" : "Clear chat"}</Text>
          </Pressable>
          <Pressable onPress={() => void logOut()} accessibilityRole="button" accessibilityLabel={spanish ? "Cerrar sesión" : "Log out"} style={styles.accountButton}>
            <Text style={styles.headerButtonText}>{spanish ? "Cerrar sesión" : "Log out"}</Text>
          </Pressable>
        </View>
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          style={clipX}
          data={items}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={me?.needsUnit ? (
            <View style={styles.place}>
              <Text style={styles.support}>{spanish ? "Agregue su dirección para guardar registros y escribirle al propietario." : "Add your address to keep records and write to your landlord."}</Text>
              <Pressable style={styles.chip} onPress={() => router.push("/setup")} accessibilityRole="button" accessibilityLabel={spanish ? "Agregar su vivienda" : "Add your place"}>
                <Text style={styles.chipText}>{spanish ? "Agregar su vivienda" : "Add your place"}</Text>
              </Pressable>
            </View>
          ) : null}
          ListEmptyComponent={
            <View>
              <Text style={styles.intro}>{spanish ? "Cuénteme qué pasó." : "Tell me what happened."}</Text>
              <Text style={styles.support}>{spanish ? "Un fregadero que gotea, un aumento, o su depósito." : "A leaking sink, a rent increase, or your deposit."}</Text>
              {(data?.chips || []).map((chip) => (
                <Pressable key={chip.label} style={styles.chip} onPress={() => send(chip.text)} accessibilityRole="button" accessibilityLabel={chip.label}>
                  <Text style={styles.chipText}>{chip.label}</Text>
                </Pressable>
              ))}
            </View>
          }
          ListFooterComponent={data?.steps?.items?.length ? (
            <NextSteps
              title={data.steps.title}
              steps={data.steps.items}
              note={held}
              onAction={(step) => {
                if (step.action === "wait") {
                  setHeld(data.steps?.held || "Nothing was sent.");
                  return;
                }
                if (step.action === "followup" || step.action === "send") {
                  router.push("/landlord");
                  return;
                }
                if (step.action === "export") {
                  void onAction({ id: "download-packet", label: step.button });
                  return;
                }
                if (step.action === "small_claims" && step.href) void Linking.openURL(step.href);
              }}
            />
          ) : null}
          renderItem={({ item }) => item.role === "user" ? (
            <View style={styles.userRow}>
              <View style={styles.userBubble}><Text style={styles.userText}>{item.text}</Text></View>
            </View>
          ) : (
            <CardView item={item} spanish={spanish} onAction={onAction} />
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
          <Pressable style={styles.plus} onPress={() => setMenu((open) => !open)} accessibilityRole="button" accessibilityLabel="Add a photo or lease">
            <Text style={styles.plusText}>+</Text>
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={(value) => {
              if (Platform.OS === "web" && value === `${draft}\n` && !shiftHeld.current) return;
              setDraft(value);
            }}
            multiline
            blurOnSubmit={false}
            submitBehavior={Platform.OS === "web" ? "newline" : "submit"}
            onSubmitEditing={() => { if (Platform.OS !== "web") onEnter(false); }}
            onKeyPress={(event) => {
              const native = event.nativeEvent as { key?: string; shiftKey?: boolean };
              shiftHeld.current = Boolean(native.shiftKey);
              if (native.key !== "Enter" || native.shiftKey) return;
              if (Platform.OS === "web") (event as { preventDefault?: () => void }).preventDefault?.();
              onEnter(false);
            }}
            placeholder="Message"
            placeholderTextColor={colors.mute}
            accessibilityLabel="Message"
            editable={!busy}
            style={styles.input}
          />
          <Pressable
            style={[styles.send, !canSend && styles.sendOff]}
            onPress={() => send(draft)}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend }}
          >
            <Text style={styles.sendText}>{busy ? (spanish ? "Enviando" : "Sending") : "Send"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {confirm ? (
        <View style={styles.confirmWrap}>
          <View style={styles.confirmCard}>
            <Text style={styles.headline}>{confirm === "new" ? (spanish ? "¿Empezar un chat nuevo?" : "Start a new chat?") : (spanish ? "¿Borrar este chat?" : "Clear this chat?")}</Text>
            <Text style={styles.support}>
              {spanish
                ? "Esta conversación sale de la pantalla. Los mensajes al propietario y los registros se quedan. Nada que ya se haya enviado se borra."
                : "This conversation leaves the screen. Landlord messages and saved records stay. Nothing already sent is deleted."}
            </Text>
            <Pressable style={styles.action} onPress={() => void clearChat()} accessibilityRole="button" accessibilityLabel={confirm === "new" ? "Start new chat" : "Clear chat"}>
              <Text style={styles.actionText}>{confirm === "new" ? (spanish ? "Empezar chat nuevo" : "Start new chat") : (spanish ? "Borrar chat" : "Clear chat")}</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setConfirm(null)} accessibilityRole="button" accessibilityLabel={spanish ? "Cancelar" : "Cancel"}>
              <Text style={styles.headerButtonText}>{spanish ? "Cancelar" : "Cancel"}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function CardView({ item, spanish, onAction }: { item: Extract<Item, { role: "card" }>; spanish: boolean; onAction: (action: Action) => void }) {
  const [advice, setAdvice] = useState(false);
  const [details, setDetails] = useState(false);
  const actions = item.actions?.length ? item.actions : item.action ? [item.action] : [];
  const picker = actions.some((action) => action.id === "reset" || action.id.startsWith("prompt:"));
  return (
    <View style={styles.card} {...wrapMarker()}>
      <Text style={styles.headline}>{item.headline}</Text>
      <Text style={styles.status}>{item.status}</Text>
      {actions.map((action) => {
        const suggestion = action.id.startsWith("prompt:");
        const reset = action.id === "reset";
        return (
          <Pressable
            key={action.id}
            style={suggestion ? styles.suggest : reset ? styles.cancel : styles.action}
            onPress={() => onAction(action)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text style={suggestion || reset ? styles.suggestText : styles.actionText}>{action.label}</Text>
          </Pressable>
        );
      })}
      {!picker && item.detail ? (
        <View>
          <Pressable onPress={() => setDetails((open) => !open)} accessibilityRole="button" accessibilityLabel={spanish ? "Detalles" : "Details"}>
            <Text style={styles.note}>{details ? (spanish ? "Ocultar" : "Hide") : (spanish ? "Detalles" : "Details")}</Text>
          </Pressable>
          {details ? <Text style={[styles.detail, wrapText]}>{`${item.detail}${item.ruleId ? `\n\n${item.ruleId}` : ""}`}</Text> : null}
        </View>
      ) : null}
      <Pressable onPress={() => setAdvice((open) => !open)} accessibilityRole="button" accessibilityLabel={spanish ? "No es asesoramiento legal" : "Not legal advice"}>
        <Text style={styles.note}>{advice ? (spanish ? "Ocultar" : "Hide") : (spanish ? "No es asesoramiento legal" : "Not legal advice")}</Text>
      </Pressable>
      {advice ? (
        <View>
          <Text style={[styles.detail, wrapText]}>{item.notice.full}</Text>
          {item.notice.clinicFull ? <Text style={[styles.detail, wrapText, styles.gap]}>{item.notice.clinicFull}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 8 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  headerButtonText: { color: colors.pine, fontSize: 15, fontWeight: "700" },
  account: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  accountButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  list: { paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1, width: "100%", maxWidth: "100%", minWidth: 0 },
  place: { marginTop: 8 },
  intro: { fontSize: 22, color: colors.ink, marginTop: 16, lineHeight: 30 },
  support: { fontSize: 16, lineHeight: 24, color: colors.mute, marginTop: 8 },
  chip: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, minHeight: 48, justifyContent: "center", paddingVertical: 14, paddingHorizontal: 18, marginTop: 12 },
  chipText: { fontSize: 17, color: colors.ink },
  userRow: { alignItems: "flex-end", marginTop: 16, width: "100%", maxWidth: "100%", minWidth: 0, alignSelf: "stretch" },
  userBubble: { maxWidth: "82%", minWidth: 0, flexShrink: 1, backgroundColor: colors.tenant, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 14 },
  userText: { ...wrapText, color: "white", fontSize: 17, lineHeight: 24 },
  card: { marginTop: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16, alignSelf: "stretch", width: "100%", maxWidth: "100%", minWidth: 0 },
  headline: { fontSize: 22, lineHeight: 28, color: colors.ink, fontWeight: "600" },
  status: { fontSize: 16, lineHeight: 22, color: colors.pine, marginTop: 6 },
  action: { marginTop: 12, backgroundColor: colors.pine, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  actionText: { color: "white", fontSize: 17, fontWeight: "700" },
  suggest: { marginTop: 10, backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, minHeight: 48, justifyContent: "center", paddingHorizontal: 16 },
  suggestText: { fontSize: 16, color: colors.ink, fontWeight: "600" },
  cancel: { marginTop: 8, minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  note: { color: colors.pine, fontSize: 14, fontWeight: "700", marginTop: 12 },
  detail: { ...wrapText, color: colors.mute, fontSize: 14, lineHeight: 20, marginTop: 8 },
  gap: { marginTop: 8 },
  file: { color: colors.pine, paddingHorizontal: 16, paddingBottom: 4 },
  menu: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  menuButton: { flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  menuText: { fontSize: 16, color: colors.ink, fontWeight: "600" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
  plus: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: "white" },
  plusText: { fontSize: 28, color: colors.pine, lineHeight: 32 },
  input: { flex: 1, minHeight: 48, maxHeight: 96, backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: 16, color: colors.ink },
  send: { minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 },
  sendOff: { opacity: 0.35 },
  sendText: { color: colors.pine, fontWeight: "700", fontSize: 17 },
  confirmWrap: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(20, 52, 60, 0.4)", justifyContent: "center", padding: 24 },
  confirmCard: { backgroundColor: colors.card, borderRadius: 16, padding: 20 },
});
