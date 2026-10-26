import { StyleSheet, Text, View, type TextStyle } from "react-native";
import { formatAddressLines, type AddressParts } from "../../lib/address-format";
import { colors } from "@/theme";

export { formatAddressHtml, formatAddressLines, formatAddressPlain } from "../../lib/address-format";

type AddressProps = AddressParts & { style?: TextStyle };

export function Address({ street, unit, city, region, postalCode, style }: AddressProps) {
  const [line1, line2] = formatAddressLines({ street, unit, city, region, postalCode });
  if (!line1 && !line2) return null;
  const text = style || styles.line;
  return (
    <View accessibilityLabel={[line1, line2].filter(Boolean).join(", ")}>
      {line1 ? <Text style={text}>{line1}</Text> : null}
      {line2 ? <Text style={text}>{line2}</Text> : null}
    </View>
  );
}

export function LabeledAddress({ label, ...parts }: AddressProps & { label: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Address {...parts} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.mute, fontSize: 13, lineHeight: 18, fontWeight: "700", marginTop: 16 },
  line: { color: colors.ink, fontSize: 16, lineHeight: 22 },
});
