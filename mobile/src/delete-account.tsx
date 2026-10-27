import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api";
import { saveAuthorizedFile } from "@/files";
import { colors } from "@/theme";
import { Button, ErrorLine, Field, Muted } from "@/ui";

export function DeleteAccount({
  token,
  spanish,
  onDeleted,
}: {
  token: string;
  spanish: boolean;
  onDeleted: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = confirm.trim() === "DELETE" && !busy;

  async function download() {
    try {
      setError("");
      const saved = await saveAuthorizedFile("/api/packet", "rent-right-evidence.pdf", token);
      if (saved === "needs-landlord") router.push("/landlord");
    } catch (err) {
      setError(err instanceof Error ? err.message : spanish ? "No se pudo exportar." : "Could not export the packet.");
    }
  }

  async function remove() {
    if (!ready) return;
    try {
      setBusy(true);
      setError("");
      await api("account/delete", { token, body: { confirm: confirm.trim() } });
      await onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : spanish ? "No se pudo eliminar la cuenta." : "Could not delete the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Button label={spanish ? "Exportar paquete de evidencia" : "Export evidence packet"} ghost onPress={() => void download()} />
      <View style={styles.danger} accessibilityRole="summary">
        <Text style={styles.title}>{spanish ? "Eliminar la cuenta" : "Delete account"}</Text>
        <Muted>
          {spanish
            ? "Eliminar la cuenta borra su perfil, sus registros, sus archivos, sus recordatorios, sus chats y sus comunicaciones con el propietario. Una vivienda que comparte con otra persona se queda para esa persona."
            : "Deleting your account erases your profile, your records, your files, your reminders, your chats, and your landlord communications. A home you share with someone else stays for them."}
        </Muted>
        <Field label={spanish ? "Escriba DELETE" : "Type DELETE"} value={confirm} onChange={setConfirm} autoCapitalize="characters" />
        <Button label={spanish ? "Eliminar la cuenta" : "Delete account"} danger onPress={() => void remove()} disabled={!ready} />
        <ErrorLine message={error} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  danger: { marginTop: 28, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#f0d0d6", backgroundColor: "#f8ecec" },
  title: { color: colors.bad, fontSize: 18, fontWeight: "700" },
});
