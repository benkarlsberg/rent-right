import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import { api } from "@/api";
import { DeleteAccount } from "@/delete-account";
import { saveAuthorizedFile } from "@/files";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { LanguageToggle } from "@/language-toggle";
import { colors } from "@/theme";
import { Button, ErrorLine, Field, H1, Muted, Page } from "@/ui";
import type { ScrollView } from "react-native";

function signedInAs(email: string, spanish: boolean): { title: string; detail: string } {
  if (/privaterelay\.appleid\.com$/i.test(email)) {
    return { title: spanish ? "Correo privado de Apple" : "Apple private email", detail: email };
  }
  return { title: email, detail: "" };
}

export default function Settings() {
  const params = useLocalSearchParams<{ focus?: string | string[] }>();
  const focusName = (Array.isArray(params.focus) ? params.focus[0] : params.focus) === "name";
  const { me, token, signIn, signOut } = useSession();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingLocale, setPendingLocale] = useState<"en" | "es" | null>(null);
  const [name, setName] = useState(me?.user.name || "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const spanish = (pendingLocale ?? me?.user.locale) === "es";
  const account = me?.user.email ? signedInAs(me.user.email, spanish) : null;
  const scrollRef = useRef<ScrollView>(null);
  const nameInput = useRef<TextInput>(null);
  const revealed = useRef(false);

  useEffect(() => {
    if (!dirty) setName(me?.user.name || "");
  }, [dirty, me?.user.name]);

  useEffect(() => {
    if (!focusName) return;
    const timer = setTimeout(() => nameInput.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [focusName]);

  function revealName(event: LayoutChangeEvent) {
    if (!focusName || revealed.current) return;
    revealed.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 8), animated: false });
    nameInput.current?.focus();
  }

  async function language(locale: "en" | "es") {
    if (!token || !me || locale === (pendingLocale ?? me.user.locale)) return;
    setPendingLocale(locale);
    try {
      setError("");
      await signIn(await api<Me>("settings", { token, body: { locale, name: me.user.name, lowBandwidth: me.user.lowBandwidth } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the language.");
    } finally {
      setPendingLocale(null);
    }
  }

  async function saveName() {
    if (!token || !me || saving) return;
    const next = name.trim().replace(/\s+/g, " ");
    try {
      setSaving(true);
      setError("");
      await signIn(await api<Me>("settings", {
        token,
        body: { name: next, locale: me.user.locale, lowBandwidth: me.user.lowBandwidth },
      }));
      setDirty(false);
      setNotice(spanish ? "Nombre guardado." : "Name saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : spanish ? "No se pudo guardar el nombre." : "Could not save the name.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page scrollRef={scrollRef}>
      <H1>{spanish ? "Ajustes" : "Settings"}</H1>
      <View style={styles.profile} onLayout={revealName} nativeID="profile-name">
        <Text style={styles.section}>{spanish ? "Perfil" : "Profile"}</Text>
        <Field
          label={spanish ? "Su nombre" : "Your name"}
          value={name}
          onChange={(value) => {
            setDirty(true);
            setNotice("");
            setName(value);
          }}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          nativeID="profile-name-input"
          inputRef={nameInput}
        />
        <Muted>
          {spanish
            ? "Este nombre aparece en el asunto y el encabezado de los correos al propietario."
            : "This name appears in the subject and header of emails to your landlord."}
        </Muted>
        <Button label={saving ? (spanish ? "Guardando" : "Saving") : (spanish ? "Guardar nombre" : "Save name")} onPress={() => void saveName()} disabled={saving} />
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>
      <LanguageToggle locale={spanish ? "es" : "en"} onChange={(next) => void language(next)} />
      {account ? (
        <View style={styles.block}>
          <Text style={styles.label}>{spanish ? "Sesión iniciada como" : "Signed in as"}</Text>
          <Text style={styles.value}>{account.title}</Text>
          {account.detail ? <Muted>{account.detail}</Muted> : null}
        </View>
      ) : null}
      {me?.unit?.relay ? (
        <View style={styles.block}>
          <Text style={styles.label}>{spanish ? "Dirección de respuesta del propietario" : "Your landlord reply address"}</Text>
          <Text style={styles.value}>{me.unit.relay}</Text>
          <Muted>
            {spanish
              ? "Las respuestas del propietario llegan a esta dirección. Es solo para esta vivienda, no es su correo de acceso."
              : "Replies from your landlord come to this address. It is only for this home, not your sign-in email."}
          </Muted>
        </View>
      ) : null}
      <Button label={spanish ? "Descargar mis datos" : "Download my data"} ghost onPress={() => token && saveAuthorizedFile("/api/export", "rent-right.json", token)} />
      {token ? (
        <DeleteAccount
          token={token}
          spanish={spanish}
          onDeleted={async () => {
            await signOut();
            router.replace("/");
          }}
        />
      ) : null}
      <ErrorLine message={error} />
      <Button label={spanish ? "Cerrar sesión" : "Sign out"} ghost onPress={async () => { await signOut(); router.replace("/"); }} />
    </Page>
  );
}

const styles = StyleSheet.create({
  profile: { marginTop: 8 },
  section: { color: colors.ink, fontSize: 13, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginTop: 20 },
  notice: { color: colors.pine, fontSize: 15, fontWeight: "700", marginTop: 8 },
  block: { marginTop: 20 },
  label: { color: colors.mute, fontSize: 13, fontWeight: "700" },
  value: { color: colors.ink, fontSize: 17, lineHeight: 24, marginTop: 4 },
});
