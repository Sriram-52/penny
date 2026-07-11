import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionSheet, useActionSheet } from "../components/ActionSheet";
import { BudgetMeter } from "../components/BudgetMeter";
import { CategoryBreakdown } from "../components/CategoryBreakdown";
import { ConfirmCards } from "../components/ConfirmCards";
import { EntryBar } from "../components/EntryBar";
import { ExpenseEditSheet } from "../components/ExpenseEditSheet";
import { ExpenseRow } from "../components/ExpenseRow";
import { PocketNameModal } from "../components/PocketNameModal";
import {
  deletePocket,
  getCurrency,
  removeExpense,
  setSetting,
  updatePocket,
  useCategories,
  useExpenses,
  usePockets,
  type ExpenseRecord,
} from "../db";
import { animate, useExpenseEntry } from "../hooks/useExpenseEntry";
import { entryExample } from "../lib/examples";
import { formatMoney, friendlyDay, localToday } from "../lib/format";
import type { RootStackParamList } from "../nav";
import { useTheme } from "../theme";

interface DaySection {
  title: string;
  total: string;
  data: ExpenseRecord[];
}

type Props = NativeStackScreenProps<RootStackParamList, "Pocket">;

export function PocketScreen({ route, navigation }: Props) {
  const { pocketId } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: rows } = useExpenses();
  const { data: pocketRows, updatedAt: pocketsLoadedAt } = usePockets();
  const { data: categoryRows } = useCategories();
  const pockets = pocketRows ?? [];
  const categories = categoryRows ?? [];

  const pocket = pocketId === null ? null : pockets.find((p) => p.id === pocketId);
  const entry = useExpenseEntry(pocketId);
  const [editing, setEditing] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  // Everyday is browsed month by month; trip pockets are one bounded event.
  const [monthOffset, setMonthOffset] = useState(0);
  const sheet = useActionSheet();

  const today = localToday();
  const now = new Date();
  const viewedMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const monthPrefix = `${viewedMonth.getFullYear()}-${String(viewedMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = viewedMonth.toLocaleDateString(undefined, {
    month: "long",
    ...(viewedMonth.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });

  // Trip mode: remember where she is so a cold start reopens here.
  useEffect(() => {
    setSetting("lastPocket", pocketId ?? "__everyday__");
    return () => setSetting("lastPocket", null);
  }, [pocketId]);

  // Pocket got deleted (possibly from another screen) - nothing to show.
  // Only trust the check once the live query has actually delivered; its
  // initial value is an empty array, which would false-positive here.
  useEffect(() => {
    if (pocketId !== null && pocketsLoadedAt && !pocket) {
      navigation.goBack();
    }
  }, [pocketId, pocketsLoadedAt, pocket, navigation]);

  const visibleRows = useMemo(() => {
    const inPocket = (rows ?? []).filter((r) => (r.pocketId ?? null) === pocketId);
    return pocketId === null ? inPocket.filter((r) => r.date.startsWith(monthPrefix)) : inPocket;
  }, [rows, pocketId, monthPrefix]);
  const currency = getCurrency();
  const spentAmount = useMemo(
    () => visibleRows.filter((r) => r.kind !== "credit").reduce((sum, r) => sum + r.amount, 0),
    [visibleRows],
  );

  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of visibleRows) {
      if (r.kind === "credit") continue;
      totals.set(r.category, (totals.get(r.category) ?? 0) + r.amount);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [visibleRows]);

  const sections = useMemo<DaySection[]>(() => {
    const byDate = new Map<string, ExpenseRecord[]>();
    for (const row of visibleRows) {
      const list = byDate.get(row.date) ?? [];
      list.push(row);
      byDate.set(row.date, list);
    }
    return [...byDate.entries()].map(([date, data]) => ({
      title: friendlyDay(date, today),
      total: formatMoney(
        data.filter((r) => r.kind !== "credit").reduce((sum, r) => sum + r.amount, 0),
        currency,
      ),
      data,
    }));
  }, [visibleRows, today, currency]);

  const headerEyebrow = pocket
    ? `${pocket.name.toUpperCase()}${
        pocket.eventDate ? ` · ${friendlyDay(pocket.eventDate, today).toUpperCase()}` : ""
      }`
    : `${monthLabel.toUpperCase()} · EVERYDAY`;
  const headerTotal = useMemo(
    () =>
      formatMoney(
        visibleRows.filter((r) => r.kind !== "credit").reduce((sum, r) => sum + r.amount, 0),
        currency,
      ),
    [visibleRows, currency],
  );

  const onPocketActions = () => {
    if (!pocket) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sheet.show({
      title: `🎒 ${pocket.name}`,
      actions: [
        { label: "Edit name, date & budget", onPress: () => setEditing(true) },
        {
          label: "Delete pocket",
          destructive: true,
          onPress: () =>
            Alert.alert(
              `Delete ${pocket.name}?`,
              "Its expenses stay saved and move to Everyday.",
              [
                { text: "Keep", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    await deletePocket(pocket.id);
                    navigation.goBack();
                  },
                },
              ],
            ),
        },
      ],
    });
  };

  const onDeleteExpense = (item: ExpenseRecord) => {
    Alert.alert(
      "Delete expense?",
      `${item.description} · ${formatMoney(item.amount, item.currency)}`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            animate();
            await removeExpense(item.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            accessibilityLabel="Back to home"
          >
            <Text style={[styles.backIcon, { color: theme.text }]}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            {pocket ? (
              <Text style={[styles.eyebrow, { color: theme.muted }]} numberOfLines={1}>
                {headerEyebrow}
              </Text>
            ) : (
              <View style={styles.monthNav}>
                <Pressable
                  onPress={() => setMonthOffset((o) => o + 1)}
                  hitSlop={10}
                  accessibilityLabel="Previous month"
                >
                  <Text style={[styles.monthChevron, { color: theme.muted }]}>‹</Text>
                </Pressable>
                <Text style={[styles.eyebrow, { color: theme.muted }]} numberOfLines={1}>
                  {headerEyebrow}
                </Text>
                <Pressable
                  onPress={() => setMonthOffset((o) => Math.max(0, o - 1))}
                  disabled={monthOffset === 0}
                  hitSlop={10}
                  accessibilityLabel="Next month"
                >
                  <Text
                    style={[
                      styles.monthChevron,
                      { color: monthOffset === 0 ? theme.border : theme.muted },
                    ]}
                  >
                    ›
                  </Text>
                </Pressable>
              </View>
            )}
            <Text style={[styles.total, { color: theme.text }]}>{headerTotal}</Text>
          </View>
          {pocket && (
            <Pressable
              onPress={onPocketActions}
              hitSlop={10}
              style={[styles.moreButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              accessibilityLabel="Pocket options"
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>⋯</Text>
            </Pressable>
          )}
        </View>

        <SectionList
          sections={sections}
          ListHeaderComponent={
            <>
              {pocket?.target != null && (
                <View style={styles.breakdownWrap}>
                  <BudgetMeter
                    theme={theme}
                    label="Trip budget"
                    spent={spentAmount}
                    budget={pocket.target}
                    currency={currency}
                  />
                </View>
              )}
              {byCategory.length > 1 ? (
                <View style={styles.breakdownWrap}>
                  <CategoryBreakdown
                    theme={theme}
                    categories={categories}
                    byCategory={byCategory}
                    currency={currency}
                  />
                </View>
              ) : null}
            </>
          }
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ExpenseRow
              theme={theme}
              item={item}
              categories={categories}
              onPress={setEditingExpense}
              onDelete={onDeleteExpense}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
              <Text style={[styles.sectionTitle, { color: theme.muted }]}>{section.title}</Text>
              <Text style={[styles.sectionTotal, { color: theme.muted }]}>{section.total}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{pocket ? "🎒" : "🪙"}</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {pocket ? `${pocket.name} is empty` : "Nothing here yet"}
              </Text>
              <Text style={[styles.emptyBody, { color: theme.muted }]}>
                Anything you type below lands {pocket ? "in this pocket" : "in Everyday"}.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
        />

        {entry.drafts && (
          <ConfirmCards
            theme={theme}
            drafts={entry.drafts}
            pockets={pockets}
            categories={categories}
            saving={entry.saving}
            onChange={entry.onChangeDraft}
            onRemove={entry.onRemoveDraft}
            onSave={entry.onSave}
            onDiscard={entry.onDiscard}
          />
        )}

        <View style={{ paddingBottom: Math.max(insets.bottom, 10), backgroundColor: theme.bg }}>
          <EntryBar
            theme={theme}
            value={entry.input}
            busy={entry.busy}
            kind={entry.entryKind}
            onToggleKind={entry.toggleEntryKind}
            placeholder={
              pocket ? `add to ${pocket.name}…` : `${entryExample(getCurrency())}…`
            }
            onChange={entry.setInput}
            onSubmit={entry.onSubmit}
          />
        </View>
      </KeyboardAvoidingView>

      <ExpenseEditSheet
        theme={theme}
        expense={editingExpense}
        categories={categories}
        pockets={pockets}
        onClose={() => setEditingExpense(null)}
      />

      <ActionSheet theme={theme} options={sheet.options} onClose={sheet.hide} />

      {pocket && (
        <PocketNameModal
          theme={theme}
          visible={editing}
          title="Edit pocket"
          initialName={pocket.name}
          initialDate={pocket.eventDate}
          initialTarget={pocket.target}
          onSubmit={async (name, eventDate, target) => {
            await updatePocket(pocket.id, { name, eventDate, target });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: 24, fontWeight: "600", marginTop: -3 },
  headerText: { flex: 1, gap: 2 },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthChevron: { fontSize: 20, fontWeight: "700", marginTop: -3 },
  breakdownWrap: { paddingTop: 10 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  total: { fontSize: 26, fontWeight: "800", letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  moreButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { paddingBottom: 24, flexGrow: 1 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700" },
  sectionTotal: { fontSize: 13, fontVariant: ["tabular-nums"] },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 21 },
});
