import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { CategoryRecord, PocketRecord } from "../db";
import { getCategoryMeta } from "../lib/categories";
import { currencySymbol, friendlyDay, localToday } from "../lib/format";
import type { Theme } from "../theme";
import type { Category } from "../types";
import { ActionSheet, useActionSheet } from "./ActionSheet";
import { CategoryPicker } from "./CategoryPicker";

export interface Draft {
  key: string;
  amountText: string;
  kind: "debit" | "credit";
  currency: string;
  description: string;
  category: Category;
  // What the parser suggested, before any user correction - used for learning.
  originalCategory: Category;
  date: string;
  confidence: "high" | "low";
  pocketId: string | null;
}

export function draftAmountValid(draft: Draft): boolean {
  const n = Number(draft.amountText);
  return Number.isFinite(n) && n !== 0;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  theme: Theme;
  drafts: Draft[];
  pockets: PocketRecord[];
  categories: CategoryRecord[];
  saving: boolean;
  onChange: (key: string, patch: Partial<Draft>) => void;
  onRemove: (key: string) => void;
  onSave: () => void;
  onDiscard: () => void;
}

export function ConfirmCards({
  theme,
  drafts,
  pockets,
  categories,
  saving,
  onChange,
  onRemove,
  onSave,
  onDiscard,
}: Props) {
  const today = localToday();
  const allValid = drafts.length > 0 && drafts.every(draftAmountValid);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const pocketSheet = useActionSheet();

  const pickPocket = (draft: Draft) => {
    Haptics.selectionAsync();
    pocketSheet.show({
      title: "Which pocket?",
      actions: [
        { label: "🪙 Everyday", onPress: () => onChange(draft.key, { pocketId: null }) },
        ...pockets.map((p) => ({
          label: `🎒 ${p.name}`,
          onPress: () => onChange(draft.key, { pocketId: p.id }),
        })),
      ],
    });
  };

  const pocketLabel = (pocketId: string | null) =>
    pocketId === null ? "🪙 Everyday" : `🎒 ${pockets.find((p) => p.id === pocketId)?.name ?? "?"}`;

  const pickDate = (draft: Draft) => {
    if (Platform.OS !== "android") return;
    Haptics.selectionAsync();
    DateTimePickerAndroid.open({
      value: new Date(`${draft.date}T12:00:00`),
      mode: "date",
      onValueChange: (_event, picked) => {
        if (picked) onChange(draft.key, { date: toDateString(picked) });
      },
    });
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {drafts.length === 1 ? "Found 1 expense" : `Found ${drafts.length} expenses`}
        </Text>
        <Text style={[styles.hint, { color: theme.muted }]}>tap a category to change it</Text>
      </View>

      {drafts.map((draft) => {
        const meta = getCategoryMeta(draft.category, categories);
        const valid = draftAmountValid(draft);
        return (
          <View key={draft.key} style={[styles.row, { borderTopColor: theme.border }]}>
            <View style={styles.rowMain}>
              <TextInput
                style={[styles.description, { color: theme.text }]}
                value={draft.description}
                onChangeText={(description) => onChange(draft.key, { description })}
                placeholder="What was it?"
                placeholderTextColor={theme.muted}
              />
              <View style={styles.rowMeta}>
                <Pressable
                  onPress={() => setPickingFor(draft.key)}
                  style={[styles.chip, { backgroundColor: `${meta.tint}26` }]}
                  accessibilityLabel={`Category ${meta.label}, tap to change`}
                >
                  <Text style={[styles.chipLabel, { color: theme.text }]}>
                    {meta.emoji} {meta.label}
                  </Text>
                </Pressable>
                {pockets.length > 0 && (
                  <Pressable
                    onPress={() => pickPocket(draft)}
                    style={[styles.chip, { backgroundColor: `${theme.accent}1F` }]}
                    accessibilityLabel={`Pocket ${pocketLabel(draft.pocketId)}, tap to change`}
                  >
                    <Text style={[styles.chipLabel, { color: theme.text }]}>
                      {pocketLabel(draft.pocketId)}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => pickDate(draft)}
                  style={[styles.chip, { backgroundColor: `${theme.accent}1F` }]}
                  accessibilityLabel={`Date ${friendlyDay(draft.date, today)}, tap to change`}
                >
                  <Text style={[styles.chipLabel, { color: theme.text }]}>
                    📅 {friendlyDay(draft.date, today)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    onChange(draft.key, { kind: draft.kind === "debit" ? "credit" : "debit" });
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        draft.kind === "credit" ? `${theme.credit}26` : `${theme.danger}14`,
                    },
                  ]}
                  accessibilityLabel={`${draft.kind === "credit" ? "Received" : "Spent"}, tap to switch`}
                >
                  <Text style={[styles.chipLabel, { color: theme.text }]}>
                    {draft.kind === "credit" ? "↗ Received" : "↘ Spent"}
                  </Text>
                </Pressable>
                {draft.confidence === "low" && (
                  <Text style={[styles.date, { color: theme.warn }]}>· check me</Text>
                )}
              </View>
            </View>

            <View style={styles.amountBox}>
              <Text style={[styles.currency, { color: theme.muted }]}>
                {currencySymbol(draft.currency)}
              </Text>
              <TextInput
                style={[
                  styles.amount,
                  { color: theme.text, borderColor: valid ? "transparent" : theme.danger },
                ]}
                value={draft.amountText}
                onChangeText={(amountText) => onChange(draft.key, { amountText })}
                keyboardType="numbers-and-punctuation"
                inputMode="decimal"
                textAlign="right"
              />
            </View>

            <Pressable
              onPress={() => onRemove(draft.key)}
              hitSlop={10}
              style={styles.remove}
              accessibilityLabel="Remove this expense"
            >
              <Text style={{ color: theme.muted, fontSize: 17 }}>✕</Text>
            </Pressable>
          </View>
        );
      })}

      <View style={[styles.actions, { borderTopColor: theme.border }]}>
        <Pressable onPress={onDiscard} hitSlop={8} style={styles.discard} disabled={saving}>
          <Text style={[styles.discardLabel, { color: theme.muted }]}>Discard</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={!allValid || saving}
          style={({ pressed }) => [
            styles.save,
            {
              backgroundColor: allValid && !saving
                ? pressed
                  ? theme.accentPressed
                  : theme.accent
                : theme.border,
            },
          ]}
        >
          <Text
            style={[
              styles.saveLabel,
              { color: allValid && !saving ? theme.onAccent : theme.muted },
            ]}
          >
            {saving ? "Saving…" : drafts.length === 1 ? "Save expense" : `Save ${drafts.length} expenses`}
          </Text>
        </Pressable>
      </View>

      <CategoryPicker
        theme={theme}
        visible={pickingFor !== null}
        categories={categories}
        onPick={(name) => {
          if (pickingFor) onChange(pickingFor, { category: name });
          setPickingFor(null);
        }}
        onClose={() => setPickingFor(null)}
      />

      <ActionSheet theme={theme} options={pocketSheet.options} onClose={pocketSheet.hide} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: { fontSize: 15, fontWeight: "700" },
  hint: { fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  rowMain: { flex: 1, gap: 6 },
  description: { fontSize: 15, fontWeight: "600", padding: 0 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipLabel: { fontSize: 12, fontWeight: "600" },
  date: { fontSize: 12 },
  amountBox: { flexDirection: "row", alignItems: "center", gap: 3 },
  currency: { fontSize: 13, fontWeight: "600" },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    minWidth: 56,
    borderBottomWidth: 1,
    padding: 0,
    paddingBottom: 2,
  },
  remove: { padding: 4 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  discard: { paddingVertical: 10, paddingHorizontal: 4 },
  discardLabel: { fontSize: 14, fontWeight: "600" },
  save: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveLabel: { fontSize: 15, fontWeight: "700" },
});
