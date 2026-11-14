import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

export type LawChoice = "yes" | "no" | "unsure";

export function specialKind(jurisdiction?: string | null): "tn" | "ky" | "nyc" | null {
  if (jurisdiction === "tn") return "tn";
  if (jurisdiction === "ky") return "ky";
  if (jurisdiction === "city_nyc") return "nyc";
  return null;
}

export function specialCopy(kind: "tn" | "ky" | "nyc", es: boolean): { title: string; body: string } {
  if (kind === "nyc") {
    return es
      ? { title: "¿Su apartamento está estabilizado?", body: "Sí, no, o no estoy seguro. No estar seguro no trata el apartamento como estabilizado." }
      : { title: "Is your apartment rent-stabilized?", body: "Yes, no, or not sure. Not sure does not treat the apartment as stabilized." };
  }
  if (kind === "tn") {
    return es
      ? { title: "¿Aplica la ley uniforme en su condado?", body: "La ley de Tennessee aplica en un condado de más de 75,000 habitantes según el censo de 2010. No estar seguro no aplica esas reglas." }
      : { title: "Does the uniform act apply in your county?", body: "Tennessee's landlord-tenant act applies in a county with more than 75,000 people in the 2010 census. Not sure does not apply those rules." };
  }
  return es
    ? { title: "¿Su localidad adoptó la ley uniforme?", body: "En Kentucky aplica solo si la ciudad o el condado la adoptó. No estar seguro muestra que puede aplicar, sin usarla." }
    : { title: "Did your locality adopt the uniform act?", body: "In Kentucky it applies only if the city or county adopted it. Not sure says it may apply, and does not use it." };
}

export function ChoiceButtons({ value, onChange, es }: { value: LawChoice; onChange: (next: LawChoice) => void; es: boolean }) {
  const options: { id: LawChoice; label: string }[] = es
    ? [{ id: "yes", label: "Sí" }, { id: "no", label: "No" }, { id: "unsure", label: "No estoy seguro" }]
    : [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }, { id: "unsure", label: "Not sure" }];
  return (
    <View style={styles.row}>
      {options.map((item) => {
        const on = value === item.id;
        return (
          <Pressable key={item.id} accessibilityRole="button" onPress={() => onChange(item.id)} style={[styles.choice, on ? styles.on : null]}>
            <Text style={[styles.label, on ? styles.labelOn : null]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, marginTop: 16 },
  choice: { minHeight: 48, justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14 },
  on: { backgroundColor: colors.pine },
  label: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  labelOn: { color: "#fff" },
});
