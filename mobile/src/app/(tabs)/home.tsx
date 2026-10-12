import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import type { Notice } from "@/session";
import { useSession } from "@/session";
import { colors } from "@/theme";
import { Card, H1, Kicker, LegalNote, LearnMore, LocalNote, Muted, Page } from "@/ui";
import { useLoad } from "@/use-load";

type HomeData = {
  hello: string;
  address: string;
  sample: boolean;
  notice: Notice;
  local?: { text: string; url: string } | null;
  cards: { id: string; href: string; kicker: string; title: string; subtitle: string; detail: string; tone: string }[];
};

export default function Home() {
  const { me } = useSession();
  const { data, error, reload } = useLoad<HomeData>("home");
  return (
    <Page onRefresh={reload}>
      <H1>Hello{data?.hello ? `, ${data.hello}` : ""}</H1>
      <Muted>{data?.address || me?.unit?.address || ""}</Muted>
      {data?.sample ? <Text style={{ marginTop: 8, color: colors.pine, fontWeight: "700" }}>Sample</Text> : null}
      <LocalNote note={data?.local} />
      {error ? <Muted>{error}</Muted> : null}
      {data?.cards.map((card) => (
        <Card key={card.id} tone={card.tone}>
          <Pressable onPress={() => router.push(card.href as "/home")}>
            <Kicker>{card.kicker}</Kicker>
            <Text style={{ fontSize: 28, marginTop: 4, color: colors.ink }}>{card.title}</Text>
            <Text style={{ fontSize: 16, color: colors.mute, marginTop: 2 }}>{card.subtitle}</Text>
          </Pressable>
          {data.notice ? <LegalNote notice={data.notice} /> : null}
          <LearnMore>{card.detail}</LearnMore>
        </Card>
      ))}
      {!data?.cards.length && !error ? <Muted>Nothing tracked yet.</Muted> : null}
    </Page>
  );
}
