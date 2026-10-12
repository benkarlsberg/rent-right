import { router } from "expo-router";
import { useState } from "react";
import { api } from "@/api";
import { useSession } from "@/session";
import { Button, ErrorLine, Field, H1, Page } from "@/ui";

export default function NewLog() {
  const { token } = useSession();
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function save(sendEmail: boolean) {
    try {
      setError("");
      const created = await api<{ id: string }>("log", { token, body: { type: "repair", severity: "leak", description, sendEmail } });
      router.replace(sendEmail ? "/chat" : `/log/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <Page>
      <H1>New note</H1>
      <ErrorLine message={error} />
      <Field label="What happened" value={description} onChange={setDescription} multiline />
      <Button label="Save" onPress={() => save(false)} />
      <Button label="Save and email landlord" ghost onPress={() => save(true)} />
    </Page>
  );
}
