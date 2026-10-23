import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/session";
import { colors } from "@/theme";

const TAB_BODY = 56;

export default function TabsLayout() {
  const session = useSession();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 0);
  const spanish = session.me?.user.locale === "es";
  return (
    <Tabs
      initialRouteName="chat"
      safeAreaInsets={{ top: insets.top, right: insets.right, bottom, left: insets.left }}
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarIconStyle: { width: 0, height: 0, overflow: "hidden" },
        tabBarActiveTintColor: colors.pine,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          height: TAB_BODY + bottom,
          paddingTop: 0,
          paddingBottom: bottom,
        },
        tabBarItemStyle: { justifyContent: "center" },
        tabBarLabelStyle: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
      }}
    >
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="landlord" options={{ title: spanish ? "Propietario" : "Landlord" }} />
      <Tabs.Screen name="records" options={{ title: spanish ? "Registros" : "Records" }} />
    </Tabs>
  );
}
