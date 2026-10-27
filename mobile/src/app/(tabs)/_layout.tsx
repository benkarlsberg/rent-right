import { Tabs, usePathname } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { SvgXml } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/session";
import { colors } from "@/theme";
import { prefetchTabs } from "@/tab-cache";

const TAB_BODY = 62;

function tabIcon(name: "chat" | "landlord" | "reminders" | "records", color: string) {
  const pen = `fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
  const body = {
    chat: `<path ${pen} d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 16.5H9l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5z"/>`,
    landlord: `<circle ${pen} cx="12" cy="8" r="2.4"/><path ${pen} d="M6.5 18.2v-.6a4.2 4.2 0 0 1 4.2-4.2h2.6a4.2 4.2 0 0 1 4.2 4.2v.6"/>`,
    reminders: `<circle ${pen} cx="12" cy="12.2" r="6.6"/><path ${pen} d="M12 9v3.4l2.2 1.4"/>`,
    records: `<path ${pen} d="M7 4.8h6.6L17.5 8.7V19a1.4 1.4 0 0 1-1.4 1.4H7A1.4 1.4 0 0 1 5.6 19V6.2A1.4 1.4 0 0 1 7 4.8z"/><path ${pen} d="M13.4 4.9V8.6h3.6"/>`,
  }[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">${body}</svg>`;
}

function TabIcon({ name, color }: { name: "chat" | "landlord" | "reminders" | "records"; color: string }) {
  return <SvgXml xml={tabIcon(name, color)} width={20} height={20} />;
}

function tabMatches(path: string, href: string) {
  return path === href || (path === "/" && href === "/chat");
}

export default function TabsLayout() {
  const session = useSession();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 0);
  const spanish = session.me?.user.locale === "es";
  const path = usePathname();
  useEffect(() => {
    if (session.token) prefetchTabs(session.token);
  }, [session.token]);
  return (
    <Tabs
      initialRouteName="chat"
      safeAreaInsets={{ top: insets.top, right: insets.right, bottom, left: insets.left }}
      screenOptions={{
        headerShown: false,
        tabBarButton: ({ ref: _ref, href, onPress, ...props }) => {
          const target = typeof href === "string" ? href : "";
          const selected = tabMatches(path, target) || Boolean(props.accessibilityState?.selected);
          return (
            <Pressable
              {...props}
              accessibilityRole="tab"
              accessibilityState={{ ...props.accessibilityState, selected }}
              aria-selected={selected}
              aria-current={selected ? "page" : undefined}
              onPress={(event) => {
                event?.preventDefault?.();
                onPress?.(event);
              }}
              style={[props.style, styles.hit, selected ? styles.hitOn : null]}
            />
          );
        },
        tabBarActiveTintColor: colors.pine,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          height: TAB_BODY + bottom,
          paddingTop: 0,
          paddingBottom: bottom,
        },
        tabBarItemStyle: { justifyContent: "center", paddingHorizontal: 2 },
      }}
    >
      <Tabs.Screen name="chat" options={tabOptions("chat", "/chat", "Chat", path)} />
      <Tabs.Screen name="landlord" options={tabOptions("landlord", "/landlord", spanish ? "Propietario" : "Landlord", path)} />
      <Tabs.Screen name="reminders" options={tabOptions("reminders", "/reminders", spanish ? "Recordatorios" : "Reminders", path)} />
      <Tabs.Screen name="records" options={tabOptions("records", "/records", spanish ? "Registros" : "Records", path)} />
      <Tabs.Screen name="photos" options={{ href: null, title: "Photos" }} />
    </Tabs>
  );
}

function tabOptions(name: "chat" | "landlord" | "reminders" | "records", href: string, title: string, path: string) {
  const on = tabMatches(path, href);
  const tint = on ? colors.pine : colors.mute;
  return {
    title,
    tabBarIcon: () => <TabIcon name={name} color={tint} />,
    tabBarLabel: () => (
      <Text numberOfLines={1} style={{ color: tint, fontSize: 11, lineHeight: 14, fontWeight: on ? "700" : "500", textAlign: "center" }}>
        {title}
      </Text>
    ),
  };
}

const styles = StyleSheet.create({
  hit: { borderRadius: 16, marginHorizontal: 3, marginVertical: 6, justifyContent: "center" },
  hitOn: { backgroundColor: "#E7F3F1" },
});
