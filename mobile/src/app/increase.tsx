import { useState } from "react";
import { Text } from "react-native";
import { api } from "@/api";
import type { Notice } from "@/session";
import { colors } from "@/theme";
import { Button, Card, ErrorLine, Field, H1, LegalNote, LearnMore, Page } from "@/ui";
import { useLoad } from "@/use-load";

type IncreaseData = {
  lowest: string;
  notice: Notice;
  result: { title: string; subtitle: string; max: string | null; ruleId: string | null; detail: string } | null;
};

export default function Increase() {
  const { data, error, reload, token, setError } = useLoad<IncreaseData>("increase");
  const [lowest, setLowest] = useState("");
  const [proposed, setProposed] = useState("");
  const [effective, setEffective] = useState("");

  async function check() {
    try {
      setError("");
      await api("increase", { token, body: { lowest: lowest || data?.lowest, proposed, effectiveDate: effective } });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check.");
    }
  }

  return (
    <Page onRefresh={reload}>
      <H1>Rent increase</H1>
      <ErrorLine message={error} />
      <Field label="Current" value={lowest} onChange={setLowest} placeholder={data?.lowest || "2150"} />
      <Field label="Proposed" value={proposed} onChange={setProposed} />
      <Field label="Starts" value={effective} onChange={setEffective} placeholder="YYYY-MM-DD" />
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
