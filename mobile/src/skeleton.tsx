import { View } from "react-native";

const bar = { backgroundColor: "#E4EEEF", borderRadius: 12, marginBottom: 10 };

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ paddingTop: 12 }}>
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          style={[bar, { height: index === 0 ? 18 : 68, width: index === 0 ? "62%" : "100%" }]}
        />
      ))}
    </View>
  );
}
