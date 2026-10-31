import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { Address } from "@/address";
import { saveAuthorizedFile } from "@/files";
import type { Notice } from "@/session";
import { useSession } from "@/session";
import { TabLoading, TypingBubble } from "@/typing-dots";
import { Logo } from "@/logo";
import { colors } from "@/theme";
import { ErrorLine, clipX, wrapMarker, wrapText } from "@/ui";
import { useLoad } from "@/use-load";
import { asksForName, NamePrompt } from "@/name-prompt";
import * as ImagePicker from "expo-image-picker";
import { PhotoThumb } from "@/photo-thumb";
import type { StepItem } from "@/next-steps";

type Action = { id: string; label: string };
type RepairPhoto = { key?: string; fileId?: string; photoId?: string; name: string; mime?: string; base64?: string; preview?: string };
type RepairForm = { summary: string; description: string; room: string | null; tier: "routine" | "urgent"; suggested: "routine" | "urgent"; tiers?: boolean; photos?: { fileId: string; name: string }[] };
type LibraryPhoto = { id: string; fileId: string; name: string };
type Item =
  | { role: "user"; id?: string; text: string }
  | { role: "card"; id?: string; headline: string; status: string; action: Action | null; actions?: Action[]; detail: string; ruleId: string | null; legal?: boolean; notice?: Notice; badge?: "urgent" | "violation"; sender?: string; safety?: string; form?: RepairForm; address?: { street?: string; unit?: string; city?: string; region?: string; postalCode?: string } | null };
type SendExtra = { action?: string; draftId?: string; attachment?: Attachment | null; summary?: string; description?: string; tier?: string; photos?: RepairPhoto[] };
type PendingSend = { id: string; text: string; extra?: SendExtra };
type Thread = {
  landlord: string;
  needsUnit?: boolean;
  archived?: boolean;
  archivedNote?: string | null;
  items: Item[];
  chips: { label: string; text: string }[];
  notice: Notice;
  steps?: { title: string; held: string; items: StepItem[] };
  issues?: { id: string; title: string }[];
  library?: LibraryPhoto[];
  packetFile?: string;
  coverageNotice?: string | null;
};
type Attachment = { name: string; mime: string; base64: string };

function offlineReply(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  return /could not reach rent right|failed to fetch|network request failed|load failed|network error|timeout|timed out|the operation was aborted/i.test(error.message);
}

function connectionClosed(error: unknown): boolean {
  return error instanceof Error && /database connection closed|network connection lost/i.test(error.message);
}

function newId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function starterChips(spanish: boolean): { label: string; text: string }[] {
  return spanish
    ? [
        { label: "Solicitar una reparación", text: "Quiero solicitar una reparacion" },
        { label: "Revisar mi contrato de arrendamiento", text: "Revisar mi contrato" },
        { label: "¿Es legal mi aumento de renta?", text: "Es legal mi aumento de renta?" },
        { label: "Recuperar mi depósito", text: "Como recupero mi deposito?" },
      ]
    : [
        { label: "Request a repair", text: "I need to request a repair" },
        { label: "Review my lease agreement", text: "Review my lease agreement" },
        { label: "Is my rent increase legal?", text: "Is my rent increase legal?" },
        { label: "Get my deposit back", text: "How do I get my deposit back?" },
      ];
}

function blankThread(current: Thread, spanish: boolean): Thread {
  return {
    ...current,
    items: [],
    chips: starterChips(spanish),
    steps: {
      title: current.steps?.title || (spanish ? "Sus próximos pasos" : "Your next steps"),
      held: current.steps?.held || (spanish ? "No se envió nada." : "Nothing was sent."),
      items: [],
    },
  };
}

