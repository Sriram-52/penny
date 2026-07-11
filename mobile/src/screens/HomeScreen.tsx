import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryBreakdown } from "../components/CategoryBreakdown";
import { ConfirmCards } from "../components/ConfirmCards";
import { EntryBar } from "../components/EntryBar";
import { ExpenseEditSheet } from "../components/ExpenseEditSheet";
import { ExpenseRow } from "../components/ExpenseRow";
import { MonthPicker } from "../components/MonthPicker";
import { PocketNameModal } from "../components/PocketNameModal";
import {
  alignExpenseCurrency,
  createPocket,
  getCurrency,
  getSetting,
  removeExpense,
  useCategories,
  useExpenses,
  usePockets,
  type ExpenseRecord,
} from "../db";
import { animate, useExpenseEntry } from "../hooks/useExpenseEntry";
import { entryExample, fullExample } from "../lib/examples";
import { formatMoney, friendlyDay, localToday } from "../lib/format";
import type { RootStackParamList } from "../nav";
import { useTheme } from "../theme";

const RECENT_COUNT = 7;

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: rows } = useExpenses();
  const { data: pocketRows } = usePockets();
  const { data: categoryRows } = useCategories();
  const pockets = pocketRows ?? [];
  const categories = categoryRows ?? [];

  const entry = useExpenseEntry(null);
  const [creatingPocket, setCreatingPocket] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);

  const today = localToday();
  const now = new Date();
  const viewedMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const monthPrefix = `${viewedMonth.getFullYear()}-${String(viewedMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = viewedMonth.toLocaleDateString(undefined, {
    month: "long",
    ...(viewedMonth.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });

  // Trip mode: reopen inside the pocket she was last using.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const last = getSetting("lastPocket");
    if (last) {
      navigation.navigate("Pocket", { pocketId: last === "__everyday__" ? null : last });
    }
  }, [navigation]);

  const monthRows = useMemo(
    () => (rows ?? []).filter((r) => r.date.startsWith(monthPrefix)),
    [rows, monthPrefix],
  );
  const currency = getCurrency();
  const monthsWithData = useMemo(
    () => new Set((rows ?? []).map((r) => r.date.slice(0, 7))),
    [rows],
  );

  // Self-heal rows written under a different currency (single-currency app).
  useEffect(() => {
    if (getSetting("currency") && (rows ?? []).some((r) => r.currency !== currency)) {
      void alignExpenseCurrency(currency);
    }
  }, [rows, currency]);
  const monthSpent = monthRows
    .filter((r) => r.kind !== "credit")
    .reduce((sum, r) => sum + r.amount, 0);
  const monthReceived = monthRows
    .filter((r) => r.kind === "credit")
    .reduce((sum, r) => sum + r.amount, 0);

  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of monthRows) {
      if (r.kind === "credit") continue;
      totals.set(r.category, (totals.get(r.category) ?? 0) + r.amount);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [monthRows]);

  // Current month acts as the hub (every pocket, lifetime trip totals); past
  // months are a strict snapshot of that month's activity.
  const allTimePocketTotals = useMemo(() => {
    const totals = new Map<string | null, number>();
    for (const r of rows ?? []) {
      if (r.kind === "credit") continue;
      const key = r.pocketId ?? null;
      totals.set(key, (totals.get(key) ?? 0) + r.amount);
    }
    return totals;
  }, [rows]);
  const monthPocketTotals = useMemo(() => {
    const totals = new Map<string | null, number>();
    for (const r of monthRows) {
      if (r.kind === "credit") continue;
      const key = r.pocketId ?? null;
      totals.set(key, (totals.get(key) ?? 0) + r.amount);
    }
    return totals;
  }, [monthRows]);
  const visiblePockets =
    monthOffset === 0
      ? pockets
      : pockets.filter((p) => monthRows.some((r) => r.pocketId === p.id));
  const everydayTotal = monthPocketTotals.get(null) ?? 0;
  const showEverydayRow = monthOffset === 0 || monthRows.some((r) => r.pocketId === null);

  // The partner line: only speaks when she tracks income, warm when ahead,
  // matter-of-fact (never scolding) when not.
  const net = monthReceived - monthSpent;
  const pulse = useMemo(() => {
    if (monthReceived <= 0) return null;
    if (net >= 0) {
      return {
        text:
          monthOffset === 0
            ? `You're ${formatMoney(net, currency)} ahead this month 🌱`
            : `${formatMoney(net, currency)} saved in ${monthLabel} 🌱`,
        good: true,
      };
    }
    return {
      text:
        monthOffset === 0
          ? `${formatMoney(-net, currency)} more out than in so far`
          : `${formatMoney(-net, currency)} more out than in`,
      good: false,
    };
  }, [monthReceived, net, monthOffset, currency, monthLabel]);

  // Current month shows a short "recent" feed; older months show everything.
  const listRows = monthOffset === 0 ? (rows ?? []).slice(0, RECENT_COUNT) : monthRows;
  const listTitle = monthOffset === 0 ? "RECENT" : `IN ${monthLabel.toUpperCase()}`;
  const pocketName = (id: string | null) =>
    id === null ? undefined : pockets.find((p) => p.id === id)?.name;
  const rowDetail = (item: ExpenseRecord) => {
    const pocket = pocketName(item.pocketId ?? null);
    if (monthOffset === 0) return pocket;
    const day = friendlyDay(item.date, today);
    return pocket ? `${day} · ${pocket}` : day;
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
      <StatusBar style="auto" />
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.monthNav}>
                <Pressable
                  onPress={() => setMonthOffset((o) => o + 1)}
                  hitSlop={10}
                  accessibilityLabel="Previous month"
                >
                  <Text style={[styles.monthChevron, { color: theme.muted }]}>‹</Text>
                </Pressable>
                <Pressable onPress={() => setMonthPickerVisible(true)} hitSlop={6}>
                  <Text style={[styles.eyebrow, { color: theme.muted }]}>
                    {monthLabel.toUpperCase()} · ALL POCKETS
                  </Text>
                </Pressable>
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
              <Text style={[styles.total, { color: theme.text }]}>
                {formatMoney(monthSpent, currency)}
              </Text>
              {monthReceived > 0 && (
                <Text style={[styles.received, { color: theme.credit }]}>
                  +{formatMoney(monthReceived, currency)} received
                </Text>
              )}
              {pulse && (
                <Text style={[styles.pulse, { color: pulse.good ? theme.credit : theme.muted }]}>
                  {pulse.text}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => navigation.navigate("Settings")}
              hitSlop={8}
              style={[styles.memoryButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              accessibilityLabel="Settings"
            >
              <Text style={{ fontSize: 16 }}>✨</Text>
            </Pressable>
          </View>

          {byCategory.length > 0 && (
            <View style={styles.section}>
              <Pressable
                onPress={() => navigation.navigate("Insights")}
                style={styles.sectionHeaderRow}
                hitSlop={6}
              >
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>WHERE IT WENT</Text>
                <Text style={[styles.seeTrends, { color: theme.accent }]}>See trends ›</Text>
              </Pressable>
              <CategoryBreakdown
                theme={theme}
                categories={categories}
                byCategory={byCategory}
                currency={currency}
              />
            </View>
          )}

          {(showEverydayRow || visiblePockets.length > 0) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.muted }]}>POCKETS</Text>
              <View style={[styles.cardBlock, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {showEverydayRow && (
                  <PocketRow
                    theme={theme}
                    emoji="🪙"
                    name="Everyday"
                    detail={monthOffset === 0 ? "this month" : `in ${monthLabel}`}
                    total={formatMoney(everydayTotal, currency)}
                    onPress={() => navigation.navigate("Pocket", { pocketId: null })}
                  />
                )}
                {visiblePockets.map((pocket) => {
                  const total =
                    monthOffset === 0
                      ? allTimePocketTotals.get(pocket.id) ?? 0
                      : monthPocketTotals.get(pocket.id) ?? 0;
                  return (
                    <PocketRow
                      key={pocket.id}
                      theme={theme}
                      emoji="🎒"
                      name={pocket.name}
                      detail={
                        pocket.eventDate
                          ? friendlyDay(pocket.eventDate, today)
                          : monthOffset === 0
                            ? "all time"
                            : `in ${monthLabel}`
                      }
                      total={total > 0 ? formatMoney(total, currency) : null}
                      onPress={() => navigation.navigate("Pocket", { pocketId: pocket.id })}
                    />
                  );
                })}
                {monthOffset === 0 && (
                  <Pressable
                    onPress={() => setCreatingPocket(true)}
                    android_ripple={{ color: theme.ripple }}
                    style={styles.newPocketRow}
                  >
                    <Text style={[styles.newPocketLabel, { color: theme.accent }]}>+ New pocket</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {listRows.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.muted }]}>{listTitle}</Text>
              {listRows.map((item) => (
                <ExpenseRow
                  key={item.id}
                  theme={theme}
                  item={item}
                  categories={categories}
                  pocketName={rowDetail(item)}
                  onPress={setEditingExpense}
                  onDelete={onDeleteExpense}
                />
              ))}
            </View>
          )}
          {monthOffset > 0 && listRows.length === 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.muted }]}>{listTitle}</Text>
              <Text style={[styles.emptyMonth, { color: theme.muted }]}>
                Nothing recorded in {monthLabel}.
              </Text>
            </View>
          )}

          {(rows ?? []).length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🪙</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Penny's ready</Text>
              <Text style={[styles.emptyBody, { color: theme.muted }]}>
                Type an expense like you'd text a friend:{"\n"}"{fullExample(currency)}"
              </Text>
            </View>
          )}
        </ScrollView>

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
            placeholder={`${entryExample(currency)}…`}
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

      <MonthPicker
        theme={theme}
        visible={monthPickerVisible}
        monthsWithData={monthsWithData}
        viewedYear={viewedMonth.getFullYear()}
        viewedMonth={viewedMonth.getMonth() + 1}
        onPick={(year, month) => {
          setMonthOffset((now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month));
          setMonthPickerVisible(false);
        }}
        onClose={() => setMonthPickerVisible(false)}
      />

      <PocketNameModal
        theme={theme}
        visible={creatingPocket}
        title="New pocket"
        onSubmit={async (name, eventDate) => {
          const id = await createPocket(name, eventDate);
          setCreatingPocket(false);
          navigation.navigate("Pocket", { pocketId: id });
        }}
        onCancel={() => setCreatingPocket(false)}
      />
    </View>
  );
}

