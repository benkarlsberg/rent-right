import { useState } from "react";
import { Text } from "react-native";
import { api } from "@/api";
import { saveAuthorizedFile } from "@/files";
import { colors } from "@/theme";
import { Button, Card, ErrorLine, Field, H1, Page } from "@/ui";
import { useLoad } from "@/use-load";

type LedgerData = { items: { id: string; amount: string; date: string; method: string; voided: boolean }[] };

export default function Ledger() {
  const { data, error, reload, token, setError } = useLoad<LedgerData>("ledger");
  const [amount, setAmount] = useState("");

  async function add() {
    try {
      setError("");
      await api("ledger", { token, body: { amount } });
      setAmount("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <Page onRefresh={reload}>
      <H1>Rent paid</H1>
      <ErrorLine message={error} />
      {data?.items.map((item) => (
        <Card key={item.id}>
          <Text style={{ fontSize: 22, color: item.voided ? colors.mute : colors.ink }}>{item.amount}</Text>
          <Text style={{ color: colors.mute }}>{item.date} · {item.method}</Text>
        </Card>
      ))}
      <Field label="Amount" value={amount} onChange={setAmount} />
      <Button label="Add payment" onPress={add} />
      <Button label="PDF" ghost onPress={() => token && saveAuthorizedFile("/api/ledger/pdf", "rent-ledger.pdf", token)} />
    </Page>
  );
}
