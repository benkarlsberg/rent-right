import { router } from "expo-router";
import { createElement, useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { api } from "@/api";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { Logo } from "@/logo";
import { skippedSetup } from "@/setup-later";
import { colors } from "@/theme";
import { Button, ErrorLine, Field } from "@/ui";

const demoEnabled = process.env.EXPO_PUBLIC_DEMO === "1";
const googleEnabled = process.env.EXPO_PUBLIC_GOOGLE_AUTH === "1";
const appleEnabled = process.env.EXPO_PUBLIC_APPLE_AUTH === "1";
const LINK_MINUTES = 30;

function webQuery(name: string): string {
  if (Platform.OS !== "web" || typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) || "";
}

export default function Welcome() {
  const { ready, token, me, signIn } = useSession();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [reviewCode, setReviewCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(() => Boolean(webQuery("session")));
  const [expired, setExpired] = useState(() => webQuery("expired") === "1");

  useEffect(() => {
    if (!ready || !token || !me) return;
    let cancel = false;
    skippedSetup().then((later) => {
      if (cancel) return;
      router.replace(me.needsUnit && !later ? "/setup" : "/chat");
    });
    return () => {
      cancel = true;
    };
  }, [ready, token, me]);

  useEffect(() => {
    if (!ready || Platform.OS !== "web" || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const session = params.get("session");
    const oauthError = params.get("error");
    const linkExpired = params.get("expired") === "1";
    if (oauthError || session || linkExpired) window.history.replaceState({}, "", window.location.pathname);
    if (linkExpired) setExpired(true);
    if (oauthError) setError(oauthError);
    if (!session) return;
    let cancel = false;
    api<Me>("me", { token: session })
      .then((data) => {
        if (cancel) return;
        return signIn({ ...data, token: session });
      })
      .catch((err: unknown) => {
        if (cancel) return;
        setSigningIn(false);
        setError(err instanceof Error ? err.message : "Could not finish sign-in.");
      });
    return () => {
      cancel = true;
    };
  }, [ready, signIn]);

  async function demo() {
    try {
      setError("");
      setBusy(true);
      await signIn(await api<Me>("auth/demo", { body: {} }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the sample.");
    } finally {
      setBusy(false);
    }
  }

  async function apple() {
    try {
      setError("");
      setBusy(true);
      if (Platform.OS !== "ios") {
        const start = Platform.OS === "web" ? `${window.location.origin}/auth/apple` : "https://app.rentrightportal.com/auth/apple";
        if (Platform.OS === "web") window.location.assign(start);
        else await Linking.openURL(start);
        return;
      }
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        setError("Sign in with Apple is not available on this device.");
        return;
      }
      const bytes = await Crypto.getRandomBytesAsync(16);
      const raw = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce,
      });
      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ");
      await signIn(await api<Me>("auth/apple", { body: { identityToken: credential.identityToken, nonce: raw, name } }));
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
      if (code === "ERR_REQUEST_CANCELED") return;
      setError(err instanceof Error ? err.message : "Could not sign in with Apple.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewer() {
    try {
      setError("");
      setBusy(true);
      await signIn(await api<Me>("auth/reviewer", { body: { email, code: reviewCode } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function magic() {
    try {
      setError("");
      setBusy(true);
      const result = await api<{ sent?: boolean; devToken?: string }>("auth/magic", { body: { email } });
      if (result.devToken) {
        await signIn(await api<Me>("auth/verify", { body: { token: result.devToken } }));
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link.");
    } finally {
      setBusy(false);
    }
  }

  async function paste() {
    try {
      setError("");
      setBusy(true);
      await signIn(await api<Me>("me", { token: code.trim() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || signingIn) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.body}>
          <View accessibilityRole="header" style={styles.brand}>
            <Logo width={280} />
          </View>
          <Text style={styles.confirmTitle}>{signingIn ? "Signing you in" : "Loading"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <View accessibilityRole="header" style={styles.brand}>
          <Logo width={280} />
        </View>
        <Text style={expired ? styles.confirmTitle : styles.prop}>
          {expired ? "This link has expired, enter your email to get a new one" : "Keep your rental records and talk to your landlord, all in one place."}
        </Text>
        {sent ? (
          <View>
            <Text style={styles.confirmTitle}>Check your inbox</Text>
            <Text style={styles.confirm}>The link works for {LINK_MINUTES} minutes. It was sent to {email.trim()}.</Text>
            <Button label="Resend the link" onPress={magic} disabled={busy} />
            <Button label="Use a different email" ghost onPress={() => { setSent(false); setError(""); }} disabled={busy} />
          </View>
        ) : (
          <View>
            {appleEnabled && Platform.OS === "ios" ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={14}
                style={styles.apple}
                onPress={() => void apple()}
              />
            ) : appleEnabled ? (
              <Button label="Continue with Apple" ghost disabled={busy} onPress={() => void apple()} />
            ) : null}
            {googleEnabled ? (
              <Button
                label="Continue with Google"
                ghost
                disabled={busy}
                onPress={() => {
                  const start = Platform.OS === "web" ? `${window.location.origin}/auth/google` : "https://app.rentrightportal.com/auth/google";
                  if (Platform.OS === "web") window.location.assign(start);
                  else void Linking.openURL(start);
                }}
              />
            ) : null}
            {appleEnabled || googleEnabled ? <Text style={styles.or}>or</Text> : null}
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Button label={busy ? "Sending the link…" : "Email me a sign-in link"} onPress={magic} disabled={busy || !email.trim()} />
            <Button label="I have a sign-in code" ghost onPress={() => setShowCode((open) => !open)} disabled={busy} />
            {showCode ? (
              <View>
                <Field label="Sign-in code" value={reviewCode} onChange={setReviewCode} autoCapitalize="none" />
                <Button label="Continue with code" onPress={reviewer} disabled={busy || !email.trim() || !reviewCode.trim()} />
              </View>
            ) : null}
          </View>
        )}
        <ErrorLine message={error} />
        {__DEV__ ? (
          <View style={styles.dev}>
            <Field label="Code" value={code} onChange={setCode} autoCapitalize="none" />
            <Button label="Continue with code" ghost onPress={paste} disabled={busy || !code.trim()} />
          </View>
        ) : null}
        {demoEnabled ? <Button label="View a sample Los Angeles tenancy" ghost onPress={demo} disabled={busy} /> : null}
      </View>
      <View style={styles.legalRow}>
        {Platform.OS === "web" ? (
          <>
            {createElement("a", { href: "/privacy", style: webLink }, "Privacy")}
            {createElement("a", { href: "/terms", style: webLink }, "Terms")}
            {createElement("a", { href: "/delete-account", style: webLink }, "Delete account")}
          </>
        ) : (
          <>
            <Text style={styles.legalAnchor} accessibilityRole="link" onPress={() => Linking.openURL("https://app.rentrightportal.com/privacy")}>Privacy</Text>
            <Text style={styles.legalAnchor} accessibilityRole="link" onPress={() => Linking.openURL("https://app.rentrightportal.com/terms")}>Terms</Text>
            <Text style={styles.legalAnchor} accessibilityRole="link" onPress={() => Linking.openURL("https://app.rentrightportal.com/delete-account")}>Delete account</Text>
          </>
        )}
      </View>
      <Text style={styles.footer}>General information, not legal advice. Rent Right is not a law firm.</Text>
    </SafeAreaView>
  );
}

const webLink = { color: "#0B5C6E", fontWeight: 700, fontSize: 16, lineHeight: "24px", marginRight: 16, paddingTop: 10, paddingBottom: 10 };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 24 },
  body: { flex: 1, paddingTop: 36 },
  brand: { marginBottom: 8 },
  prop: { fontSize: 18, lineHeight: 26, color: colors.ink, marginTop: 16 },
  confirmTitle: { fontSize: 22, lineHeight: 28, color: colors.ink, fontWeight: "600", marginTop: 28 },
  confirm: { fontSize: 16, lineHeight: 24, color: colors.mute, marginTop: 8 },
  or: { color: colors.mute, fontSize: 14, textAlign: "center", marginTop: 16 },
  apple: { width: "100%", height: 48, marginTop: 16 },
  dev: { marginTop: 8 },
  legalRow: { flexDirection: "row", gap: 16, paddingBottom: 8 },
  legalAnchor: { color: colors.pine, fontSize: 16, fontWeight: "700", lineHeight: 24, minHeight: 44 },
  footer: { color: colors.mute, fontSize: 14, lineHeight: 20, paddingBottom: 20 },
});
