import { StyleSheet, Text, View } from "react-native";

import { formatMoney } from "../lib/format";
import type { Theme } from "../theme";

interface Props {
  theme: Theme;
  label: string; // e.g. "Monthly budget" or "Trip budget"
  spent: number;
  budget: number; // caller guarantees > 0
  currency: string;
}

export function BudgetMeter({ theme, label, spent, budget, currency }: Props) {
  const ratio = budget > 0 ? spent / budget : 0;
  const remaining = budget - spent;
  const over = remaining < 0;
  // Warm accent under budget, amber as it fills, danger once exceeded.
  const barColor = over ? theme.danger : ratio >= 0.8 ? theme.warn : theme.accent;
  const statusColor = over ? theme.danger : theme.muted;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.muted }]}>{label.toUpperCase()}</Text>
        <Text style={[styles.figures, { color: theme.text }]}>
          {formatMoney(spent, currency)} / {formatMoney(budget, currency)}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: barColor, width: `${Math.min(Math.max(ratio * 100, 3), 100)}%` },
          ]}
        />
      </View>
      <Text style={[styles.status, { color: statusColor }]}>
        {over
          ? `${formatMoney(-remaining, currency)} over`
          : `${formatMoney(remaining, currency)} left`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.1 },
  figures: { fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  status: { fontSize: 12, fontWeight: "600" },
});
