import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api";
import { DateField } from "@/date-field";
import { saveAuthorizedFile } from "@/files";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { colors } from "@/theme";
import { Button, Card, ErrorLine, Field, H1, Muted, Page, wrapText } from "@/ui";
import { refreshBootstrap } from "@/tab-cache";
import { useLoad } from "@/use-load";

type Suggestion = { label: string; street: string; city: string; region: string; postalCode: string };
type Labels = {
  title: string;
  intro: string;
  homes: string;
  active: string;
  archived: string;
  show: string;
  street: string;
  unit: string;
  city: string;
  zip: string;
  landlordName: string;
  landlordEmail: string;
  rent: string;
  leaseStart: string;
  leaseEnd: string;
  check: string;
  useAddress: string;
  checked: string;
  typo: string;
  move: string;
  lawsChange: string;
  lawsSame: string;
  acknowledge: string;
  saveDetails: string;
  saveTypo: string;
  saveMove: string;
  nothingSent: string;
  relayLabel: string;
  relayKeep: string;
  relayNew: string;
  archivedNote: string;
  export: string;
};
type Home = {
  id: string;
  street: string;
  unitNumber: string;
  city: string;
  postalCode: string;
  region: string;
  landlordName: string;
  landlordEmail: string;
  rent: string;
  moveInDate: string;
  leaseEndDate: string;
  relay: string;
  summary: string;
  archived: boolean;
  canEdit: boolean;
};
type Residence = {
  home: Home | null;
  homes: { id: string; address: string; archived: boolean; selected: boolean; status: string }[];
  labels: Labels;
  archivedNote: string | null;
};
function placeLine(home: Pick<Home, "street" | "unitNumber" | "city" | "postalCode">): string {
  const raw = home.unitNumber.trim().replace(/\s+/g, " ");
  let unit = raw;
  if (raw && !/^(apt|apartment|#)\b/i.test(raw)) {
    const stripped = raw.replace(/^(unit\s+)+/i, "").trim();
    unit = stripped ? `Unit ${stripped}` : "";
  }
  return [home.street, unit, home.city, "CA", home.postalCode].filter(Boolean).join(", ").replace(", CA,", " CA");
}

type Preview = {
  inCalifornia: boolean;
  summary: string;
  suggestion: Suggestion | null;
  jurisdiction: string;
  lawsChange: boolean;
  addressChanged: boolean;
  warning: string;
};

function californiaZip(value: string): boolean {
  if (!/^\d{5}$/.test(value)) return false;
  const prefix = Number(value.slice(0, 3));
  return prefix >= 900 && prefix <= 961;
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function ResidenceScreen() {
  const { data, error, reload, setError, token } = useLoad<Residence>("residence");
  const { signIn } = useSession();
  const labels = data?.labels;
  const home = data?.home;
  const [street, setStreet] = useState("");
  const [unitNumber, setUnit] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostal] = useState("");
  const [landlordName, setLandlord] = useState("");
  const [landlordEmail, setEmail] = useState("");
  const [rent, setRent] = useState("");
  const [moveInDate, setMoveIn] = useState("");
  const [leaseEndDate, setLeaseEnd] = useState("");
  const [mode, setMode] = useState<"typo" | "move" | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checked, setChecked] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!home) return;
    setStreet(home.street);
    setUnit(home.unitNumber);
    setCity(home.city);
    setPostal(home.postalCode);
    setLandlord(home.landlordName);
    setEmail(home.landlordEmail);
    setRent(home.rent);
    setMoveIn(home.moveInDate);
    setLeaseEnd(home.leaseEndDate);
    setMode(null);
    setPreview(null);
    setChecked("");
    setAccepted(false);
    setAcknowledged(false);
  }, [home]);

  function touchAddress(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setAccepted(false);
      setPreview(null);
      setMode(null);
      setAcknowledged(false);
      setNote("");
    };
  }

  const addressChanged = Boolean(home) && (
    norm(street) !== norm(home?.street || "")
    || norm(unitNumber) !== norm(home?.unitNumber || "")
    || norm(city) !== norm(home?.city || "")
    || postalCode.trim() !== (home?.postalCode || "")
  );

  function body() {
    return {
      street: street.trim(),
      unitNumber: unitNumber.trim(),
      city: city.trim(),
      postalCode: postalCode.trim(),
      region: home?.region || "CA",
      landlordName: landlordName.trim(),
      landlordEmail: landlordEmail.trim(),
      rent: rent.trim(),
      moveInDate,
      leaseEndDate,
    };
  }

  async function previewAddress(nextMode: "typo" | "move") {
    if (!token || !labels) return;
    const zip = postalCode.trim();
    if (!street.trim() || !city.trim() || !californiaZip(zip)) {
      setError(labels.zip === "ZIP" ? "Add a street, city, and California ZIP." : "Agregue calle, ciudad y un código postal de California.");
      return;
    }
    if (!landlordName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(landlordEmail.trim())) {
      setError(labels.landlordEmail === "Landlord email" ? "Add the landlord's name and email." : "Agregue el nombre y el correo del propietario.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      setNote("");
      const found = await api<Preview>("residence/preview", { token, body: body() });
      const suggestion = found.suggestion;
      const differs = suggestion
        && (suggestion.street.toLowerCase() !== street.trim().toLowerCase()
          || suggestion.city.toLowerCase() !== city.trim().toLowerCase()
          || suggestion.postalCode !== zip);
      if (suggestion && differs && !accepted) {
        setStreet(suggestion.street);
        setCity(suggestion.city);
        setPostal(suggestion.postalCode);
        setChecked(suggestion.label);
        setAccepted(true);
        setPreview(null);
        setMode(nextMode);
        return;
      }
      if (suggestion) setChecked(suggestion.label);
      setPreview(found);
      setMode(nextMode);
      setAcknowledged(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check the address.");
    } finally {
      setBusy(false);
    }
  }

  async function save(nextMode: "typo" | "move" | "details") {
    if (!token || busy) return;
    try {
      setBusy(true);
      setError("");
      const session = await api<Me & { note?: string }>("residence/save", {
        token,
        body: { ...body(), mode: nextMode, acknowledged },
      });
      await signIn(session);
      void refreshBootstrap(session.token, true);
      setNote(session.note || labels?.nothingSent || "");
      setPreview(null);
      setMode(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function select(id: string) {
    if (!token || busy) return;
    try {
      setBusy(true);
      setError("");
      setNote("");
      const session = await api<Me>("residence/select", { token, body: { id } });
      await signIn(session);
      void refreshBootstrap(session.token, true);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch homes.");
    } finally {
      setBusy(false);
    }
  }

  const lawsBlocked = Boolean(preview?.lawsChange && !acknowledged);
  const title = labels?.title || "Residence";

  return (
    <Page onRefresh={reload}>
      <Stack.Screen options={{ title }} />
      <H1>{title}</H1>
      {labels ? <Muted>{labels.intro}</Muted> : null}
      <ErrorLine message={error} />
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {data && labels && data.homes.length ? (
        <View>
          <Text style={styles.section}>{labels.homes}</Text>
          {data.homes.map((item) => (
            <View key={item.id} style={styles.home}>
              <Text style={styles.homeAddress}>{item.address}</Text>
              <Text style={styles.homeStatus}>{item.status}</Text>
              {item.selected ? null : (
                <Pressable onPress={() => void select(item.id)} accessibilityRole="button" accessibilityLabel={`${labels.show}. ${item.address}`} style={styles.linkHit}>
                  <Text style={styles.link}>{labels.show}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : null}
      {data?.archivedNote ? <Card tone="warn"><Text style={styles.warn}>{data.archivedNote}</Text></Card> : null}
      {home?.archived && token ? (
        <Button label={labels?.export || "Export evidence"} onPress={() => void saveAuthorizedFile("/api/packet", "rent-right-evidence.pdf", token)} />
      ) : null}
      {home && labels ? (
        <View>
          <Text style={styles.section}>{labels.relayLabel}</Text>
          <Text style={styles.relay}>{home.relay}</Text>
          <Muted>{labels.relayKeep}</Muted>
          <Muted>{labels.relayNew}</Muted>
        </View>
      ) : null}
      {home && labels && home.canEdit ? (
        <View>
          <Field label={labels.street} value={street} onChange={touchAddress(setStreet)} autoComplete="street-address" textContentType="fullStreetAddress" />
          <Field label={labels.unit} value={unitNumber} onChange={touchAddress(setUnit)} />
          <Field label={labels.city} value={city} onChange={touchAddress(setCity)} autoComplete="postal-address-locality" textContentType="addressCity" />
          <Field label={labels.zip} value={postalCode} onChange={touchAddress(setPostal)} keyboardType="number-pad" autoComplete="postal-code" textContentType="postalCode" />
          {checked ? <Text style={styles.checked}>{`${labels.checked}: ${checked}`}</Text> : null}
          <Field label={labels.landlordName} value={landlordName} onChange={setLandlord} autoComplete="name" textContentType="name" />
          <Field label={labels.landlordEmail} value={landlordEmail} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
          <Field label={labels.rent} value={rent} onChange={setRent} keyboardType="decimal-pad" />
          <DateField label={labels.leaseStart} value={moveInDate} onChange={setMoveIn} />
          <DateField label={labels.leaseEnd} value={leaseEndDate} onChange={setLeaseEnd} />
          {addressChanged ? (
            <View>
              <Button label={busy ? "…" : labels.typo} ghost onPress={() => void previewAddress("typo")} disabled={busy} />
              <Button label={busy ? "…" : labels.move} ghost onPress={() => void previewAddress("move")} disabled={busy} />
            </View>
          ) : (
            <Button label={busy ? "…" : labels.saveDetails} onPress={() => void save("details")} disabled={busy} />
          )}
          {preview && mode ? (
            <Card tone={preview.lawsChange ? "warn" : undefined}>
              {preview.warning ? <Text style={preview.lawsChange ? styles.warn : styles.body}>{preview.warning}</Text> : null}
              <Text style={styles.body}>{preview.summary}</Text>
              {preview.lawsChange ? (
                <Pressable
                  onPress={() => setAcknowledged((on) => !on)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: acknowledged }}
                  accessibilityLabel={labels.acknowledge}
                  style={[styles.ack, acknowledged && styles.ackOn]}
                >
                  <Text style={[styles.ackText, acknowledged && styles.ackTextOn]}>{labels.acknowledge}</Text>
                </Pressable>
              ) : null}
              <Button
                label={busy ? "…" : mode === "move" ? labels.saveMove : labels.saveTypo}
                onPress={() => void save(mode)}
                disabled={busy || lawsBlocked || !preview.addressChanged}
              />
            </Card>
          ) : null}
        </View>
      ) : null}
      {home && !home.canEdit ? (
        <Card>
          <Text style={styles.body}>{placeLine(home)}</Text>
          <Text style={styles.body}>{home.summary}</Text>
        </Card>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { ...wrapText, marginTop: 22, fontSize: 18, fontWeight: "700", color: colors.ink },
  home: { marginTop: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  homeAddress: { ...wrapText, fontSize: 16, lineHeight: 22, color: colors.ink },
  homeStatus: { ...wrapText, fontSize: 14, lineHeight: 20, color: colors.pine, marginTop: 4, fontWeight: "700" },
  linkHit: { minHeight: 44, justifyContent: "center" },
  link: { color: colors.pine, fontSize: 16, fontWeight: "700" },
  relay: { ...wrapText, marginTop: 6, fontSize: 16, lineHeight: 22, color: colors.ink },
  checked: { ...wrapText, color: colors.ink, fontSize: 15, lineHeight: 21, marginTop: 12 },
  note: { ...wrapText, marginTop: 12, color: colors.pine, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  warn: { ...wrapText, color: colors.warn, fontSize: 17, lineHeight: 24, fontWeight: "700" },
  body: { ...wrapText, color: colors.ink, fontSize: 16, lineHeight: 22, marginTop: 8 },
  ack: { marginTop: 12, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  ackOn: { backgroundColor: colors.pine, borderColor: colors.pine },
  ackText: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  ackTextOn: { color: "white" },
});
