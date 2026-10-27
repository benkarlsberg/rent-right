import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/api";
import type { Me } from "@/session";
import { useSession } from "@/session";
import { colors } from "@/theme";
import { ErrorLine, Field, wrapText } from "@/ui";

export function asksForName(value: string): boolean {
  return /add your name in settings|agregue su nombre en ajustes/i.test(value);
}

export function NamePrompt({ message, onSaved }: { message: string; onSaved: () => void }) {
  const { me, token, signIn } = useSession();
  const spanish = me?.user.locale === "es";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function save() {
    const next = name.trim().replace(/\s+/g, " ");
    if (!token || !me || saving) return;
    if (!next) {
      setError(spanish ? "Escriba su nombre." : "Enter your name.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const session = await api<Me>("settings", {
        token,
        body: { name: next, locale: me.user.locale, lowBandwidth: me.user.lowBandwidth },
      });
      await signIn(session);
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : spanish ? "No se pudo guardar el nombre." : "Could not save the name.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.block}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={message}
      >
        <Text style={[styles.prompt, wrapText]}>{message}</Text>
      </Pressable>
      {open ? (
        <View>
          <Field
            label={spanish ? "Su nombre" : "Your name"}
            value={name}
            onChange={setName}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            nativeID="inline-name"
            inputRef={inputRef}
          />
          <Pressable
            onPress={() => void save()}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={spanish ? "Guardar nombre" : "Save name"}
            style={styles.save}
          >
            <Text style={styles.saveText}>{saving ? (spanish ? "Guardando" : "Saving") : (spanish ? "Guardar" : "Save")}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/settings?focus=name")} accessibilityRole="link" accessibilityLabel={spanish ? "Abrir Ajustes" : "Open Settings"}>
            <Text style={styles.link}>{spanish ? "Abrir Ajustes" : "Open Settings"}</Text>
          </Pressable>
          <ErrorLine message={error} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 8 },
  prompt: { color: colors.pine, fontSize: 15, lineHeight: 21, fontWeight: "700", textDecorationLine: "underline" },
  save: { marginTop: 12, backgroundColor: colors.pine, borderRadius: 12, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  saveText: { color: "white", fontSize: 15, fontWeight: "700" },
  link: { color: colors.pine, fontSize: 15, fontWeight: "700", marginTop: 10 },
});
