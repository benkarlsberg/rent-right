import { router } from "expo-router";
import { Text } from "react-native";
import { saveAuthorizedFile } from "@/files";
import type { Notice } from "@/session";
import { colors } from "@/theme";
import { Button, ErrorLine, H1, LegalNote, LearnMore, Page } from "@/ui";
import { useLoad } from "@/use-load";

export default function Packet() {
  const { data, error, token, setError } = useLoad<{ title: string; subtitle: string; detail: string; notice: Notice }>("packet");
  return (
    <Page>
      <H1>{data?.title || "Records"}</H1>
      <Text style={{ fontSize: 18, color: colors.pine, marginTop: 6 }}>{data?.subtitle}</Text>
      {data?.notice ? <LegalNote notice={data.notice} /> : null}
      {data?.detail ? <LearnMore>{data.detail}</LearnMore> : null}
      <ErrorLine message={error} />
      <Button label="Download PDF" onPress={async () => {
        if (!token) return;
        try {
          setError("");
          const saved = await saveAuthorizedFile("/api/packet", "evidence-packet.pdf", token);
          if (saved === "needs-landlord") router.push("/landlord");
        }
        catch (err) { setError(err instanceof Error ? err.message : "Could not download."); }
      }} />
    </Page>
  );
}