function PocketRow({
  theme,
  emoji,
  name,
  detail,
  total,
  onPress,
}: {
  theme: ReturnType<typeof useTheme>;
  emoji: string;
  name: string;
  detail: string;
  total: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: theme.ripple }} style={styles.pocketRow}>
      <Text style={styles.pocketEmoji}>{emoji}</Text>
      <View style={styles.pocketMiddle}>
        <Text style={[styles.pocketName, { color: theme.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.pocketDetail, { color: theme.muted }]}>{detail}</Text>
      </View>
      {total !== null && (
        <Text style={[styles.pocketTotal, { color: theme.text }]}>{total}</Text>
      )}
      <Text style={[styles.chevron, { color: theme.muted }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 24 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  headerText: { flex: 1, gap: 4 },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 10 },
  monthChevron: { fontSize: 22, fontWeight: "700", marginTop: -3 },
  received: { fontSize: 13, fontWeight: "700" },
  pulse: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  emptyMonth: { fontSize: 13, paddingHorizontal: 20 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1 },
  total: {
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  memoryButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingRight: 20,
  },
  seeTrends: { fontSize: 12, fontWeight: "700" },
  cardBlock: {
    marginHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingVertical: 4,
  },
  pocketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  pocketEmoji: { fontSize: 18 },
  pocketMiddle: { flex: 1, gap: 1 },
  pocketName: { fontSize: 15, fontWeight: "600" },
  pocketDetail: { fontSize: 12 },
  pocketTotal: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  chevron: { fontSize: 20, marginTop: -2 },
  newPocketRow: { paddingHorizontal: 16, paddingVertical: 12 },
  newPocketLabel: { fontSize: 14, fontWeight: "700" },
  empty: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 8,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 21 },
});
