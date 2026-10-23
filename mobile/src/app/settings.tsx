import { router } from "expo-router";
import { useState } from "react";
import { api } from "@/api";
import { DeleteAccount } from "@/delete-account";
import { saveAuthorizedFile } from "@/files";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { LanguageToggle } from "@/language-toggle";
import { Button, ErrorLine, H1, Muted, Page } from "@/ui";

export default function Settings() {
  const { me, token, signIn, signOut } = useSession();
  const [error, setError] = useState("");
  const [pendingLocale, setPendingLocale] = useState<"en" | "es" | null>(null);
  const spanish = (pendingLocale ?? me?.user.locale) === "es";

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
      <Muted>{me?.user.email}</Muted>
      {me?.unit ? <Muted>{me.unit.relay}</Muted> : null}
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
