import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { createElement } from "react";
import { colors } from "@/theme";

export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        {createElement("input", {
          type: "date",
          value,
          "aria-label": label,
          onChange: (event: { target: { value: string } }) => onChange(event.target.value || ""),
          style: {
            width: "100%",
            boxSizing: "border-box",
            minHeight: 48,
            fontSize: 16,
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${colors.line}`,
            color: colors.ink,
            backgroundColor: colors.paper,
            fontFamily: "inherit",
          },
        })}
      </View>
    );
  }
  return (
    <View style={styles.field}>
      <Text style={styles.label} nativeID={`${label}-label`}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.mute}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 12 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "600", marginBottom: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
});
