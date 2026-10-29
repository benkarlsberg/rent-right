import { router } from "expo-router";
import { createElement, useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import Svg, { Path } from "react-native-svg";
import { api } from "@/api";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { Logo } from "@/logo";
import { skippedSetup } from "@/setup-later";
import { colors } from "@/theme";
import { Button, ErrorLine, Field } from "@/ui";
import { signInWithGoogleNative } from "@/google-auth";
import { callbackNeedsCleanUrl, finishSessionHandoff, forgetSessionHandoff, readWebCallback, takeWebSession } from "@/web-handoff";
import { authFlagEnabled, isDevBuild } from "@/release-config";

const demoEnabled = process.env.EXPO_PUBLIC_DEMO === "1";
const devBuild = isDevBuild();
const googleEnabled = authFlagEnabled(process.env.EXPO_PUBLIC_GOOGLE_AUTH, devBuild);
const appleEnabled = authFlagEnabled(process.env.EXPO_PUBLIC_APPLE_AUTH, devBuild);
const LINK_MINUTES = 30;
const PAGE = "#E6F0EE";

const copy = {
  en: {
    heading: "Log in or sign up",
    expired: "This link has expired, enter your email to get a new one",
    tagline: "Keep your rental records and talk to your landlord, all in one place.",
    email: "Email address",
    placeholder: "you@email.com",
    send: "Email me a sign-in link",
    sending: "Sending the link…",
    haveCode: "I have a sign-in code",
    hideCode: "Hide sign-in code",
    code: "Sign-in code",
    continueCode: "Continue with code",
    or: "OR",
    google: "Continue with Google",
    apple: "Continue with Apple",
    sentTitle: "Check your inbox",
    sentBody: (address: string) => `The link works for ${LINK_MINUTES} minutes. It was sent to ${address}.`,
    resend: "Resend the link",
    different: "Use a different email",
    legalBefore: "By continuing, you agree to our ",
    terms: "Terms of use",
    legalMid: " and ",
    privacy: "Privacy policy",
    legalAfter: ".",
    disclaimer: "General information, not legal advice. Rent Right is not a law firm.",
    signingIn: "Signing you in",
    tryAgain: "Try again",
    slow: "Sign-in is taking too long. Try again.",
    failed: "Could not finish sign-in.",
    loading: "Loading",
    sample: "View a sample Los Angeles tenancy",
    devCode: "Code",
  },
  es: {
    heading: "Inicie sesión o regístrese",
    expired: "Este enlace venció. Escriba su correo para recibir uno nuevo.",
    tagline: "Guarde sus registros de renta y hable con su propietario, todo en un solo lugar.",
    email: "Correo electrónico",
    placeholder: "usted@correo.com",
    send: "Enviarme un enlace para entrar",
    sending: "Enviando el enlace…",
    haveCode: "Tengo un código de acceso",
    hideCode: "Ocultar el código",
    code: "Código de acceso",
    continueCode: "Continuar con el código",
    or: "O",
    google: "Continuar con Google",
    apple: "Continuar con Apple",
    sentTitle: "Revise su bandeja",
    sentBody: (address: string) => `El enlace funciona por ${LINK_MINUTES} minutos. Se envió a ${address}.`,
    resend: "Reenviar el enlace",
    different: "Usar otro correo",
    legalBefore: "Al continuar, acepta nuestros ",
    terms: "Términos de uso",
    legalMid: " y la ",
    privacy: "Política de privacidad",
    legalAfter: ".",
    disclaimer: "Información general, no es asesoramiento legal. Rent Right no es un bufete.",
    signingIn: "Entrando",
    tryAgain: "Intentar de nuevo",
    slow: "La entrada está tardando demasiado. Inténtelo de nuevo.",
    failed: "No se pudo completar la entrada.",
    loading: "Cargando",
    sample: "Ver un ejemplo de vivienda en Los Ángeles",
    devCode: "Código",
  },
} as const;

type Locale = keyof typeof copy;

function webQuery(name: string): string {
  if (Platform.OS !== "web" || typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) || "";
}

function initialLocale(): Locale {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const saved = window.localStorage.getItem("rr_locale");
    if (saved === "es" || saved === "en") return saved;
    if ((navigator.language || "").toLowerCase().startsWith("es")) return "es";
    return "en";
  }
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
    return locale.toLowerCase().startsWith("es") ? "es" : "en";
  } catch {
    return "en";
  }
}

function installSignInCss(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById("rr-signin-focus")) return;
  const style = document.createElement("style");
  style.id = "rr-signin-focus";
  style.textContent = "[data-rr-signin] a:focus-visible,[data-rr-signin] [role=button]:focus-visible,[data-rr-signin] input:focus-visible{outline:3px solid #0B5C6E;outline-offset:2px}";
  document.head.appendChild(style);
}

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <Path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <Path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <Path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </Svg>
  );
}

