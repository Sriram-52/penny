import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  addRule,
  getCurrency,
  updateExpense,
  type CategoryRecord,
  type ExpenseRecord,
  type PocketRecord,
} from "../db";
import { getCategoryMeta } from "../lib/categories";
import { currencySymbol, friendlyDay, localToday } from "../lib/format";
import type { Theme } from "../theme";
import { ActionSheet, useActionSheet } from "./ActionSheet";
import { BottomSheet } from "./BottomSheet";
import { CategoryPicker } from "./CategoryPicker";

interface Props {
  theme: Theme;
  expense: ExpenseRecord | null;
  categories: CategoryRecord[];
  pockets: PocketRecord[];
  onClose: () => void;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExpenseEditSheet({ theme, expense, categories, pockets, onClose }: Props) {
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [category, setCategory] = useState("other");
  const [pocketId, setPocketId] = useState<string | null>(null);
  const [date, setDate] = useState(localToday());
  const [kind, setKind] = useState<"debit" | "credit">("debit");
  const [pickingCategory, setPickingCategory] = useState(false);
  const pocketSheet = useActionSheet();

  useEffect(() => {
    if (expense) {
      setDescription(expense.description);
      setAmountText(String(expense.amount));
      setCategory(expense.category);
      setPocketId(expense.pocketId ?? null);
      setDate(expense.date);
      setKind(expense.kind === "credit" ? "credit" : "debit");
    }
  }, [expense]);

  const meta = getCategoryMeta(category, categories);
  const amount = Number(amountText);
  const valid = Number.isFinite(amount) && amount !== 0 && description.trim().length > 0;

  const pocketName =
    pocketId === null ? "Everyday" : (pockets.find((p) => p.id === pocketId)?.name ?? "?");

  const pickDate = () => {
    if (Platform.OS !== "android") return;
    DateTimePickerAndroid.open({
      value: new Date(`${date}T12:00:00`),
      mode: "date",
      onValueChange: (_event, picked) => {
        if (picked) setDate(toDateString(picked));
      },
    });
  };

  const pickPocket = () => {
    Haptics.selectionAsync();
    pocketSheet.show({
      title: "Which pocket?",
      actions: [
        { label: "🪙 Everyday", onPress: () => setPocketId(null) },
        ...pockets.map((p) => ({ label: `🎒 ${p.name}`, onPress: () => setPocketId(p.id) })),
      ],
    });
  };

  const save = async () => {
    if (!expense || !valid) return;
    await updateExpense(expense.id, {
      amount: Math.abs(amount),
      description: description.trim(),
      category,
      date,
      kind,
      pocketId,
    });
    // A tag correction while editing teaches Penny, same as on confirm cards.
    if (category !== expense.category) {
      await addRule(description, category);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <BottomSheet theme={theme} visible={expense !== null} title="Edit expense" onClose={onClose}>
      <View style={styles.body}>
        <View style={styles.fieldRow}>
              <TextInput
                style={[
                  styles.descriptionInput,
                  { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="What was it?"
                placeholderTextColor={theme.muted}
              />
              <View
                style={[
                  styles.amountBox,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: valid || amountText === "" ? theme.border : theme.danger,
                  },
                ]}
              >
                <Text style={[styles.currency, { color: theme.muted }]}>
                  {currencySymbol(getCurrency())}
                </Text>
                <TextInput
                  style={[styles.amountInput, { color: theme.text }]}
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="numbers-and-punctuation"
                  inputMode="decimal"
                  textAlign="right"
                />
              </View>
            </View>

        <View style={styles.chipRow}>
          <Pressable
            onPress={() => setPickingCategory(true)}
            style={[styles.chip, { backgroundColor: `${meta.tint}26` }]}
            accessibilityLabel={`Tag ${meta.label}, tap to change`}
          >
            <Text style={styles.chipEmoji}>{meta.emoji}</Text>
            <Text style={[styles.chipLabel, { color: theme.text }]}>{meta.label}</Text>
          </Pressable>
          {pockets.length > 0 && (
            <Pressable
              onPress={pickPocket}
              style={[styles.chip, { backgroundColor: `${theme.accent}1F` }]}
              accessibilityLabel={`Pocket ${pocketName}, tap to change`}
            >
              <Text style={styles.chipEmoji}>{pocketId === null ? "🪙" : "🎒"}</Text>
              <Text style={[styles.chipLabel, { color: theme.text }]}>{pocketName}</Text>
            </Pressable>
          )}
          <Pressable onPress={pickDate} style={[styles.chip, { backgroundColor: `${theme.accent}1F` }]}>
            <Text style={styles.chipEmoji}>📅</Text>
            <Text style={[styles.chipLabel, { color: theme.text }]}>
              {friendlyDay(date, localToday())}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setKind((k) => (k === "debit" ? "credit" : "debit"));
            }}
            style={[
              styles.chip,
              { backgroundColor: kind === "credit" ? `${theme.credit}26` : `${theme.danger}14` },
            ]}
            accessibilityLabel={`${kind === "credit" ? "Received" : "Spent"}, tap to switch`}
          >
            <Text style={[styles.chipLabel, { color: theme.text }]}>
              {kind === "credit" ? "↗ Received" : "↘ Spent"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.cancel}>
            <Text style={[styles.cancelLabel, { color: theme.muted }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={!valid}
            style={({ pressed }) => [
              styles.save,
              {
                backgroundColor: valid
                  ? pressed
                    ? theme.accentPressed
                    : theme.accent
                  : theme.border,
              },
            ]}
          >
            <Text style={[styles.saveLabel, { color: valid ? theme.onAccent : theme.muted }]}>
              Save
            </Text>
          </Pressable>
        </View>
      </View>

      <CategoryPicker
        theme={theme}
        visible={pickingCategory}
        categories={categories}
        onPick={(name) => {
          setCategory(name);
          setPickingCategory(false);
        }}
        onClose={() => setPickingCategory(false)}
      />

      <ActionSheet theme={theme} options={pocketSheet.options} onClose={pocketSheet.hide} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 14, gap: 14 },
  fieldRow: { flexDirection: "row", gap: 10 },
  descriptionInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "600",
  },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    width: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  currency: { fontSize: 14, fontWeight: "600" },
  amountInput: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 6,
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  // Emoji live in their own Text: Samsung's font stack can drop glyphs that
  // follow an emoji inside a single semibold text run.
  chipEmoji: { fontSize: 13 },
  chipLabel: { fontSize: 13, fontWeight: "600" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
    marginTop: 4,
  },
  cancel: { paddingVertical: 8, paddingHorizontal: 4 },
  cancelLabel: { fontSize: 14, fontWeight: "600" },
  save: { borderRadius: 20, paddingVertical: 11, paddingHorizontal: 28 },
  saveLabel: { fontSize: 14, fontWeight: "700" },
});
