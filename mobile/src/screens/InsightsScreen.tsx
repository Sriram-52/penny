import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getCurrency, useCategories, useExpenses } from "../db";
import { getCategoryMeta } from "../lib/categories";
import { formatMoney } from "../lib/format";
import type { RootStackParamList } from "../nav";
import { useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Insights">;

// Builds the trailing `count` calendar months ending with the current month,
// each as { key: "YYYY-MM", label: "Jul" }. Oldest first.
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

export function InsightsScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: rows } = useExpenses();
  const { data: categoryRows } = useCategories();
  const categories = categoryRows ?? [];
  const currency = getCurrency();
  const expenses = rows ?? [];

  // Spend (debit only) per month for the trailing 6 months.
  const months = useMemo(() => trailingMonths(6), []);
  const monthSpend = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of expenses) {
      if (r.kind === "credit") continue;
      const key = r.date.slice(0, 7);
      totals.set(key, (totals.get(key) ?? 0) + r.amount);
    }
    return months.map((m) => ({ ...m, total: totals.get(m.key) ?? 0 }));
  }, [expenses, months]);
  const maxMonth = Math.max(1, ...monthSpend.map((m) => m.total));

  // This month vs last month, per category (debit only).
  const thisKey = months[months.length - 1]?.key ?? "";
  const lastKey = months[months.length - 2]?.key ?? "";
  const movers = useMemo(() => {
    const cur = new Map<string, number>();
    const prev = new Map<string, number>();
    for (const r of expenses) {
      if (r.kind === "credit") continue;
      const mk = r.date.slice(0, 7);
      if (mk === thisKey) cur.set(r.category, (cur.get(r.category) ?? 0) + r.amount);
      else if (mk === lastKey) prev.set(r.category, (prev.get(r.category) ?? 0) + r.amount);
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
  }, [expenses, thisKey, lastKey]);

  const hasData = expenses.length > 0;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }]}
          accessibilityLabel="Back"
        >
          <Text style={[styles.backIcon, { color: theme.text }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Insights</Text>
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
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>LAST 6 MONTHS</Text>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.bars}>
                {monthSpend.map((m, i) => {
                  const isCurrent = i === monthSpend.length - 1;
                  const heightPct = Math.max((m.total / maxMonth) * 100, 2);
                  return (
                    <View key={m.key} style={styles.barCol}>
                      <Text style={[styles.barValue, { color: theme.muted }]} numberOfLines={1}>
                        {m.total > 0 ? formatMoney(m.total, currency) : ""}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${heightPct}%`,
                              backgroundColor: isCurrent ? theme.accent : `${theme.accent}55`,
                            },
                          ]}
                        />
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
                })}
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              VS LAST MONTH
            </Text>
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
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
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
  title: { fontSize: 20, fontWeight: "800" },
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
  bars: { flexDirection: "row", alignItems: "flex-end", height: 160, gap: 6 },
  barCol: { flex: 1, alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" },
  barValue: { fontSize: 9, fontVariant: ["tabular-nums"] },
  barTrack: { flex: 1, width: "70%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 6, minHeight: 3 },
  barLabel: { fontSize: 11 },
  moverRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  moverEmoji: { fontSize: 16, width: 22, textAlign: "center" },
  moverLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  moverNow: { fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  moverDelta: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"], minWidth: 72, textAlign: "right" },
  hint: { fontSize: 13, lineHeight: 19, paddingHorizontal: 8 },
  empty: { alignItems: "center", paddingHorizontal: 40, paddingTop: 100, gap: 12 },
  emptyEmoji: { fontSize: 44 },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 21 },
});
