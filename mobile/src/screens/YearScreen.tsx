import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConfirmCards } from "../components/ConfirmCards";
import { EntryBar } from "../components/EntryBar";
import { YearPicker } from "../components/YearPicker";
import { getCurrency, getSetting, useCategories, useExpenses, usePockets } from "../db";
import { useExpenseEntry } from "../hooks/useExpenseEntry";
import { entryExample, fullExample } from "../lib/examples";
import { formatMoney, localToday } from "../lib/format";
import { useTheme } from "../theme";

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" }),
);

// Trip mode reopens the last pocket once per cold start — a module flag keeps
// it from firing again when the Home tab remounts on tab switches.
let tripRestored = false;

export function YearScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: rows } = useExpenses();
  const { data: pocketRows } = usePockets();
  const { data: categoryRows } = useCategories();
  const pockets = pocketRows ?? [];
  const categories = categoryRows ?? [];
  const currency = getCurrency();
  const expenses = rows ?? [];

  // New entries from the year view land on today (Everyday); adding inside a
  // specific month is done from that month's screen.
  const entry = useExpenseEntry(null, localToday());

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based

  // Reopen the pocket she was last using (trip mode), once per launch.
  useEffect(() => {
    if (tripRestored) return;
    tripRestored = true;
    const last = getSetting("lastPocket");
    if (last) {
      router.push({ pathname: "/pocket/[id]", params: { id: last === "__everyday__" ? "everyday" : last } });
    }
  }, [router]);

  // Spent (debit) and received (credit) totals per "YYYY-MM".
  const byMonth = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    for (const r of expenses) {
      const key = r.date.slice(0, 7);
      const cell = map.get(key) ?? { debit: 0, credit: 0 };
      if (r.kind === "credit") cell.credit += r.amount;
      else cell.debit += r.amount;
      map.set(key, cell);
    }
    return map;
  }, [expenses]);

  // Page freely into the past; never into the future (nothing to show there).
  const MIN_YEAR = 2000;
  const [year, setYear] = useState(currentYear);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const stepYear = (delta: number) =>
    setYear((y) => Math.min(currentYear, Math.max(MIN_YEAR, y + delta)));

  const yearsWithData = useMemo(
    () => new Set(expenses.map((r) => Number(r.date.slice(0, 4)))),
    [expenses],
  );

  // Horizontal swipe flips the year (swipe right → previous, left → next).
  // activeOffset thresholds let vertical scrolling and taps pass through.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 50) stepYear(-1);
        else if (g.dx < -50) stepYear(1);
      },
    }),
  ).current;

  // Blocks to show: Jan → this month for the current year, all 12 for past
  // years. Most recent month first.
  const monthsForYear = useMemo(() => {
    const last = year === currentYear ? currentMonth : 12;
    const out: Array<{ key: string; month: number }> = [];
    for (let m = last; m >= 1; m--) {
      out.push({ key: `${year}-${String(m).padStart(2, "0")}`, month: m });
    }
    return out;
  }, [year, currentYear, currentMonth]);

  const yearTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const { key } of monthsForYear) {
      const cell = byMonth.get(key);
      if (!cell) continue;
      debit += cell.debit;
      credit += cell.credit;
    }
    return { debit, credit };
  }, [monthsForYear, byMonth]);

  const hasData = expenses.length > 0;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <View style={styles.yearRow}>
          <Pressable
            onPress={() => stepYear(-1)}
            disabled={year <= MIN_YEAR}
            hitSlop={12}
            accessibilityLabel="Previous year"
          >
            <Text style={[styles.yearChevron, { color: year <= MIN_YEAR ? theme.border : theme.muted }]}>
              ‹
            </Text>
          </Pressable>
          <Pressable style={styles.yearCenter} onPress={() => setYearPickerVisible(true)} hitSlop={8}>
            <Text style={[styles.year, { color: theme.text }]}>{year}</Text>
            {hasData && (
              <Text style={[styles.yearSub, { color: theme.muted }]}>
                {formatMoney(yearTotals.debit, currency)} spent
                {yearTotals.credit > 0 ? ` · ${formatMoney(yearTotals.credit, currency)} in` : ""}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => stepYear(1)}
            disabled={year >= currentYear}
            hitSlop={12}
            accessibilityLabel="Next year"
          >
            <Text style={[styles.yearChevron, { color: year >= currentYear ? theme.border : theme.muted }]}>
              ›
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          {...pan.panHandlers}
        >
          {!hasData ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🪙</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Penny's ready</Text>
              <Text style={[styles.emptyBody, { color: theme.muted }]}>
                Type an expense like you'd text a friend:{"\n"}"{fullExample(currency)}"
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {monthsForYear.map(({ key, month }) => {
                const cell = byMonth.get(key) ?? { debit: 0, credit: 0 };
                const isCurrent = year === currentYear && month === currentMonth;
                const isEmpty = cell.debit === 0 && cell.credit === 0;
                return (
                  <Pressable
                    key={key}
                    onPress={() => router.push({ pathname: "/month/[key]", params: { key } })}
                    android_ripple={{ color: theme.ripple }}
                    style={[
                      styles.monthCard,
                      { backgroundColor: theme.card, borderColor: isCurrent ? theme.accent : theme.border },
                    ]}
                    accessibilityLabel={`${MONTH_NAMES[month - 1]} ${year}, view expenses`}
                  >
                    <Text style={[styles.monthName, { color: theme.text }]}>{MONTH_NAMES[month - 1]}</Text>
                    {isEmpty ? (
                      <Text style={[styles.monthEmpty, { color: theme.muted }]}>No activity</Text>
                    ) : (
                      <View style={styles.monthTotals}>
                        <View style={[styles.totalLine, { backgroundColor: `${theme.danger}14` }]}>
                          <Text style={[styles.arrow, { color: theme.danger }]}>↓</Text>
                          <Text style={[styles.totalValue, { color: theme.text }]}>
                            {formatMoney(cell.debit, currency)}
                          </Text>
                          <Text style={[styles.totalTag, { color: theme.muted }]}>spent</Text>
                        </View>
                        <View
                          style={[
                            styles.totalLine,
                            { backgroundColor: cell.credit > 0 ? `${theme.credit}1F` : "transparent" },
                          ]}
                        >
                          <Text style={[styles.arrow, { color: cell.credit > 0 ? theme.credit : theme.muted }]}>
                            ↑
                          </Text>
                          <Text
                            style={[
                              styles.totalValue,
                              { color: cell.credit > 0 ? theme.credit : theme.muted },
                            ]}
                          >
                            {formatMoney(cell.credit, currency)}
                          </Text>
                          <Text style={[styles.totalTag, { color: theme.muted }]}>in</Text>
                        </View>
                      </View>
                    )}
                    <Text style={[styles.monthHint, { color: theme.muted }]}>View ›</Text>
                  </Pressable>
                );
              })}
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

      <YearPicker
        theme={theme}
        visible={yearPickerVisible}
        yearsWithData={yearsWithData}
        selectedYear={year}
        minYear={MIN_YEAR}
        maxYear={currentYear}
        onPick={(y) => {
          setYear(y);
          setYearPickerVisible(false);
        }}
        onClose={() => setYearPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 24, flexGrow: 1 },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    paddingTop: 14,
    paddingBottom: 6,
  },
  yearCenter: { alignItems: "center", gap: 2, minWidth: 190 },
  year: { fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums"] },
  yearSub: { fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  yearChevron: { fontSize: 30, fontWeight: "700", marginTop: -4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  monthCard: {
    width: "48%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  monthName: { fontSize: 15, fontWeight: "700" },
  monthTotals: { gap: 6 },
  totalLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  arrow: { fontSize: 13, fontWeight: "800", width: 12 },
  totalValue: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  totalTag: { fontSize: 11, fontWeight: "600" },
  monthEmpty: { fontSize: 13, paddingVertical: 8 },
  monthHint: { fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", paddingHorizontal: 40, paddingTop: 80, gap: 8 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 21 },
});
