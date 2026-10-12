import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Text } from "react-native";
import { api } from "@/api";
import { colors } from "@/theme";
import { Button, Card, ErrorLine, H1, LearnMore, Muted, Page } from "@/ui";
import { useLoad } from "@/use-load";

const ROOMS = ["Living room", "Kitchen", "Bedroom", "Bathroom", "Other"];

type Report = { id: string; kind: string; when: string; line: string; detail: string };

export default function Photos() {
  const { data, error, reload, token, setError } = useLoad<{ reports: Report[] }>("condition");
  const [photo, setPhoto] = useState<string | null>(null);

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.4, base64: true });
    if (!result.canceled && result.assets[0]?.base64) setPhoto(result.assets[0].base64);
  }

  async function save(kind: "move_in" | "move_out") {
    try {
      setError("");
      await api("condition", {
        token,
        body: {
          kind,
          rooms: ROOMS.map((room) => ({ room, condition: "good", notes: "", photoBase64: room === "Kitchen" ? photo : undefined })),
        },
      });
      setPhoto(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <Page onRefresh={reload}>
      <H1>Photos</H1>
      <Muted>Move-in and move-out.</Muted>
      <ErrorLine message={error} />
      <Button label={photo ? "Kitchen photo added" : "Add a kitchen photo"} ghost onPress={pick} />
      <Button label="Save move-in" onPress={() => save("move_in")} />
      <Button label="Save move-out" ghost onPress={() => save("move_out")} />
      {data?.reports.map((report) => (
        <Card key={report.id}>
          <Text style={{ fontSize: 20, color: colors.ink }}>{report.kind}</Text>
          <Text style={{ color: colors.mute }}>{report.when}</Text>
          <LearnMore>{report.detail}</LearnMore>
        </Card>
      ))}
    </Page>
  );
}
