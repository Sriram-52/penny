import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Alert, LayoutAnimation } from "react-native";

import type { Draft } from "../components/ConfirmCards";
import { draftAmountValid } from "../components/ConfirmCards";
import { addRule, getCurrency, saveExpenses, useCategories, useRules } from "../db";
import { parseNote } from "../lib/parseClient";
import type { ParsedExpense } from "../types";

export const animate = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

// Entry box → parse → confirm drafts → save. Shared by Home and Pocket screens;
// `defaultPocketId` decides where parsed expenses land (null = Everyday).
export function useExpenseEntry(defaultPocketId: string | null) {
  const { data: ruleRows } = useRules();
  const { data: categoryRows } = useCategories();
  const rules = ruleRows ?? [];
  const categoryNames = (categoryRows ?? []).map((c) => c.name);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [saving, setSaving] = useState(false);
  // Chosen explicitly via the entry-bar toggle; never inferred by the parser.
  const [entryKind, setEntryKind] = useState<"debit" | "credit">("debit");

  const onSubmit = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const result = await parseNote(
        text,
        rules.map((r) => ({ pattern: r.pattern, category: r.category })),
        categoryNames,
        getCurrency(),
        entryKind === "credit",
      );
      if (result.expenses.length === 0) {
        Alert.alert("Nothing to add", "Penny couldn't find an expense in that note.");
        return;
      }
      animate();
      setDrafts(
        result.expenses.map((e, i) => ({
          key: `${Date.now()}-${i}`,
          amountText: String(e.amount),
          kind: entryKind,
          currency: e.currency,
          description: e.description,
          category: e.category,
          originalCategory: e.category,
          date: e.date,
          confidence: e.confidence,
          pocketId: defaultPocketId,
        })),
      );
      setInput("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert(
        "Can't reach the parser",
        "Check that the parser server is running and the app's parse URL is right. Your note is still in the box.",
      );
    } finally {
      setBusy(false);
    }
  };

  const onChangeDraft = (key: string, patch: Partial<Draft>) => {
    setDrafts((prev) => prev?.map((d) => (d.key === key ? { ...d, ...patch } : d)) ?? null);
  };

  const onRemoveDraft = (key: string) => {
    animate();
    setDrafts((prev) => {
      const next = prev?.filter((d) => d.key !== key) ?? null;
      return next && next.length > 0 ? next : null;
    });
  };

  const onDiscard = () => {
    animate();
    setDrafts(null);
  };

  const onSave = async () => {
    if (!drafts || drafts.some((d) => !draftAmountValid(d))) return;
    setSaving(true);
    try {
      const items: Array<ParsedExpense & { pocketId: string | null }> = drafts.map((d) => ({
        amount: Math.abs(Number(d.amountText)),
        kind: d.kind,
        currency: d.currency,
        description: d.description.trim() || "Expense",
        category: d.category,
        date: d.date,
        confidence: d.confidence,
        pocketId: d.pocketId,
      }));
      await saveExpenses(items);
      // Corrections become rules: next time Penny categorizes this herself.
      for (const d of drafts) {
        if (d.category !== d.originalCategory && d.description.trim()) {
          await addRule(d.description, d.category);
        }
      }
      animate();
      setDrafts(null);
      // Spending is the norm; received mode is a one-shot choice.
      setEntryKind("debit");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Couldn't save", "Something went wrong writing to the database. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return {
    input,
    setInput,
    busy,
    drafts,
    saving,
    entryKind,
    toggleEntryKind: () => {
      Haptics.selectionAsync();
      setEntryKind((k) => (k === "debit" ? "credit" : "debit"));
    },
    onSubmit,
    onChangeDraft,
    onRemoveDraft,
    onDiscard,
    onSave,
  };
}
