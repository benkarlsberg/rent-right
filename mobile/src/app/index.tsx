import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { api } from "@/api";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { colors } from "@/theme";
import { Button, ErrorLine, Field, LearnMore, Page } from "@/ui";

export default function Welcome() {
  const { ready, token, me, signIn } = useSession();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!ready || !token || !me) return;
    router.replace(me.needsUnit ? "/setup" : "/home");
  }, [ready, token, me]);

  async function demo() {
    try {
      setError("");
      await signIn(await api<Me>("auth/demo", { body: {} }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the sample.");
    }
  }

  async function magic() {
    try {
      setError("");
      const result = await api<{ sent?: boolean; devToken?: string }>("auth/magic", { body: { email } });
      if (result.devToken) {
        await signIn(await api<Me>("auth/verify", { body: { token: result.devToken } }));
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link.");
    }
  }

  async function paste() {
    try {
      setError("");
      await signIn(await api<Me>("me", { token: code.trim() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work.");
    }
  }

  if (!ready) return <Page><Text style={{ color: colors.mute }}>Loading</Text></Page>;

  return (
    <Page>
      <Text style={{ fontSize: 42, color: colors.pine, fontWeight: "600" }}>Rent Right</Text>
      <Text style={{ fontSize: 18, marginTop: 8, color: colors.ink }}>Free for LA and San Diego renters.</Text>
      <ErrorLine message={error} />
      {sent ? <Text style={{ marginTop: 16 }}>Check your email for the sign-in link.</Text> : null}
      <Field label="Email" value={email} onChange={setEmail} placeholder="you@email.com" />
      <Button label="Email me a link" onPress={magic} />
      <Button label="View a sample Los Angeles tenancy" onPress={demo} ghost />
      <LearnMore label="I have a code">
        <Field label="Code" value={code} onChange={setCode} />
        <Button label="Continue" onPress={paste} />
      </LearnMore>
    </Page>
  );
}
