import { router } from "expo-router";
import { useState } from "react";
import { api } from "@/api";
import { saveAuthorizedFile } from "@/files";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { Button, ErrorLine, Field, H1, Muted, Page } from "@/ui";

export default function Settings() {
  const { me, token, signIn, signOut } = useSession();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  async function language(locale: "en" | "es") {
    if (!token || !me) return;
    await signIn(await api<Me>("settings", { token, body: { locale, name: me.user.name, lowBandwidth: me.user.lowBandwidth } }));
  }

  async function remove() {
    try {
      setError("");
      await api("account/delete", { token, body: { confirm } });
      await signOut();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  return (
    <Page>
      <H1>Settings</H1>
      <Muted>{me?.user.email}</Muted>
      {me?.unit ? <Muted>{me.unit.relay}</Muted> : null}
      <Button label="English" ghost onPress={() => language("en")} />
      <Button label="Español" ghost onPress={() => language("es")} />
      <Button label="Download my data" ghost onPress={() => token && saveAuthorizedFile("/api/export", "rent-right.json", token)} />
      <ErrorLine message={error} />
      <Field label="Type DELETE" value={confirm} onChange={setConfirm} />
      <Button label="Delete account" onPress={remove} />
      <Button label="Sign out" ghost onPress={async () => { await signOut(); router.replace("/"); }} />
    </Page>
  );
}
