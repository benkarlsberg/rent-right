import { Tabs } from "expo-router";
import { colors } from "@/theme";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.pine,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: { backgroundColor: "#fffdf8", borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: () => null }} />
      <Tabs.Screen name="log" options={{ title: "Log", tabBarIcon: () => null }} />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: () => null }} />
      <Tabs.Screen name="dates" options={{ title: "Dates", tabBarIcon: () => null }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: () => null }} />
    </Tabs>
  );
}
