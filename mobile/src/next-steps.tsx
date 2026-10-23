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
  onAction,
}: {
  title: string;
  steps: StepItem[];
  note?: string;
  onAction: (step: StepItem) => void;
}) {
  if (!steps.length) return null;
  return (
    <View style={styles.card} {...wrapMarker()}>
      <Text style={styles.title}>{title}</Text>
      {steps.map((step, index) => (
        <View key={step.id} style={styles.step}>
          <Text style={styles.stepTitle}>{`${index + 1}. ${step.title}`}</Text>
          <Text style={styles.detail}>{step.detail}</Text>
          <Pressable
            style={styles.button}
            onPress={() => onAction(step)}
            accessibilityRole="button"
            accessibilityLabel={step.button}
          >
            <Text style={styles.buttonText}>{step.button}</Text>
          </Pressable>
        </View>
      ))}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    alignSelf: "stretch",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  title: { ...wrapText, fontSize: 22, lineHeight: 28, color: colors.ink, fontWeight: "600" },
  step: { marginTop: 14 },
  stepTitle: { ...wrapText, fontSize: 17, lineHeight: 24, color: colors.ink, fontWeight: "600" },
  detail: { ...wrapText, fontSize: 15, lineHeight: 22, color: colors.mute, marginTop: 4 },
  button: { marginTop: 10, backgroundColor: colors.pine, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
  buttonText: { ...wrapText, color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" },
  note: { ...wrapText, marginTop: 12, color: colors.pine, fontSize: 15, lineHeight: 22 },
});
