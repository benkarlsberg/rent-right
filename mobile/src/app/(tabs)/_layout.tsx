import { Tabs } from "expo-router";
import { useSession } from "@/session";
import { colors } from "@/theme";

export default function TabsLayout() {
  const session = useSession();
  const spanish = session.me?.user.locale === "es";
  return (
    <Tabs
      initialRouteName="chat"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.pine,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 64, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 15, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="chat" options={{ title: spanish ? "Chat" : "Chat" }} />
      <Tabs.Screen name="landlord" options={{ title: spanish ? "Propietario" : "Landlord" }} />
      <Tabs.Screen name="records" options={{ title: spanish ? "Registros" : "Records" }} />
    </Tabs>
  );
}
