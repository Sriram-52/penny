import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { Theme } from "../theme";
import { BottomSheet } from "./BottomSheet";

interface Props {
  theme: Theme;
  visible: boolean;
  title: string;
  initialName?: string;
  initialDate?: string | null;
  initialTarget?: number | null;
  onSubmit: (name: string, eventDate: string | null, target: number | null) => void;
  onCancel: () => void;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function displayDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function PocketNameModal({
  theme,
  visible,
  title,
  initialName,
  initialDate,
  initialTarget,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [eventDate, setEventDate] = useState<string | null>(initialDate ?? null);
  const [targetText, setTargetText] = useState(
    initialTarget != null ? String(initialTarget) : "",
  );

  useEffect(() => {
    if (visible) {
      setName(initialName ?? "");
      setEventDate(initialDate ?? null);
      setTargetText(initialTarget != null ? String(initialTarget) : "");
    }
  }, [visible, initialName, initialDate, initialTarget]);

  const trimmed = name.trim();
  const parsedTarget = targetText.trim() === "" ? null : Number(targetText);
  const targetValid = parsedTarget === null || (Number.isFinite(parsedTarget) && parsedTarget > 0);
  const submit = () => {
    if (trimmed && targetValid) onSubmit(trimmed, eventDate, parsedTarget);
  };

  const pickDate = () => {
    if (Platform.OS !== "android") return;
    DateTimePickerAndroid.open({
      value: eventDate ? new Date(`${eventDate}T12:00:00`) : new Date(),
      mode: "date",
      onValueChange: (_event, date) => {
        if (date) setEventDate(toDateString(date));
      },
    });
  };

  return (
    <BottomSheet theme={theme} visible={visible} title={title} onClose={onCancel}>
      <View style={styles.body}>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
          ]}
          value={name}
          onChangeText={setName}
          placeholder="Bangalore trip"
          placeholderTextColor={theme.muted}
          autoFocus
          maxLength={40}
          onSubmitEditing={submit}
        />
        <View style={styles.dateRow}>
          <Pressable onPress={pickDate} hitSlop={6} style={styles.dateButton}>
            <Text style={styles.dateEmoji}>📅</Text>
            <Text style={[styles.dateLabel, { color: eventDate ? theme.text : theme.muted }]}>
              {eventDate ? displayDate(eventDate) : "Add a date (optional)"}
            </Text>
          </Pressable>
          {eventDate && (
            <Pressable onPress={() => setEventDate(null)} hitSlop={10} accessibilityLabel="Clear date">
              <Text style={{ color: theme.muted, fontSize: 15 }}>✕</Text>
            </Pressable>
          )}
        </View>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
          ]}
          value={targetText}
          onChangeText={setTargetText}
          placeholder="Budget for this pocket (optional)"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
        />
        <View style={styles.actions}>
          <Pressable onPress={onCancel} hitSlop={8} style={styles.cancel}>
            <Text style={[styles.cancelLabel, { color: theme.muted }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={!trimmed}
            style={({ pressed }) => [
              styles.save,
              {
                backgroundColor: trimmed
                  ? pressed
                    ? theme.accentPressed
                    : theme.accent
                  : theme.border,
              },
            ]}
          >
            <Text style={[styles.saveLabel, { color: trimmed ? theme.onAccent : theme.muted }]}>
              Save
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 14, gap: 14 },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dateButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 2 },
  // Separate Text: Samsung's font stack can drop glyphs after an emoji in a
  // single semibold text run.
  dateEmoji: { fontSize: 14 },
  dateLabel: { fontSize: 14, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 14 },
  cancel: { paddingVertical: 8, paddingHorizontal: 4 },
  cancelLabel: { fontSize: 14, fontWeight: "600" },
  save: { borderRadius: 20, paddingVertical: 11, paddingHorizontal: 28 },
  saveLabel: { fontSize: 14, fontWeight: "700" },
});
