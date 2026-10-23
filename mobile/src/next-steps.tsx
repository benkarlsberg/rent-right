import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";
import { wrapMarker, wrapText } from "@/ui";

export type StepItem = {
  id: string;
  title: string;
  detail: string;
  button: string;
  action: "wait" | "followup" | "send" | "export" | "small_claims";
  href: string | null;
};

export function NextSteps({
  title,
  steps,
  note,
  moreLabel,
  hideLabel,
  onAction,
}: {
  title: string;
  steps: StepItem[];
  note?: string;
  moreLabel?: string;
  hideLabel?: string;
  onAction: (step: StepItem) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  const first = steps[0];
  const rest = steps.slice(1);
  return (
    <View style={styles.card} {...wrapMarker()}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.stepTitle}>{first.title}</Text>
      <Text style={styles.detail}>{first.detail}</Text>
      <Pressable
        style={styles.primary}
        onPress={() => onAction(first)}
        accessibilityRole="button"
        accessibilityLabel={first.button}
      >
        <Text style={styles.primaryText}>{first.button}</Text>
      </Pressable>
      {rest.length ? (
        <Pressable
          style={styles.more}
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? hideLabel || "Hide" : moreLabel || "See all steps"}
        >
          <Text style={styles.moreText}>{open ? hideLabel || "Hide" : moreLabel || "See all steps"}</Text>
        </Pressable>
      ) : null}
      {open ? rest.map((step) => (
        <View key={step.id} style={styles.extra}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.detail}>{step.detail}</Text>
          <Pressable
            style={styles.secondary}
            onPress={() => onAction(step)}
            accessibilityRole="button"
            accessibilityLabel={step.button}
          >
            <Text style={styles.secondaryText}>{step.button}</Text>
          </Pressable>
        </View>
      )) : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: "#E7F3F1",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.pine,
    padding: 14,
    alignSelf: "stretch",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  title: { ...wrapText, fontSize: 13, lineHeight: 18, color: colors.pine, fontWeight: "700" },
  stepTitle: { ...wrapText, fontSize: 16, lineHeight: 22, color: colors.ink, fontWeight: "600", marginTop: 6 },
  detail: { ...wrapText, fontSize: 14, lineHeight: 20, color: colors.mute, marginTop: 4 },
  primary: { marginTop: 12, backgroundColor: colors.pine, borderRadius: 12, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10 },
  primaryText: { ...wrapText, color: "white", fontSize: 15, fontWeight: "700", textAlign: "center" },
  more: { minHeight: 44, justifyContent: "center", marginTop: 4 },
  moreText: { color: colors.pine, fontSize: 15, fontWeight: "700" },
  extra: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#C5DDD8" },
  secondary: { marginTop: 8, backgroundColor: "white", borderRadius: 12, borderWidth: 1, borderColor: colors.line, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { ...wrapText, color: colors.pine, fontSize: 15, fontWeight: "700", textAlign: "center" },
  note: { ...wrapText, marginTop: 8, color: colors.pine, fontSize: 14, lineHeight: 20 },
});
