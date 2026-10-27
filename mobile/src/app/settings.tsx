import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api";
import { DeleteAccount } from "@/delete-account";
import { saveAuthorizedFile } from "@/files";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { LanguageToggle } from "@/language-toggle";
import { colors } from "@/theme";
import { Button, ErrorLine, H1, Muted, Page } from "@/ui";

function signedInAs(email: string, spanish: boolean): { title: string; detail: string } {
  if (/privaterelay\.appleid\.com$/i.test(email)) {
    return { title: spanish ? "Correo privado de Apple" : "Apple private email", detail: email };
  }
  return { title: email, detail: "" };
}

export default function Settings() {
  const { me, token, signIn, signOut } = useSession();
  const [error, setError] = useState("");
  const [pendingLocale, setPendingLocale] = useState<"en" | "es" | null>(null);
  const spanish = (pendingLocale ?? me?.user.locale) === "es";
  const account = me?.user.email ? signedInAs(me.user.email, spanish) : null;

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

  return (
    <Page>
      <H1>{spanish ? "Ajustes" : "Settings"}</H1>
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
  block: { marginTop: 20 },
  label: { color: colors.mute, fontSize: 13, fontWeight: "700" },
  value: { color: colors.ink, fontSize: 17, lineHeight: 24, marginTop: 4 },
});