function AppleMark() {
  return (
    <Svg width={16} height={18} viewBox="0 0 17 20">
      <Path fill="#FFFFFF" d="M16.365 6.677c-.102.082-1.932 1.11-1.932 3.403 0 2.652 2.33 3.588 2.398 3.61-.01.055-.369 1.264-1.216 2.504-.756 1.104-1.54 2.203-2.776 2.203-1.216 0-1.61-.724-3.092-.724-1.504 0-1.968.746-3.114.746-1.124 0-1.908-1.022-2.686-2.126C2.79 14.64 1.96 12.17 1.96 9.82c0-3.18 2.066-4.866 4.098-4.866 1.082 0 1.984.724 2.664.724.658 0 1.684-.766 2.94-.766.474 0 2.178.044 3.303 1.765zM12.03 3.53c.548-.664.94-1.588.836-2.53-.81.034-1.79.54-2.37 1.204-.52.6-.974 1.556-.852 2.47.904.07 1.828-.458 2.386-1.144z" />
    </Svg>
  );
}

function LegalLink({ href, label }: { href: string; label: string }) {
  if (Platform.OS === "web") {
    return createElement("a", { href, style: webLink }, label);
  }
  return (
    <Text style={styles.link} accessibilityRole="link" onPress={() => Linking.openURL(`https://app.rentrightportal.com${href}`)}>
      {label}
    </Text>
  );
}

