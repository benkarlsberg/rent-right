import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

export function LanguageToggle({
  locale,
  onChange,
}: {
  locale: "en" | "es";
  onChange: (locale: "en" | "es") => void;
}) {
  const spanish = locale === "es";
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="English"
        accessibilityState={{ selected: !spanish }}
        aria-selected={!spanish}
        style={[styles.item, !spanish ? styles.on : styles.off]}
        onPress={() => onChange("en")}
      >
        <Text style={!spanish ? styles.textOn : styles.textOff}>English</Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Español"
        accessibilityState={{ selected: spanish }}
        aria-selected={spanish}
        style={[styles.item, spanish ? styles.on : styles.off]}
        onPress={() => onChange("es")}
      >
        <Text style={spanish ? styles.textOn : styles.textOff}>Español</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    marginTop: 20,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 4,
  },
  item: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  on: { backgroundColor: colors.pine },
  off: { backgroundColor: "transparent" },
  textOn: { fontSize: 16, fontWeight: "700", color: "white" },
  textOff: { fontSize: 16, fontWeight: "700", color: colors.ink },
});