export default function AssistantChat() {
  const { data, error, loading, reload, setError, token } = useLoad<Thread>("thread");
  const { me, signOut } = useSession();
  const spanish = me?.user.locale === "es";
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [linkIssue, setLinkIssue] = useState<string | null>(null);
  const [pickingIssue, setPickingIssue] = useState(false);
  const [account, setAccount] = useState(false);
  const [confirm, setConfirm] = useState<"new" | "clear" | null>(null);
  const [pending, setPending] = useState<PendingSend | null>(null);
  const [retryNote, setRetryNote] = useState("");
  const lock = useRef(false);
  const shiftHeld = useRef(false);
  const listRef = useRef<FlatList<Item>>(null);

  const canSend = !busy && !data?.archived && (draft.trim().length > 0 || Boolean(file));
  const retryCopy = spanish ? "La respuesta no llegó. Envíe el mensaje otra vez." : "The reply didn't arrive. Send the message again.";

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 40);
    return () => clearTimeout(timer);
  }, [pending]);

  async function send(text: string, extra?: SendExtra, clientId?: string) {
    const body = text.trim();
    const attachment = extra && "attachment" in extra ? extra.attachment ?? null : file;
    if (!token || lock.current || busy) return;
    if (!body && !extra?.action && !attachment) return;
    const id = clientId || (pending && pending.text === body ? pending.id : newId());
    const outbound: PendingSend = { id, text: body, extra };
    try {
      lock.current = true;
      setBusy(true);
      setPending(outbound);
      setRetryNote("");
      setError("");
      const payload = { text: body, action: extra?.action, draftId: extra?.draftId, attachment, summary: extra?.summary, description: extra?.description, tier: extra?.tier, photos: extra?.photos, clientId: id };
      const post = () => api<Thread>("thread", { token, body: payload });
      let next: Thread;
      try {
        next = await post();
      } catch (err) {
        if (!connectionClosed(err)) throw err;
        next = await post();
      }
      await reload(next);
      if (extra?.action === "send" || extra?.action?.startsWith("repair-save:")) {
        const { offerPushRegistration } = await import("@/push");
        void offerPushRegistration(token);
      }
      setDraft("");
      setFile(null);
      setLinkIssue(null);
      setPickingIssue(false);
      setMenu(false);
      setPending(null);
    } catch (err) {
      setPending(outbound);
      if (offlineReply(err)) {
        setRetryNote(retryCopy);
        setError("");
      } else {
        setRetryNote("");
        setError(err instanceof Error && err.message ? err.message : retryCopy);
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function clearChat() {
    if (!token || lock.current || !data) return;
    const previous = data;
    try {
      lock.current = true;
      setError("");
      setPending(null);
      setConfirm(null);
      setMenu(false);
      setAccount(false);
      setDraft("");
      setFile(null);
      await reload(blankThread(previous, spanish));
      const next = await api<Thread>("thread", { token, body: { action: "clear" } });
      await reload(next);
    } catch (err) {
      await reload(previous);
      setError(err instanceof Error ? err.message : "Could not clear the chat.");
    } finally {
      lock.current = false;
    }
  }

  async function logOut() {
    await signOut();
    router.replace("/");
  }

  function onEnter(shift: boolean) {
    if (shift || !canSend) return;
    if (linkIssue && file) void send(draft, { action: `photo-link:${linkIssue}` });
    else void send(draft);
  }

  async function onAction(action: Action, form?: { summary: string; description: string; tier: string; photos?: RepairPhoto[] }) {
    if (action.id === "add-unit") {
      router.push("/setup");
      return;
    }
    if (action.id === "upload-lease") {
      chooseLease((chosen) => { void send("lease", { action: "upload-lease", attachment: chosen }); });
      return;
    }
    if (action.id === "open-landlord" || action.id === "add-landlord") {
      router.push("/landlord");
      return;
    }
    if (action.id === "download-packet") {
      if (!token) return;
      try {
        setError("");
        const saved = await saveAuthorizedFile("/api/packet", data?.packetFile || "rent-right-evidence.pdf", token);
        if (saved === "needs-landlord") router.push("/landlord");
      }
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
    if (action.id.startsWith("review-send:")) {
      router.push({ pathname: "/landlord", params: { draft: action.id.slice("review-send:".length) } });
      return;
    }
    if (action.id.startsWith("send:")) {
      await send("", { action: "send", draftId: action.id.slice(5) });
      return;
    }
    if (action.id.startsWith("repair-save:")) {
      await send("", { action: action.id, summary: form?.summary, description: form?.description, tier: form?.tier, photos: form?.photos });
      return;
    }
    if (action.id.startsWith("repair-cancel:") || action.id.startsWith("repair-undo:") || action.id.startsWith("repair-keep:") || action.id.startsWith("resolve:") || action.id.startsWith("merge:") || action.id === "repair-new") {
      await send("", { action: action.id });
    }
  }

  function pickWeb(accept: string, onChosen?: (file: Attachment) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const chosen = input.files?.[0];
      if (!chosen) return;
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result || "");
        const next = { name: chosen.name, mime: chosen.type || "application/octet-stream", base64: raw.split(",")[1] || "" };
        if (onChosen) onChosen(next);
        else setFile(next);
        setMenu(false);
      };
      reader.readAsDataURL(chosen);
    };
    input.click();
  }

  function chooseLease(onChosen: (file: Attachment) => void) {
    if (Platform.OS === "web") {
      pickWeb(".pdf,.txt,image/*", onChosen);
      return;
    }
    void ImagePicker.launchImageLibraryAsync({ base64: true, mediaTypes: ["images"], quality: 0.6 }).then((result) => {
      const asset = result.canceled ? null : result.assets[0];
      if (asset?.base64) onChosen({ name: asset.fileName || "lease.jpg", mime: asset.mimeType || "image/jpeg", base64: asset.base64 });
    });
  }

  function keepIssuePhoto(chosen: Attachment) {
    setFile(chosen);
    setLinkIssue(null);
    setPickingIssue(Boolean(data?.issues?.length));
  }

  async function pickIssuePhoto() {
    if (Platform.OS === "web") {
      pickWeb("image/*", keepIssuePhoto);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, mediaTypes: ["images"], quality: 0.6 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset?.base64) keepIssuePhoto({ name: asset.fileName || "photo.jpg", mime: asset.mimeType || "image/jpeg", base64: asset.base64 });
    setMenu(false);
  }

  function pickLease() {
    chooseLease((chosen) => { void send(chosen.name, { action: "upload-lease", attachment: chosen }); });
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
          <Pressable onPress={() => { setAccount(false); router.push("/residence"); }} accessibilityRole="button" accessibilityLabel={spanish ? "Vivienda" : "Residence"} style={styles.accountButton}>
            <Text style={styles.headerButtonText}>{spanish ? "Vivienda" : "Residence"}</Text>
          </Pressable>
          <Pressable onPress={() => { setAccount(false); router.push("/settings"); }} accessibilityRole="button" accessibilityLabel={spanish ? "Ajustes" : "Settings"} style={styles.accountButton}>
            <Text style={styles.headerButtonText}>{spanish ? "Ajustes" : "Settings"}</Text>
          </Pressable>
          <Pressable onPress={() => void logOut()} accessibilityRole="button" accessibilityLabel={spanish ? "Cerrar sesión" : "Log out"} style={styles.accountButton}>
            <Text style={styles.headerButtonText}>{spanish ? "Cerrar sesión" : "Log out"}</Text>
          </Pressable>
        </View>
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ref={listRef}
          style={clipX}
          data={items}
          keyExtractor={(item) => item.id || `${item.role}:${item.role === "user" ? item.text : item.headline}`}
          contentContainerStyle={styles.list}
          ListHeaderComponent={data?.coverageNotice || data?.archivedNote || (me?.needsUnit && items.length === 0) ? (
            <View style={styles.place}>
              {data?.coverageNotice ? <Text style={styles.coverage}>{data.coverageNotice}</Text> : null}
              {data?.archivedNote ? <Text style={styles.support}>{data.archivedNote}</Text> : null}
              {me?.needsUnit && items.length === 0 ? <Text style={styles.support}>{spanish ? "Agregue su dirección para guardar registros y escribirle al propietario." : "Add your address to keep records and write to your landlord."}</Text> : null}
              {me?.needsUnit && items.length === 0 ? (
                <Pressable style={styles.chip} onPress={() => router.push("/setup")} accessibilityRole="button" accessibilityLabel={spanish ? "Agregar su vivienda" : "Add your place"}>
                  <Text style={styles.chipText}>{spanish ? "Agregar su vivienda" : "Add your place"}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          ListEmptyComponent={loading && !data && !error ? <TabLoading label={spanish ? "Cargando" : "Loading"} /> : (
            <View>
              <Text style={styles.intro}>{spanish ? "Cuénteme qué pasó." : "Tell me what happened."}</Text>
              <Text style={styles.support}>{spanish ? "Un fregadero que gotea, un aumento, o su depósito." : "A leaking sink, a rent increase, or your deposit."}</Text>
              {(data?.chips || []).map((chip) => (
                <Pressable key={chip.label} style={[styles.chip, busy && styles.sendOff]} onPress={() => send(chip.text)} disabled={busy} accessibilityRole="button" accessibilityLabel={chip.label} accessibilityState={{ disabled: busy }}>
                  <Text style={styles.chipText}>{chip.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          ListFooterComponent={(
            <View>
              {pending && !items.some((item) => item.id === pending.id) ? (
                <View>
                  {pending.text ? (
                    <View style={styles.userRow}>
                      <View style={styles.userBubble}><Text style={styles.userText}>{pending.text}</Text></View>
                    </View>
                  ) : null}
                  {error ? null : <TypingBubble label={spanish ? "Respondiendo" : "Replying"} />}
                </View>
              ) : null}
              {retryNote ? (
                <View style={styles.retry} accessibilityRole="text" accessibilityLiveRegion="polite">
                  <Text style={styles.support}>{retryNote}</Text>
                </View>
              ) : null}
            </View>
          )}
          renderItem={({ item }) => item.role === "user" ? (
            <View style={styles.userRow}>
              <View style={styles.userBubble}><Text style={styles.userText}>{item.text}</Text></View>
            </View>
          ) : (
            <CardView item={item} spanish={spanish} busy={busy} token={token} library={data?.library || []} showTiers={item.role === "card" && item.form?.tiers !== false && !data?.coverageNotice} onAction={onAction} onNameSaved={() => { void reload(); }} />
          )}
        />
        <ErrorLine message={error} onRetry={!pending && !data ? () => void reload() : undefined} retryLabel={spanish ? "Reintentar" : "Retry"} />
        {error && pending ? (
          <Pressable style={styles.headerButton} onPress={() => void send(pending.text, pending.extra, pending.id)} disabled={busy} accessibilityRole="button" accessibilityLabel={spanish ? "Intentar de nuevo" : "Try again"}>
            <Text style={styles.headerButtonText}>{spanish ? "Intentar de nuevo" : "Try again"}</Text>
          </Pressable>
        ) : null}
        {file ? <Text style={styles.file}>{file.name}{linkIssue ? ` · ${(data?.issues || []).find((issue) => issue.id === linkIssue)?.title || ""}` : ""}</Text> : null}
        {menu ? (
          <View style={styles.menu}>
            <Pressable style={styles.menuButton} onPress={() => void pickIssuePhoto()} accessibilityRole="button" accessibilityLabel={spanish ? "Foto del problema" : "Issue photo"}><Text style={styles.menuText}>{spanish ? "Foto del problema" : "Issue photo"}</Text></Pressable>
            <Pressable style={styles.menuButton} onPress={pickLease} accessibilityRole="button" accessibilityLabel={spanish ? "Contrato" : "Lease"}><Text style={styles.menuText}>{spanish ? "Contrato" : "Lease"}</Text></Pressable>
          </View>
        ) : null}
        {pickingIssue && file ? (
          <View style={styles.menu}>
            <Pressable style={styles.menuButton} onPress={() => { setLinkIssue(null); setPickingIssue(false); }} accessibilityRole="button" accessibilityLabel={spanish ? "Solicitud nueva" : "New request"}><Text style={styles.menuText}>{spanish ? "Solicitud nueva" : "New request"}</Text></Pressable>
            {(data?.issues || []).map((issue) => (
              <Pressable key={issue.id} style={styles.menuButton} onPress={() => { setLinkIssue(issue.id); setPickingIssue(false); }} accessibilityRole="button" accessibilityLabel={issue.title}><Text style={styles.menuText}>{issue.title}</Text></Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.composer}>
          <Pressable style={styles.plus} onPress={() => { setPickingIssue(false); setMenu((open) => !open); }} accessibilityRole="button" accessibilityLabel={spanish ? "Agregar una foto o un contrato" : "Add an issue photo or a lease"}>
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
            onPress={() => { if (linkIssue && file) void send(draft, { action: `photo-link:${linkIssue}` }); else void send(draft); }}
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

function CardView({ item, spanish, busy, token, library, showTiers, onAction, onNameSaved }: { item: Extract<Item, { role: "card" }>; spanish: boolean; busy: boolean; token: string | null; library: LibraryPhoto[]; showTiers: boolean; onAction: (action: Action, form?: { summary: string; description: string; tier: string; photos?: RepairPhoto[] }) => void; onNameSaved: () => void }) {
  const [advice, setAdvice] = useState(false);
  const [details, setDetails] = useState(false);
  const [summary, setSummary] = useState(item.form?.summary || "");
  const [description, setDescription] = useState(item.form && item.form.description.trim() === item.form.summary.trim() ? "" : (item.form?.description || ""));
  const [tier, setTier] = useState<"routine" | "urgent">(item.form?.tier || "routine");
  const [photos, setPhotos] = useState<RepairPhoto[]>(() => (item.form?.photos || []).map((photo) => ({ key: photo.fileId, fileId: photo.fileId, name: photo.name })));
  const [photoMenu, setPhotoMenu] = useState<"add" | "library" | null>(null);
  const summaryRef = useRef<TextInput>(null);
  const actions = (item.actions?.length ? item.actions : item.action ? [item.action] : []).filter((action) => !action.id.startsWith("repair-edit:"));
  async function addNewPhoto() {
    setPhotoMenu(null);
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, mediaTypes: ["images"], quality: 0.6 });
    const asset = result.assets?.[0];
    const base64 = asset?.base64;
    if (!asset || !base64) return;
    setPhotos((current) => current.length >= 4 ? current : [...current, { key: `${Date.now()}`, name: asset.fileName || "photo.jpg", mime: asset.mimeType || "image/jpeg", base64, preview: asset.uri }]);
  }
  const picker = actions.some((action) => action.id === "reset" || action.id.startsWith("prompt:"));
  const looks = tier === "urgent"
    ? (spanish ? "Parece urgente, cámbielo si no." : "Looks urgent, change if not.")
    : (spanish ? "Parece de rutina, cámbielo si no." : "Looks routine, change if not.");
  return (
    <View style={styles.card} {...wrapMarker()}>
      <Text style={styles.headline}>{item.headline}</Text>
      {item.safety ? <Text style={styles.safety}>{item.safety}</Text> : null}
      {item.badge === "urgent" ? <Text style={styles.urgent}>{spanish ? "Urgente" : "Urgent"}</Text> : null}
      {item.badge === "violation" ? <Text style={styles.flag}>{spanish ? "Esto puede no seguir las reglas de California" : "This may not follow California rules"}</Text> : null}
      {item.form ? <Text style={styles.status}>{looks}</Text> : item.status ? <Text style={styles.status}>{item.status}</Text> : null}
      {item.form ? (
        <View>
          <Text style={styles.fieldLabel}>{spanish ? "Resumen" : "Summary"}</Text>
          <TextInput ref={summaryRef} value={summary} onChangeText={setSummary} style={styles.field} accessibilityLabel={spanish ? "Resumen" : "Summary"} />
          {item.form.room ? <Text style={styles.detail}>{item.form.room}</Text> : null}
          <Text style={styles.fieldLabel}>{spanish ? "Descripción" : "Description"}</Text>
          <TextInput value={description} onChangeText={setDescription} placeholder={spanish ? "Agregue detalles (opcional)" : "Add details (optional)"} placeholderTextColor={colors.mute} style={[styles.field, styles.fieldTall]} multiline accessibilityLabel={spanish ? "Descripción" : "Description"} />
          <Pressable onPress={() => setPhotoMenu((open) => open ? null : "add")} accessibilityRole="button" accessibilityLabel={spanish ? "Agregar fotos" : "Add photos"}>
            <Text style={styles.note}>{spanish ? "Agregar fotos" : "Add photos"}</Text>
          </Pressable>
          {photoMenu === "add" ? (
            <View style={styles.menu}>
              <Pressable style={styles.menuButton} onPress={() => void addNewPhoto()} accessibilityRole="button" accessibilityLabel={spanish ? "Foto nueva" : "New photo"}><Text style={styles.menuText}>{spanish ? "Foto nueva" : "New photo"}</Text></Pressable>
              <Pressable style={styles.menuButton} onPress={() => setPhotoMenu("library")} accessibilityRole="button" accessibilityLabel={spanish ? "Foto ya guardada" : "Existing photo"}><Text style={styles.menuText}>{spanish ? "Foto ya guardada" : "Existing photo"}</Text></Pressable>
            </View>
          ) : null}
          {photoMenu === "library" ? (
            <View style={styles.menu}>
              {library.map((photo) => (
                <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={photo.name || (spanish ? "Foto guardada" : "Saved photo")} onPress={() => setPhotos((current) => current.some((item) => item.fileId === photo.fileId) || current.length >= 4 ? current : [...current, { key: photo.id, name: photo.name, fileId: photo.fileId, photoId: photo.id }])}>
                  <PhotoThumb fileId={photo.fileId} token={token} />
                </Pressable>
              ))}
              {library.length === 0 ? <Text style={styles.detail}>{spanish ? "Aún no hay fotos guardadas." : "No saved photos yet."}</Text> : null}
            </View>
          ) : null}
          {photos.length ? (
            <View style={styles.menu}>
              {photos.map((photo) => (
                <View key={photo.key || photo.fileId || photo.name}>
                  {photo.preview ? <Image source={{ uri: photo.preview }} style={styles.draftThumb} /> : photo.fileId ? <PhotoThumb fileId={photo.fileId} token={token} /> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={spanish ? "Quitar foto" : "Remove photo"} onPress={() => setPhotos((current) => current.filter((item) => item !== photo))}>
                    <Text style={styles.note}>{spanish ? "Quitar" : "Remove"}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          {showTiers ? <View style={styles.tiers}>
            {([
              ["routine", spanish ? "Rutina" : "Routine"],
              ["urgent", spanish ? "Urgente" : "Urgent"],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                style={[styles.tierButton, tier === value && styles.tierOn]}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: tier === value }}
                onPress={() => setTier(value)}
              >
                <Text style={[styles.tierText, value === "urgent" && styles.urgent]}>{label}</Text>
              </Pressable>
            ))}
          </View> : null}
        </View>
      ) : null}
      {item.sender && asksForName(item.sender) ? <NamePrompt message={item.sender} onSaved={onNameSaved} /> : item.sender ? <Text style={[styles.detail, wrapText]}>{item.sender}</Text> : null}
      {item.sender?.includes("\n") ? null : item.address?.street || item.address?.city ? (
        <Address street={item.address.street} unit={item.address.unit} city={item.address.city} region={item.address.region} postalCode={item.address.postalCode} style={styles.detail} />
      ) : null}
      {picker && item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
      {actions.map((action) => {
        const suggestion = action.id.startsWith("prompt:") || action.id.startsWith("repair-edit:");
        const reset = action.id === "reset" || action.id.startsWith("repair-cancel:") || action.id.startsWith("repair-undo:") || action.id.startsWith("repair-keep:");
        return (
          <Pressable
            key={action.id}
            style={suggestion ? styles.suggest : reset ? styles.cancel : styles.action}
            onPress={() => {
              if (action.id.startsWith("repair-save:")) onAction(action, { summary, description, tier, photos: photos.map(({ fileId, photoId, name, mime, base64 }) => ({ fileId, photoId, name, mime, base64 })) });
              else onAction(action);
            }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: busy }}
          >
            <Text style={suggestion || reset ? styles.suggestText : styles.actionText}>{action.label}</Text>
          </Pressable>
        );
      })}
      {item.form && item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
      {!picker && !item.form && item.detail ? (
        <View>
          <Pressable onPress={() => setDetails((open) => !open)} accessibilityRole="button" accessibilityLabel={spanish ? "Detalles" : "Details"}>
            <Text style={styles.note}>{details ? (spanish ? "Ocultar" : "Hide") : (spanish ? "Detalles" : "Details")}</Text>
          </Pressable>
          {details ? <Text style={[styles.detail, wrapText]}>{`${item.detail}${item.ruleId ? `\n\n${item.ruleId}` : ""}`}</Text> : null}
        </View>
      ) : null}
      {item.legal && item.notice ? (
        <View>
          <Text style={styles.detail}>{item.notice.short}</Text>
          <Pressable onPress={() => setAdvice((open) => !open)} accessibilityRole="button" accessibilityLabel={spanish ? "Aviso completo" : "Full disclaimer"}>
            <Text style={styles.note}>{advice ? (spanish ? "Ocultar" : "Hide") : (spanish ? "Aviso completo" : "Full disclaimer")}</Text>
          </Pressable>
          {advice ? (
            <View>
              <Text style={[styles.detail, wrapText]}>{item.notice.full}</Text>
              {item.notice.clinicFull ? <Text style={[styles.detail, wrapText, styles.gap]}>{item.notice.clinicFull}</Text> : null}
            </View>
          ) : null}
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
  account: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  accountButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  list: { paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1, width: "100%", maxWidth: "100%", minWidth: 0 },
  place: { marginTop: 8 },
  intro: { fontSize: 22, color: colors.ink, marginTop: 16, lineHeight: 30 },
  support: { fontSize: 16, lineHeight: 24, color: colors.mute, marginTop: 8 },
  coverage: { ...wrapText, fontSize: 15, lineHeight: 22, color: colors.ink, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, marginTop: 8 },
  chip: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, minHeight: 48, justifyContent: "center", paddingVertical: 14, paddingHorizontal: 18, marginTop: 12 },
  chipText: { fontSize: 17, color: colors.ink },
  userRow: { alignItems: "flex-end", marginTop: 16, width: "100%", maxWidth: "100%", minWidth: 0, alignSelf: "stretch" },
  userBubble: { maxWidth: "82%", minWidth: 0, flexShrink: 1, backgroundColor: colors.tenant, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 14 },
  userText: { ...wrapText, color: "white", fontSize: 17, lineHeight: 24 },
  retry: { marginTop: 16, maxWidth: "92%", backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingVertical: 12 },
  card: { marginTop: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16, alignSelf: "stretch", width: "100%", maxWidth: "100%", minWidth: 0 },
  headline: { fontSize: 22, lineHeight: 28, color: colors.ink, fontWeight: "600" },
  status: { fontSize: 16, lineHeight: 22, color: colors.pine, marginTop: 6 },
  action: { marginTop: 12, backgroundColor: colors.pine, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  actionText: { color: "white", fontSize: 17, fontWeight: "700" },
  suggest: { marginTop: 10, backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, minHeight: 48, justifyContent: "center", paddingHorizontal: 16 },
  suggestText: { fontSize: 16, color: colors.ink, fontWeight: "600", textAlign: "center" },
  cancel: { marginTop: 8, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  urgent: { color: colors.bad, fontSize: 15, lineHeight: 20, fontWeight: "700", marginTop: 6 },
  flag: { ...wrapText, color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: "700", marginTop: 6 },
  note: { color: colors.pine, fontSize: 14, fontWeight: "700", marginTop: 12 },
  detail: { ...wrapText, color: colors.mute, fontSize: 14, lineHeight: 20, marginTop: 8 },
  safety: { ...wrapText, color: colors.bad, fontSize: 16, lineHeight: 22, fontWeight: "700", marginTop: 8 },
  fieldLabel: { color: colors.mute, fontSize: 13, fontWeight: "700", marginTop: 10 },
  field: { marginTop: 4, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.ink },
  fieldTall: { minHeight: 72, textAlignVertical: "top" },
  draftThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.line },
  tiers: { flexDirection: "row", gap: 8, marginTop: 10 },
  tierButton: { minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, justifyContent: "center", backgroundColor: colors.paper },
  tierOn: { borderColor: colors.pine, backgroundColor: "#E7F3F1" },
  tierText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  gap: { marginTop: 8 },
  file: { color: colors.pine, paddingHorizontal: 16, paddingBottom: 4 },
  menu: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  menuButton: { flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  menuText: { fontSize: 16, color: colors.ink, fontWeight: "600" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
  plus: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: "white", flexShrink: 0 },
  plusText: { fontSize: 28, color: colors.pine, lineHeight: 32 },
  input: { flex: 1, minHeight: 48, maxHeight: 96, backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: 16, color: colors.ink },
  send: { minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 8, flexShrink: 0 },
  sendOff: { opacity: 0.35 },
  sendText: { color: colors.pine, fontWeight: "700", fontSize: 17 },
  confirmWrap: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(20, 52, 60, 0.4)", justifyContent: "center", padding: 24 },
  confirmCard: { backgroundColor: colors.card, borderRadius: 16, padding: 20 },
});