export default function Welcome() {
  const { ready, token, me, signIn } = useSession();
  const signInRef = useRef(signIn);
  signInRef.current = signIn;
  const [sessionToken] = useState(() => (Platform.OS === "web" && typeof window !== "undefined" ? takeWebSession(window.location.search) : ""));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [reviewCode, setReviewCode] = useState("");
  const [showCode, setShowCode] = useState(() => webQuery("code") === "1");
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const text = copy[locale];
  const textRef = useRef(text);
  textRef.current = text;
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(() => Boolean(sessionToken));
  const [handoffFailed, setHandoffFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const callback = readWebCallback(window.location.search);
    if (callbackNeedsCleanUrl(callback)) window.history.replaceState({}, "", window.location.pathname);
    if (callback.expired) setExpired(true);
    if (callback.error) setError(callback.error);
  }, []);

  useEffect(() => {
    if (!ready || !sessionToken) return;
    let alive = true;
    const messages = textRef.current;
    finishSessionHandoff({
      token: sessionToken,
      timeoutMessage: messages.slow,
      fallbackMessage: messages.failed,
      log: (reason) => console.error("Sign-in handoff failed:", reason),
      loadMe: (saved, signal) => api<Me>("me", { token: saved, signal }),
      persist: async (data) => {
        await signInRef.current({ ...data, token: sessionToken });
      },
    })
      .then((result) => {
        if (!alive) return;
        if (!result.ok) {
          setHandoffFailed(true);
          setError(result.error);
        }
      })
      .finally(() => {
        if (alive) setSigningIn(false);
      });
    return () => {
      alive = false;
    };
  }, [ready, sessionToken, attempt]);

  function retryHandoff() {
    if (!sessionToken) return;
    forgetSessionHandoff(sessionToken);
    setError("");
    setHandoffFailed(false);
    setSigningIn(true);
    setAttempt((value) => value + 1);
  }

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

  function chooseLocale(next: Locale) {
    setLocaleState(next);
    if (Platform.OS === "web" && typeof window !== "undefined") window.localStorage.setItem("rr_locale", next);
  }

  async function google() {
    if (Platform.OS === "web") {
      window.location.assign(`${window.location.origin}/auth/google`);
      return;
    }
    try {
      setError("");
      setBusy(true);
      const session = await signInWithGoogleNative();
      if (session) await signIn(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in with Google.");
    } finally {
      setBusy(false);
    }
  }

  installSignInCss();
  const providers = googleEnabled || appleEnabled;

  if (!ready || signingIn || (token && me)) {
    return (
      <SafeAreaView style={styles.screen} {...signInMarker()}>
        <View style={styles.center}>
          <Logo width={220} />
          <Text style={styles.heading}>{signingIn || sessionToken ? text.signingIn : text.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} {...signInMarker()}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View accessibilityRole="header" style={styles.brand}>
            <Logo width={220} />
          </View>
          <Text style={styles.heading}>{sent ? text.sentTitle : text.heading}</Text>
          <Text style={styles.tagline}>{sent ? text.sentBody(email.trim()) : text.tagline}</Text>
          {expired && !sent ? <Text style={styles.alert} accessibilityRole="alert">{text.expired}</Text> : null}
          {sent ? (
            <View>
              <Button label={text.resend} onPress={magic} disabled={busy} />
              <Pressable style={styles.textHit} onPress={() => { setSent(false); setError(""); }} disabled={busy} accessibilityRole="button" accessibilityLabel={text.different}>
                <Text style={styles.textLink}>{text.different}</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.fieldLabel} nativeID="signin-email-label">{text.email}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={text.placeholder}
                placeholderTextColor={colors.mute}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                textContentType="emailAddress"
                accessibilityLabel={text.email}
                style={styles.input}
              />
              <Button label={busy ? text.sending : text.send} onPress={magic} disabled={busy || !email.trim()} />
              <Pressable
                style={styles.textHit}
                onPress={() => setShowCode((open) => !open)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={showCode ? text.hideCode : text.haveCode}
              >
                <Text style={styles.textLink}>{showCode ? text.hideCode : text.haveCode}</Text>
              </Pressable>
              {showCode ? (
                <View>
                  <Field label={text.code} value={reviewCode} onChange={setReviewCode} autoCapitalize="none" autoComplete="off" />
                  <Button label={text.continueCode} onPress={reviewer} disabled={busy || !email.trim() || !reviewCode.trim()} />
                </View>
              ) : null}
              {providers ? (
                <View style={styles.divider}>
                  <View style={styles.line} />
                  <Text style={styles.or}>{text.or}</Text>
                  <View style={styles.line} />
                </View>
              ) : null}
              {googleEnabled ? (
                <Pressable style={styles.google} onPress={() => void google()} disabled={busy} accessibilityRole="button" accessibilityLabel={text.google}>
                  <GoogleMark />
                  <Text style={styles.googleText}>{text.google}</Text>
                </Pressable>
              ) : null}
              {appleEnabled && Platform.OS === "ios" ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={styles.apple}
                  onPress={() => void apple()}
                />
              ) : appleEnabled ? (
                <Pressable style={styles.appleButton} onPress={() => void apple()} disabled={busy} accessibilityRole="button" accessibilityLabel={text.apple}>
                  <AppleMark />
                  <Text style={styles.appleText}>{text.apple}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          <ErrorLine message={error} />
          {handoffFailed ? <Button label={text.tryAgain} onPress={retryHandoff} disabled={busy} /> : null}
          {__DEV__ ? (
            <View style={styles.dev}>
              <Field label={text.devCode} value={code} onChange={setCode} autoCapitalize="none" />
              <Button label={text.continueCode} ghost onPress={paste} disabled={busy || !code.trim()} />
            </View>
          ) : null}
          {demoEnabled ? <Button label={text.sample} ghost onPress={demo} disabled={busy} /> : null}
        </View>
        <View style={styles.langRow}>
          <Pressable style={styles.langHit} onPress={() => chooseLocale("en")} accessibilityRole="button" accessibilityLabel="English" accessibilityState={{ selected: locale === "en" }}>
            <Text style={[styles.lang, locale === "en" && styles.langOn]}>English</Text>
          </Pressable>
          <Text style={styles.langDot}>·</Text>
          <Pressable style={styles.langHit} onPress={() => chooseLocale("es")} accessibilityRole="button" accessibilityLabel="Español" accessibilityState={{ selected: locale === "es" }}>
            <Text style={[styles.lang, locale === "es" && styles.langOn]}>Español</Text>
          </Pressable>
        </View>
        <Text style={styles.legal}>
          {text.legalBefore}
          <LegalLink href="/terms" label={text.terms} />
          {text.legalMid}
          <LegalLink href="/privacy" label={text.privacy} />
          {text.legalAfter}
        </Text>
        <Text style={styles.disclaimer}>{text.disclaimer}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const webLink = {
  color: "#0B5C6E",
  fontSize: 12,
  lineHeight: "18px",
  textDecoration: "underline",
  fontWeight: 600,
};

function signInMarker() {
  return (Platform.OS === "web" ? { dataSet: { rrSignin: "1" } } : {}) as object;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 28, width: "100%" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    shadowColor: "#14343C",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  brand: { alignItems: "center" },
  heading: { marginTop: 22, textAlign: "center", color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: "700" },
  tagline: { marginTop: 8, textAlign: "center", color: colors.mute, fontSize: 15, lineHeight: 22 },
  alert: { marginTop: 14, textAlign: "center", color: colors.ink, fontSize: 15, lineHeight: 22 },
  fieldLabel: { marginTop: 22, marginBottom: 8, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#6B8086",
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 16,
    color: colors.ink,
  },
  textHit: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 4 },
  textLink: { color: colors.pine, fontSize: 15, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  divider: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 4 },
  line: { flex: 1, height: 1, backgroundColor: "#C5D4D6" },
  or: { marginHorizontal: 12, color: colors.mute, fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 0.6 },
  google: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#747775",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  googleText: { color: "#1F1F1F", fontSize: 16, lineHeight: 20, fontWeight: "600" },
  apple: { width: "100%", height: 48, marginTop: 12 },
  appleButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#000000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  appleText: { color: "#FFFFFF", fontSize: 16, lineHeight: 20, fontWeight: "600" },
  dev: { marginTop: 8 },
  langRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8 },
  langHit: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  lang: { color: colors.mute, fontSize: 12, lineHeight: 18 },
  langOn: { color: colors.ink, fontWeight: "700", textDecorationLine: "underline" },
  langDot: { color: colors.mute, fontSize: 12 },
  legal: { marginTop: 4, textAlign: "center", color: colors.mute, fontSize: 12, lineHeight: 18 },
  link: { color: colors.pine, fontSize: 12, lineHeight: 18, fontWeight: "600", textDecorationLine: "underline" },
  disclaimer: { marginTop: 6, textAlign: "center", color: colors.mute, fontSize: 12, lineHeight: 18 },
});
