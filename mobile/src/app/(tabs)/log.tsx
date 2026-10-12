import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { colors } from "@/theme";
import { Button, Card, H1, Muted, Page } from "@/ui";
import { useLoad } from "@/use-load";

type LogData = { items: { id: string; kind: string; date: string; line: string }[] };

export default function Log() {
  const { data, error, reload } = useLoad<LogData>("log");
  return (
    <Page onRefresh={reload}>
      <H1>Log</H1>
      {error ? <Muted>{error}</Muted> : null}
      {data?.items.map((item) => (
        <Pressable key={item.id} onPress={() => router.push(`/log/${item.id}`)}>
          <Card>
            <Text style={{ fontWeight: "700", color: colors.ink }}>{item.date} · {item.kind}</Text>
            <Text style={{ color: colors.mute, marginTop: 4 }} numberOfLines={2}>{item.line}</Text>
          </Card>
        </Pressable>
      ))}
      {!data?.items.length && !error ? <Muted>Nothing logged yet.</Muted> : null}
      <Button label="Add" onPress={() => router.push("/log-new")} />
    </Page>
  );
}
