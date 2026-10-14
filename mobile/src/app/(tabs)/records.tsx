import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text } from "react-native";
import { api } from "@/api";
import { saveAuthorizedFile } from "@/files";
import type { Me, Notice } from "@/session";
import { useSession } from "@/session";
import { colors } from "@/theme";
import { Button, ErrorLine, Field, H1, LearnMore, Muted, Page } from "@/ui";
import { useLoad } from "@/use-load";

type Records = {
  name: string;
  address: string;
  sample: boolean;
  locale: "en" | "es";
  notice: Notice;
  next: { title: string; status: string; detail: string } | null;
  notes: { id: string; line: string }[];
  lease: { filename: string; headline: string; detail: string } | null;
};

export default function Records() {
  const { data, error, reload, token, setError } = useLoad<Records>("records");
  const { me, signIn, signOut } = useSession();
  const [confirm, setConfirm] = useState("");
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  async function language(locale: "en" | "es") {
    if (!token || !me) return;
    await signIn(await api<Me>("settings", { token, body: { locale, name: me.user.name, lowBandwidth: me.user.lowBandwidth } }));
    await reload();
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
    <Page onRefresh={reload}>
      <H1>{data?.name || "Records"}</H1>
      <Muted>{data?.address}</Muted>
      {data?.sample ? <Text style={{ marginTop: 10, color: colors.pine, fontWeight: "700" }}>Sample</Text> : null}
      <ErrorLine message={error} />
      <Text style={{ marginTop: 28, fontSize: 15, color: colors.mute, fontWeight: "700" }}>Language</Text>
      <Button label="English" ghost={data?.locale === "es"} onPress={() => language("en")} />
      <Button label="Español" ghost={data?.locale !== "es"} onPress={() => language("es")} />
      {data?.next ? (
        <ViewBlock title={data.next.title} status={data.next.status} detail={data.next.detail} />
      ) : null}
      {data?.notes.map((note) => (
        <Text key={note.id} style={{ fontSize: 18, color: colors.ink, marginTop: 18 }}>{note.line}</Text>
      ))}
      {data?.lease ? <ViewBlock title={data.lease.filename} status={data.lease.headline} detail={data.lease.detail} /> : null}
      <Button label="Download records" onPress={async () => {
        if (!token) return;
        try { setError(""); await saveAuthorizedFile("/api/packet", "rent-right-records.pdf", token); }
        catch (err) { setError(err instanceof Error ? err.message : "Could not download."); }
      }} />
      <Button label="Sign out" ghost onPress={async () => { await signOut(); router.replace("/"); }} />
      <LearnMore label="Account">
        <Muted>{me?.user.email}</Muted>
        <Pressable onPress={() => token && saveAuthorizedFile("/api/export", "rent-right.json", token)} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.pine, fontSize: 17, fontWeight: "700" }}>Download my data</Text>
        </Pressable>
        <Field label="Type DELETE" value={confirm} onChange={setConfirm} />
        <Button label="Delete account" onPress={remove} />
      </LearnMore>
    </Page>
  );
}

function ViewBlock({ title, status, detail }: { title: string; status: string; detail: string }) {
  return (
    <>
      <Text style={{ fontSize: 26, color: colors.ink, marginTop: 28, fontWeight: "600" }}>{title}</Text>
      <Text style={{ fontSize: 18, color: colors.pine, marginTop: 4 }}>{status}</Text>
      {detail ? <LearnMore>{detail}</LearnMore> : null}
    </>
  );
}
