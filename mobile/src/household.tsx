import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api";
import type { Me } from "@/session";
import { colors } from "@/theme";
import { Button, ErrorLine, Field, Muted } from "@/ui";

type Member = { userId: string; role: "owner" | "roommate"; name: string; email: string };
type Pending = { id: string; email: string };
type Household = { role: "owner" | "roommate"; members: Member[]; pending: Pending[] };

export function Household({ token, spanish, onSession }: { token: string; spanish: boolean; onSession?: (session: Me) => void }) {
  const [home, setHome] = useState<Household | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const body = await api<{ household: Household | null }>("household", { token });
    setHome(body.household);
  }

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load roommates."));
  }, [token]);

  async function invite() {
    if (busy) return;
    try {
      setBusy(true);
      setError("");
      const body = await api<{ household: Household }>("invite", { token, body: { email } });
      setHome(body.household);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the invite.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    if (busy) return;
    try {
      setBusy(true);
      setError("");
      const body = await api<{ household: Household }>("invite/remove", { token, body: { userId } });
      setHome(body.household);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that person.");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (busy) return;
    try {
      setBusy(true);
      setError("");
      onSession?.(await api<Me>("invite/leave", { token, body: {} }));
      setHome(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave this home.");
    } finally {
      setBusy(false);
    }
  }

  if (!home) return error ? <ErrorLine message={error} /> : null;
  const owner = home.role === "owner";
  return (
    <View style={styles.block}>
      <Text style={styles.section}>{spanish ? "Compañeros" : "Roommates"}</Text>
      <Muted>
        {spanish
          ? "Comparten los registros, las fotos, los recordatorios y el chat con el propietario. Nada de esto se envía al propietario."
          : "They share this home's records, photos, reminders, and landlord chat. Nothing here is sent to the landlord."}
      </Muted>
      {home.members.map((member) => (
        <View key={member.userId} style={styles.row}>
          <View style={styles.grow}>
            <Text style={styles.name}>{member.name || member.email}</Text>
            <Text style={styles.meta}>{member.role === "owner" ? (spanish ? "Agregó la vivienda" : "Added the home") : (spanish ? "Compañero" : "Roommate")}</Text>
          </View>
          {owner && member.role === "roommate" ? (
            <Button label={spanish ? "Quitar" : "Remove"} ghost onPress={() => void remove(member.userId)} disabled={busy} />
          ) : null}
        </View>
      ))}
      {home.pending.map((invite) => (
        <Text key={invite.id} style={styles.meta}>{spanish ? `Invitación pendiente: ${invite.email}` : `Invite pending: ${invite.email}`}</Text>
      ))}
      {owner ? (
        <View>
          <Field label={spanish ? "Correo del compañero" : "Roommate email"} value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Button label={busy ? (spanish ? "Enviando" : "Sending") : (spanish ? "Invitar" : "Invite")} onPress={() => void invite()} disabled={busy || !email.trim()} />
        </View>
      ) : (
        <Button label={spanish ? "Salir de esta vivienda" : "Leave this home"} ghost onPress={() => void leave()} disabled={busy} />
      )}
      <ErrorLine message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 20 },
  section: { color: colors.ink, fontSize: 13, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  grow: { flex: 1 },
  name: { color: colors.ink, fontSize: 16 },
  meta: { color: colors.mute, fontSize: 14, marginTop: 2 },
});
