import { useState } from "react";
import { Text, View } from "react-native";
import { DateField } from "@/date-field";
import { colors } from "@/theme";
import { Button, Field } from "@/ui";

export function ResolvePanel({
  pending,
  pendingTitle,
  pendingNote,
  markLabel,
  confirmLabel,
  noteLabel,
  dateLabel,
  earliest,
  today,
  busy,
  quiet,
  onSubmit,
}: {
  pending: boolean;
  pendingTitle: string | null;
  pendingNote: string | null;
  markLabel: string;
  confirmLabel: string;
  noteLabel: string;
  dateLabel: string;
  earliest: string;
  today: string;
  busy: boolean;
  quiet?: boolean;
  onSubmit: (input: { note: string; date: string }) => void;
}) {
  const [open, setOpen] = useState(pending);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today);
  if (!open) {
    return <Button label={markLabel} ghost={quiet} onPress={() => { setDate(today); setOpen(true); }} disabled={busy} />;
  }
  return (
    <View>
      {pendingTitle ? <Text style={{ fontSize: 16, lineHeight: 22, color: colors.ink, fontWeight: "700", marginTop: 8 }}>{pendingTitle}</Text> : null}
      {pendingNote ? <Text style={{ fontSize: 16, lineHeight: 22, color: colors.mute, marginTop: 6 }}>{pendingNote}</Text> : null}
      <Field label={noteLabel} value={note} onChange={setNote} multiline />
      <DateField label={dateLabel} value={date} onChange={setDate} min={earliest} max={today} />
      <Button label={pending ? confirmLabel : markLabel} onPress={() => onSubmit({ note, date })} disabled={busy} />
    </View>
  );
}
