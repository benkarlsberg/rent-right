import { Text } from "react-native";
import { api } from "@/api";
import type { Notice } from "@/session";
import { colors } from "@/theme";
import { Button, Card, H1, LegalNote, LearnMore, Muted, Page } from "@/ui";
import { useLoad } from "@/use-load";

type DatesData = {
  notice: Notice;
  items: { id: string; title: string; date: string; subtitle: string; status: string; detail: string }[];
};

export default function Dates() {
  const { data, error, reload, token } = useLoad<DatesData>("dates");
  async function toggle(id: string, status: string) {
    await api(`dates/${id}`, { token, body: { status: status === "open" ? "done" : "open" } });
    await reload();
  }
  return (
    <Page onRefresh={reload}>
      <H1>Dates</H1>
      {error ? <Muted>{error}</Muted> : null}
      {data?.items.map((item) => (
        <Card key={item.id}>
          <Text style={{ color: colors.mute }}>{item.title}</Text>
          <Text style={{ fontSize: 28, color: item.status === "done" ? colors.mute : colors.ink }}>{item.date}</Text>
          <Text style={{ color: colors.pine, fontWeight: "700" }}>{item.subtitle}</Text>
          <LegalNote notice={data.notice} />
          <LearnMore>{item.detail}</LearnMore>
          <Button label={item.status === "done" ? "Reopen" : "Done"} ghost onPress={() => toggle(item.id, item.status)} />
        </Card>
      ))}
    </Page>
  );
}
