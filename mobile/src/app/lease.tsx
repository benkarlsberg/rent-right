import { useState } from "react";
import { Text } from "react-native";
import { api } from "@/api";
import type { Notice } from "@/session";
import { colors } from "@/theme";
import { Button, Card, ErrorLine, Field, H1, Kicker, LegalNote, LearnMore, LocalNote, Muted, Page } from "@/ui";
import { refreshBootstrap } from "@/tab-cache";
import { useLoad } from "@/use-load";

type LeaseData = {
  notice: Notice;
  local?: { text: string; url: string } | null;
  reviews: { id: string; filename: string | null; when: string; findings: { id: string; status: string; ruleId: string | null; title: string; quote: string; detail: string; citation: string | null }[] }[];
};

export default function Lease() {
  const { data, error, reload, token, setError } = useLoad<LeaseData>("lease");
  const [text, setText] = useState("");

  async function run(path: string, body?: unknown) {
    try {
      setError("");
      await api(path, { token, body: body || {} });
      setText("");
      if (token) void refreshBootstrap(token, true);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review.");
    }
  }

  const review = data?.reviews[0];
  return (
    <Page onRefresh={reload}>
      <H1>Lease</H1>
      <LocalNote note={data?.local} />
      <ErrorLine message={error} />
      <Button label="Check the sample lease" ghost onPress={() => run("lease/sample")} />
      <Field label="Or paste text" value={text} onChange={setText} multiline />
      <Button label="Check" onPress={() => run("lease", { text })} />
      {review ? <Muted>{review.when}</Muted> : null}
      {review?.findings.map((finding) => (
        <Card key={finding.id}>
          <Kicker>{finding.ruleId || "No rule"}</Kicker>
          <Text style={{ fontSize: 22, marginTop: 4, color: colors.ink }}>{finding.status}</Text>
          {data?.notice ? <LegalNote notice={data.notice} /> : null}
          <LearnMore>
            <Text style={{ fontWeight: "700" }}>{finding.title}</Text>
            <Text style={{ marginTop: 8 }}>{finding.quote}</Text>
            <Text style={{ marginTop: 8 }}>{finding.detail}</Text>
            {finding.citation ? <Text style={{ marginTop: 8, color: colors.mute }}>{finding.citation}</Text> : null}
          </LearnMore>
        </Card>
      ))}
    </Page>
  );
}
