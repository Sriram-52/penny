import { StyleSheet, Text, View } from "react-native";

import type { CategoryRecord } from "../db";
import { getCategoryMeta } from "../lib/categories";
import { formatMoney } from "../lib/format";
import type { Theme } from "../theme";

interface Props {
  theme: Theme;
  categories: CategoryRecord[];
  // [category name, total] pairs, sorted descending.
  byCategory: Array<[string, number]>;
  currency: string;
}

export function CategoryBreakdown({ theme, categories, byCategory, currency }: Props) {
  if (byCategory.length === 0) return null;
  const max = byCategory[0]?.[1] ?? 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {byCategory.map(([name, amount]) => {
        const meta = getCategoryMeta(name, categories);
        const share = max > 0 ? amount / max : 0;
        return (
          <View key={name} style={styles.row}>
            <Text style={styles.emoji}>{meta.emoji}</Text>
            <View style={styles.middle}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.text }]}>{meta.label}</Text>
                <Text style={[styles.amount, { color: theme.text }]}>
                  {formatMoney(amount, currency)}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.fill,
                    { backgroundColor: meta.tint, width: `${Math.max(share * 100, 3)}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emoji: { fontSize: 16, width: 24, textAlign: "center" },
  middle: { flex: 1, gap: 5 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontSize: 13, fontWeight: "600" },
  amount: { fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  track: { height: 5, borderRadius: 3, overflow: "hidden" },
  fill: { height: 5, borderRadius: 3 },
});
