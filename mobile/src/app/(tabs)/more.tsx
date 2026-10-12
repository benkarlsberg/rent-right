import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { colors } from "@/theme";
import { H1, Page } from "@/ui";

const LINKS: { href: "/lease" | "/deposit" | "/increase" | "/assistant" | "/ledger" | "/photos" | "/packet" | "/settings"; label: string }[] = [
  { href: "/lease", label: "Lease" },
  { href: "/deposit", label: "Deposit" },
  { href: "/increase", label: "Rent increase" },
  { href: "/assistant", label: "Rights" },
  { href: "/ledger", label: "Rent paid" },
  { href: "/photos", label: "Photos" },
  { href: "/packet", label: "Records PDF" },
  { href: "/settings", label: "Settings" },
];

export default function More() {
  return (
    <Page>
      <H1>More</H1>
      {LINKS.map((link) => (
        <Pressable key={link.href} onPress={() => router.push(link.href)} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Text style={{ fontSize: 20, color: colors.ink }}>{link.label}</Text>
        </Pressable>
      ))}
    </Page>
  );
}
