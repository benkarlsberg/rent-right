import { useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Notice } from "@/session";
import { colors } from "@/theme";

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Page({ children, onRefresh }: { children: React.ReactNode; onRefresh?: () => void }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.pine} /> : undefined}>
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
  return <View style={[styles.card, tone === "bad" && styles.cardBad, tone === "warn" && styles.cardWarn]}>{children}</View>;
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return <Text style={styles.kicker}>{children}</Text>;
}

export function Button({ label, onPress, ghost }: { label: string; onPress: () => void; ghost?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, ghost && styles.ghost]} accessibilityRole="button">
      <Text style={[styles.buttonText, ghost && styles.ghostText]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} multiline={multiline} style={[styles.input, multiline && styles.area]} />
    </View>
  );
}

export function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

export function LearnMore({ label, children }: { label?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button">
        <Text style={styles.more}>{open ? "Hide" : label || "Learn more"}</Text>
      </Pressable>
      {open ? <View style={styles.moreBody}>{typeof children === "string" ? <Text style={styles.detail}>{children}</Text> : children}</View> : null}
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
        <Text style={styles.detail}>{notice.full}</Text>
        <Text style={[styles.detail, styles.gap]}>{notice.clinicFull}</Text>
      </LearnMore>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  page: { padding: 20, paddingBottom: 36 },
  h1: { fontSize: 34, color: colors.ink, fontWeight: "600" },
  muted: { color: colors.mute, fontSize: 15, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.line, marginTop: 12 },
  cardBad: { borderColor: "#efd2c4" },
  cardWarn: { borderColor: "#ead7b0" },
  kicker: { color: colors.warn, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  button: { backgroundColor: colors.pine, borderRadius: 999, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 12 },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  ghostText: { color: colors.ink },
  field: { marginTop: 12 },
  label: { fontWeight: "700", marginBottom: 6, color: colors.ink },
  input: { backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.ink },
  area: { minHeight: 88, textAlignVertical: "top" },
  error: { color: colors.bad, marginTop: 8 },
  more: { color: colors.pine, fontWeight: "700", marginTop: 8 },
  moreBody: { marginTop: 6 },
  detail: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  gap: { marginTop: 8 },
  legal: { marginTop: 8 },
  legalShort: { color: colors.mute, fontSize: 13 },
  clinic: { color: colors.mute, fontSize: 12, marginTop: 2 },
});
