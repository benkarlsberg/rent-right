import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import type { Notice } from "@/session";
import { colors } from "@/theme";
import { Card, H1, LearnMore, LegalNote, Page } from "@/ui";
import { useLoad } from "@/use-load";

type Detail = {
  kind: string;
  date: string;
  text: string;
  record: string;
  flag: { title: string; detail: string; notice: Notice } | null;
};

export default function LogDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLoad<Detail>(`log/${id}`);
  return (
    <Page>
      <H1>{data?.kind || "Log"}</H1>
      <Text style={{ fontSize: 18, color: colors.mute, marginTop: 4 }}>{data?.date}</Text>
      <Text style={{ fontSize: 18, marginTop: 12, color: colors.ink }}>{data?.text}</Text>
      {data?.flag ? (
        <Card>
          <Text style={{ fontSize: 20 }}>{data.flag.title}</Text>
          <LegalNote notice={data.flag.notice} />
          <LearnMore>{data.flag.detail}</LearnMore>
        </Card>
      ) : null}
      {data?.record ? <LearnMore label="Record details">{data.record}</LearnMore> : null}
    </Page>
  );
}
