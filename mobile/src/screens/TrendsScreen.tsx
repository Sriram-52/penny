import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryBreakdown } from "../components/CategoryBreakdown";
import { getCurrency, useCategories, useExpenses } from "../db";
import { getCategoryMeta } from "../lib/categories";
import { formatMoney } from "../lib/format";
import { useTheme } from "../theme";

const RANGES = [
  { months: 3, label: "3M" },
  { months: 6, label: "6M" },
  { months: 12, label: "1Y" },
];

// Trailing `count` calendar months ending with the current month; oldest first.
function trailingMonths(count: number): Array<{ key: string; label: string }> {
  const now = new Date();
  const out: Array<{ key: string; label: string }> = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: d.toLocaleDateString(undefined, { month: "short" }) });
  }
  return out;
}

export function TrendsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: rows } = useExpenses();
  const { data: categoryRows } = useCategories();
  const categories = categoryRows ?? [];
  const currency = getCurrency();
  const expenses = rows ?? [];

  const [rangeMonths, setRangeMonths] = useState(3);
  const months = useMemo(() => trailingMonths(rangeMonths), [rangeMonths]);
  const rangeKeys = useMemo(() => new Set(months.map((m) => m.key)), [months]);

  // Spent (debit) and received (credit) per month across the range.
  const monthData = useMemo(() => {
    const totals = new Map<string, { debit: number; credit: number }>();
    for (const r of expenses) {
      const key = r.date.slice(0, 7);
      const cell = totals.get(key) ?? { debit: 0, credit: 0 };
      if (r.kind === "credit") cell.credit += r.amount;
      else cell.debit += r.amount;
      totals.set(key, cell);
    }
    return months.map((m) => ({ ...m, ...(totals.get(m.key) ?? { debit: 0, credit: 0 }) }));
  }, [expenses, months]);
  const maxVal = Math.max(1, ...monthData.flatMap((m) => [m.debit, m.credit]));
  const scrollable = months.length > 3;

  // Average monthly spend (over months that actually had spending) + this
  // month's pace, projected to month-end from days elapsed.
  const pace = useMemo(() => {
    const totalDebit = monthData.reduce((s, m) => s + m.debit, 0);
    const activeMonths = monthData.filter((m) => m.debit > 0).length;
    const avgPerMonth = activeMonths > 0 ? totalDebit / activeMonths : 0;
    const now = new Date();
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const thisMonth = monthData[monthData.length - 1]?.debit ?? 0;
    const projected = daysElapsed > 0 ? (thisMonth / daysElapsed) * daysInMonth : thisMonth;
    return { avgPerMonth, thisMonth, projected, daysElapsed, daysInMonth };
  }, [monthData]);

  // Top spend categories across the whole range.
  const topCategories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of expenses) {
      if (r.kind === "credit") continue;
      if (!rangeKeys.has(r.date.slice(0, 7))) continue;
      totals.set(r.category, (totals.get(r.category) ?? 0) + r.amount);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6) as Array<[string, number]>;
  }, [expenses, rangeKeys]);

  // This month vs last month, per category (debit only).
  const thisKey = months[months.length - 1]?.key ?? "";
  const lastKey = trailingMonths(rangeMonths + 1)[0]?.key ?? months[months.length - 2]?.key ?? "";
  const movers = useMemo(() => {
    const cur = new Map<string, number>();
    const prev = new Map<string, number>();
    const prevKey = months[months.length - 2]?.key ?? lastKey;
    for (const r of expenses) {
      if (r.kind === "credit") continue;
      const mk = r.date.slice(0, 7);
      if (mk === thisKey) cur.set(r.category, (cur.get(r.category) ?? 0) + r.amount);
      else if (mk === prevKey) prev.set(r.category, (prev.get(r.category) ?? 0) + r.amount);
    }
    const names = new Set([...cur.keys(), ...prev.keys()]);
    return [...names]
      .map((name) => {
        const now = cur.get(name) ?? 0;
        const before = prev.get(name) ?? 0;
        return { name, now, before, delta: now - before };
      })
      .filter((m) => m.now > 0 || m.before > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [expenses, thisKey, lastKey, months]);

  const hasData = expenses.length > 0;
  const rangeTitle = `LAST ${rangeMonths === 12 ? "12" : rangeMonths} MONTHS`;

  const renderBarGroup = (m: (typeof monthData)[number], i: number) => {
    const isCurrent = i === monthData.length - 1;
    const pair = [
      { value: m.debit, color: theme.accent },
      { value: m.credit, color: theme.credit },
    ];
    return (
      <View key={m.key} style={scrollable ? styles.barGroupFixed : styles.barGroup}>
        <View style={styles.pair}>
          {pair.map((b, j) => (
            <View key={j} style={styles.barCol}>
              <Text style={[styles.barValue, { color: theme.muted }]} numberOfLines={1}>
                {b.value > 0 ? formatMoney(b.value, currency) : ""}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${b.value > 0 ? Math.max((b.value / maxVal) * 100, 3) : 0}%`,
                      backgroundColor: b.color,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
        <Text
          style={[
            styles.barLabel,
            { color: isCurrent ? theme.text : theme.muted, fontWeight: isCurrent ? "700" : "500" },
          ]}
        >
          {m.label}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Trends</Text>
        {hasData && (
          <View style={styles.rangeRow}>
            {RANGES.map((r) => {
              const selected = r.months === rangeMonths;
              return (
                <Pressable
                  key={r.months}
                  onPress={() => setRangeMonths(r.months)}
                  style={[
                    styles.rangePill,
                    {
                      backgroundColor: selected ? theme.accent : theme.inputBg,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.rangeLabel, { color: selected ? theme.onAccent : theme.muted }]}>
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        {!hasData ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={[styles.emptyBody, { color: theme.muted }]}>
              Once you've logged a few expenses, your trends show up here.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>{rangeTitle}</Text>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                  <Text style={[styles.legendLabel, { color: theme.muted }]}>Spent</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: theme.credit }]} />
                  <Text style={[styles.legendLabel, { color: theme.muted }]}>Received</Text>
                </View>
              </View>
              {scrollable ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barsScroll}>
                  {monthData.map(renderBarGroup)}
                </ScrollView>
              ) : (
                <View style={styles.bars}>{monthData.map(renderBarGroup)}</View>
              )}
            </View>

            <Text style={[styles.sectionTitle, { color: theme.muted }]}>PACE</Text>
            <View style={[styles.card, styles.paceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.paceRow}>
                <View style={styles.paceItem}>
                  <Text style={[styles.paceValue, { color: theme.text }]}>
                    {formatMoney(Math.round(pace.avgPerMonth), currency)}
                  </Text>
                  <Text style={[styles.paceLabel, { color: theme.muted }]}>avg / month</Text>
                </View>
                <View style={[styles.paceDivider, { backgroundColor: theme.border }]} />
                <View style={styles.paceItem}>
                  <Text style={[styles.paceValue, { color: theme.text }]}>
                    {formatMoney(Math.round(pace.projected), currency)}
                  </Text>
                  <Text style={[styles.paceLabel, { color: theme.muted }]}>this month, projected</Text>
                </View>
              </View>
              <Text style={[styles.paceNote, { color: theme.muted }]}>
                {formatMoney(pace.thisMonth, currency)} spent so far · day {pace.daysElapsed} of{" "}
                {pace.daysInMonth}
              </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.muted }]}>TOP CATEGORIES</Text>
            {topCategories.length > 0 ? (
              <CategoryBreakdown
                theme={theme}
                categories={categories}
                byCategory={topCategories}
                currency={currency}
              />
            ) : (
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.hint, { color: theme.muted }]}>No spending in this range.</Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: theme.muted }]}>VS LAST MONTH</Text>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {movers.length === 0 ? (
                <Text style={[styles.hint, { color: theme.muted }]}>
                  Not enough history yet to compare months.
                </Text>
              ) : (
                movers.map((m) => {
                  const meta = getCategoryMeta(m.name, categories);
                  const up = m.delta > 0;
                  const flat = m.delta === 0;
                  const arrow = flat ? "→" : up ? "↑" : "↓";
                  const deltaColor = flat ? theme.muted : up ? theme.danger : theme.credit;
                  return (
                    <View key={m.name} style={styles.moverRow}>
                      <Text style={styles.moverEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.moverLabel, { color: theme.text }]} numberOfLines={1}>
                        {meta.label}
                      </Text>
                      <Text style={[styles.moverNow, { color: theme.text }]}>
                        {formatMoney(m.now, currency)}
                      </Text>
                      <Text style={[styles.moverDelta, { color: deltaColor }]}>
                        {arrow} {formatMoney(Math.abs(m.delta), currency)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 20, fontWeight: "800" },
  rangeRow: { flexDirection: "row", gap: 6 },
  rangePill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  rangeLabel: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  legend: { flexDirection: "row", justifyContent: "center", gap: 18, paddingBottom: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: "600" },
  bars: { flexDirection: "row", alignItems: "flex-end", height: 170, gap: 10 },
  barsScroll: { flexDirection: "row", alignItems: "flex-end", height: 170, gap: 14, paddingHorizontal: 6 },
  barGroup: { flex: 1, alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" },
  barGroupFixed: { width: 68, alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" },
  pair: { flexDirection: "row", alignItems: "flex-end", gap: 8, flex: 1, width: "100%", justifyContent: "center" },
  barCol: { flex: 1, maxWidth: 30, alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" },
  barValue: { fontSize: 9, fontVariant: ["tabular-nums"] },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 5, minHeight: 0 },
  barLabel: { fontSize: 11 },
  paceCard: { gap: 12 },
  paceRow: { flexDirection: "row", alignItems: "center" },
  paceItem: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 8 },
  paceValue: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
  paceLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  paceDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginVertical: 4 },
  paceNote: { fontSize: 12, textAlign: "center" },
  hint: { fontSize: 13, lineHeight: 19, paddingHorizontal: 8 },
  moverRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  moverEmoji: { fontSize: 16, width: 22, textAlign: "center" },
  moverLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  moverNow: { fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  moverDelta: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"], minWidth: 72, textAlign: "right" },
  empty: { alignItems: "center", paddingHorizontal: 40, paddingTop: 100, gap: 12 },
  emptyEmoji: { fontSize: 44 },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 21 },
});
