import { useState } from "react";
import { Text } from "react-native";
import { api } from "@/api";
import type { Notice } from "@/session";
import { colors } from "@/theme";
import { Button, Card, ErrorLine, Field, H1, LegalNote, LearnMore, Page } from "@/ui";
import { useLoad } from "@/use-load";

type Item =
  | { role: "user"; text: string }
  | { role: "assistant"; headline: string; detail: string; ruleIds: string[]; notice: Notice };

export default function Assistant() {
  const { data, error, reload, token, setError } = useLoad<{ items: Item[] }>("assistant");
  const [question, setQuestion] = useState("");

  async function ask() {
    try {
      setError("");
      await api("assistant", { token, body: { question } });
      setQuestion("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ask.");
    }
  }

  return (
    <Page onRefresh={reload}>
      <H1>Rights</H1>
      <ErrorLine message={error} />
      <Field label="Question" value={question} onChange={setQuestion} />
      <Button label="Ask" onPress={ask} />
      {data?.items.map((item, index) =>
        item.role === "user" ? (
          <Text key={index} style={{ marginTop: 16, color: colors.mute }}>{item.text}</Text>
        ) : (
          <Card key={index}>
            <Text style={{ fontSize: 22, color: colors.ink }}>{item.headline}</Text>
            {item.ruleIds[0] ? <Text style={{ color: colors.pine, marginTop: 4 }}>{item.ruleIds[0]}</Text> : null}
            <LegalNote notice={item.notice} />
            <LearnMore>{item.detail}</LearnMore>
          </Card>
        ),
      )}
    </Page>
  );
}
