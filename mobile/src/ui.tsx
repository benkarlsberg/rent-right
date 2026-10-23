import { useState } from "react";
import { Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Notice } from "@/session";
import { colors } from "@/theme";

type WebText = TextStyle & { wordBreak?: "break-word"; overflowWrap?: "anywhere" };
type WebView = ViewStyle & { overflowX?: "hidden" };

export const wrapText: WebText = {
  flexShrink: 1,
  minWidth: 0,
  maxWidth: "100%",
  textAlign: "left",
  ...(Platform.OS === "web" ? { wordBreak: "break-word", overflowWrap: "anywhere" } : {}),
};

export const wrapBox: ViewStyle = {
  alignSelf: "stretch",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  flexShrink: 1,
};

export function wrapMarker(): ViewProps {
  return (Platform.OS === "web" ? { dataSet: { rrWrap: "1" } } : {}) as ViewProps;
}

export const clipX: WebView = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  ...(Platform.OS === "web" ? { overflowX: "hidden" } : {}),
};

function installWrapCss() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById("rr-wrap")) return;
  const style = document.createElement("style");
  style.id = "rr-wrap";
  style.textContent = "[data-rr-wrap],[data-rr-wrap] *{overflow-wrap:anywhere;word-break:break-word;min-width:0;max-width:100%}";
  document.head.appendChild(style);
}

installWrapCss();

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Page({ children, onRefresh }: { children: React.ReactNode; onRefresh?: () => void }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView style={clipX} contentContainerStyle={styles.page} refreshControl={onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.pine} /> : undefined}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Card({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <View style={[styles.card, tone === "bad" && styles.cardBad, tone === "warn" && styles.cardWarn]} {...wrapMarker()}>{children}</View>;
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return <Text style={styles.kicker}>{children}</Text>;
}

export function Button({ label, onPress, ghost, disabled }: { label: string; onPress: () => void; ghost?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, ghost && styles.ghost, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Text style={[styles.buttonText, ghost && styles.ghostText]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChange, placeholder, multiline, ...input }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean } & Pick<TextInputProps, "keyboardType" | "autoComplete" | "autoCapitalize" | "textContentType">) {
  return (
    <View style={styles.field}>
      <Text style={styles.label} nativeID={`${label}-label`}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mute}
        multiline={multiline}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.area]}
        {...input}
      />
    </View>
  );
}

export function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox} accessibilityRole="alert">
      <Text style={styles.error}>{message}</Text>
    </View>
  );
}

export function LearnMore({ label, hideLabel, children }: { label?: string; hideLabel?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={wrapBox} {...wrapMarker()}>
      <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityLabel={label || "Learn more"}>
        <Text style={styles.more}>{open ? hideLabel || "Hide" : label || "Learn more"}</Text>
      </Pressable>
      {open ? <View style={[styles.moreBody, wrapBox]}>{typeof children === "string" ? <Text style={[styles.detail, wrapText]}>{children}</Text> : children}</View> : null}
    </View>
  );
}

export function LocalNote({ note }: { note?: { text: string; url: string } | null }) {
  if (!note) return null;
  return (
    <View style={styles.legal}>
      <Text style={styles.legalShort}>{note.text}</Text>
      <Pressable onPress={() => Linking.openURL(note.url)} accessibilityRole="link">
        <Text style={styles.more}>Learn more</Text>
      </Pressable>
    </View>
  );
}

export function LegalNote({ notice }: { notice: Notice }) {
  return (
    <View style={styles.legal}>
      <Text style={styles.legalShort}>{notice.short}</Text>
      <Text style={styles.clinic}>{notice.clinicShort}</Text>
      <LearnMore label="Full disclaimer">
        <Text style={[styles.detail, wrapText]}>{notice.full}</Text>
        <Text style={[styles.detail, wrapText, styles.gap]}>{notice.clinicFull}</Text>
      </LearnMore>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, width: "100%", minWidth: 0 },
  page: { padding: 24, paddingBottom: 40, width: "100%", maxWidth: "100%", minWidth: 0 },
  h1: { fontSize: 32, color: colors.ink, fontWeight: "600", letterSpacing: -0.4 },
  muted: { color: colors.mute, fontSize: 16, lineHeight: 22, marginTop: 6 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.line, marginTop: 16, alignSelf: "stretch", width: "100%", maxWidth: "100%", minWidth: 0 },
  cardBad: { borderColor: "#f0d0d6" },
  cardWarn: { borderColor: "#ead7b0" },
  kicker: { color: colors.warn, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  button: { backgroundColor: colors.pine, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 16 },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  disabled: { opacity: 0.55 },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  ghostText: { color: colors.ink },
  field: { marginTop: 20 },
  label: { fontWeight: "600", marginBottom: 8, color: colors.ink, fontSize: 15 },
  input: { backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, fontSize: 16, color: colors.ink },
  area: { minHeight: 88, textAlignVertical: "top", paddingVertical: 12 },
  errorBox: { backgroundColor: "#f8ecec", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 16 },
  error: { color: colors.bad, fontSize: 15, lineHeight: 21 },
  more: { color: colors.pine, fontWeight: "700", marginTop: 8, textAlign: "left" },
  moreBody: { marginTop: 6, alignSelf: "stretch", width: "100%", maxWidth: "100%", minWidth: 0 },
  detail: { color: colors.ink, fontSize: 15, lineHeight: 21, textAlign: "left", flexShrink: 1, minWidth: 0, maxWidth: "100%" },
  gap: { marginTop: 8 },
  legal: { marginTop: 8 },
  legalShort: { color: colors.mute, fontSize: 13 },
  clinic: { color: colors.mute, fontSize: 12, marginTop: 2 },
});
