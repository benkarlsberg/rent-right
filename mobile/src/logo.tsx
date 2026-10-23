import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { horizontalLogo, logoAspect } from "@/brand-svg";

export function Logo({ width = 240 }: { width?: number }) {
  const height = Math.round(width / logoAspect);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Rent Right" style={{ width, height }}>
      <SvgXml xml={horizontalLogo} width={width} height={height} />
    </View>
  );
}
