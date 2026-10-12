import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api";
import type { Notice } from "@/session";
import { colors } from "@/theme";
import { Button, Card, ErrorLine, Field, H1, LegalNote, LearnMore, LocalNote, Page } from "@/ui";
import { useLoad } from "@/use-load";

type IncreaseData = {
  lowest: string;
  notice: Notice;
  local?: { text: string; url: string } | null;
  result: { title: string; subtitle: string; max: string | null; ruleId: string | null; detail: string } | null;
};

export default function Increase() {
  const { data, error, reload, token, setError } = useLoad<IncreaseData>("increase");
  const [lowest, setLowest] = useState("");
  const [proposed, setProposed] = useState("");
  const [effective, setEffective] = useState("");
  const [year, setYear] = useState("");
  const [units, setUnits] = useState("");
  const [kind, setKind] = useState("");
  const [subsidy, setSubsidy] = useState("");

  async function check() {
    try {
      setError("");
      await api("increase", {
        token,
        body: {
          lowest: lowest || data?.lowest,
          proposed,
          effectiveDate: effective,
          builtYear: year,
          unitCount: units,
          housingType: kind,
          subsidized: subsidy,
        },
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check.");
    }
  }

  return (
    <Page onRefresh={reload}>
      <H1>Rent increase</H1>
      <LocalNote note={data?.local} />
      <ErrorLine message={error} />
      <Field label="Current" value={lowest} onChange={setLowest} placeholder={data?.lowest || "2150"} keyboardType="decimal-pad" />
      <Field label="Proposed" value={proposed} onChange={setProposed} keyboardType="decimal-pad" />
      <Field label="Starts" value={effective} onChange={setEffective} placeholder="YYYY-MM-DD" />
      <LearnMore label="Unit facts, optional" hideLabel="Hide unit facts">
        <Text style={styles.hint}>These facts decide whether a confirmed local cap applies. Blank fields use the statewide chart.</Text>
        <Field label="Year built" value={year} onChange={setYear} placeholder="1990" keyboardType="number-pad" />
        <Field label="Number of units" value={units} onChange={setUnits} placeholder="4" keyboardType="number-pad" />
        <Choice
          label="Housing"
          value={kind}
          onChange={setKind}
          options={[
            ["multi", "Apartment"],
            ["sfh", "House"],
            ["condo", "Condo"],
            ["townhome", "Townhome"],
          ]}
        />
        <Choice
          label="Government subsidy"
          value={subsidy}
          onChange={setSubsidy}
          options={[
            ["no", "No"],
            ["yes", "Yes"],
          ]}
        />
      </LearnMore>
      <Button label="Check" onPress={check} />
      {data?.result ? (
        <Card>
          <Text style={{ fontSize: 28, color: colors.ink }}>{data.result.title}</Text>
          <Text style={{ fontSize: 18, color: colors.pine, marginTop: 4 }}>{data.result.subtitle}{data.result.max ? ` · max ${data.result.max}` : ""}</Text>
          <LegalNote notice={data.notice} />
          <LearnMore>{`${data.result.detail}${data.result.ruleId ? `\n\n${data.result.ruleId}` : ""}`}</LearnMore>
        </Card>
      ) : null}
    </Page>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <View style={styles.choice}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.row}>
        {options.map(([id, text]) => {
          const on = value === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${text}`}
              accessibilityState={{ selected: on }}
              onPress={() => onChange(on ? "" : id)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.mute, fontSize: 15, lineHeight: 21, marginTop: 8 },
  choice: { marginTop: 16 },
  choiceLabel: { fontWeight: "600", marginBottom: 8, color: colors.ink, fontSize: 15 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#E7F3F1",
    borderRadius: 999,
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.pine },
  chipText: { color: colors.pine, fontWeight: "700", fontSize: 15 },
  chipTextOn: { color: "white" },
});
