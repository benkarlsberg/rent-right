import { useState } from "react";
import { Text } from "react-native";
import { api } from "@/api";
import { saveAuthorizedFile } from "@/files";
import type { Notice } from "@/session";
import { colors } from "@/theme";
import { Button, ErrorLine, Field, H1, LegalNote, LearnMore, Page } from "@/ui";
import { refreshBootstrap } from "@/tab-cache";
import { useLoad } from "@/use-load";

type DepositData = {
  title: string;
  subtitle: string;
  amount: string;
  moveOut: string;
  forwarding: string;
  detail: string;
  notice: Notice;
};

export default function Deposit() {
  const { data, error, reload, token, setError } = useLoad<DepositData>("deposit");
  const [moveOut, setMoveOut] = useState("");
  const [amount, setAmount] = useState("");
  const [forwarding, setForwarding] = useState("");
  const [notes, setNotes] = useState("");

  async function save() {
    try {
      setError("");
      await api("deposit", { token, body: { moveOutDate: moveOut || data?.moveOut, amount: amount || undefined, forwardingAddress: forwarding } });
      if (token) void refreshBootstrap(token, true);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  async function letter() {
    if (!token) return;
    try {
      setError("");
      await saveAuthorizedFile(`/api/letters/demand?notes=${encodeURIComponent(notes)}`, "deposit-letter.pdf", token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make the letter.");
    }
  }

  return (
    <Page onRefresh={reload}>
      <H1>Deposit</H1>
      <Text style={{ fontSize: 36, marginTop: 8, color: colors.ink }}>{data?.title}</Text>
      <Text style={{ fontSize: 18, color: colors.pine, fontWeight: "700" }}>{data?.subtitle}</Text>
      {data?.amount ? <Text style={{ marginTop: 6, fontSize: 18 }}>{data.amount}</Text> : null}
      {data?.notice ? <LegalNote notice={data.notice} /> : null}
      {data?.detail ? <LearnMore>{data.detail}</LearnMore> : null}
      <ErrorLine message={error} />
      <LearnMore label="Update">
        <Field label="Move-out" value={moveOut} onChange={setMoveOut} placeholder="YYYY-MM-DD" />
        <Field label="Amount" value={amount} onChange={setAmount} />
        <Field label="Forwarding address" value={forwarding} onChange={setForwarding} />
        <Button label="Save" onPress={save} />
      </LearnMore>
      <LearnMore label="Letter I send myself">
        <Field label="What happened" value={notes} onChange={setNotes} multiline />
        <Button label="Save PDF" onPress={letter} />
      </LearnMore>
    </Page>
  );
}
