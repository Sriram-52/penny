import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Theme } from "../theme";
import { BottomSheet } from "./BottomSheet";

interface Props {
  theme: Theme;
  visible: boolean;
  // "YYYY-MM" keys of months that have at least one entry.
  monthsWithData: Set<string>;
  viewedYear: number;
  // 1-based month.
  viewedMonth: number;
  onPick: (year: number, month: number) => void;
  onClose: () => void;
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString(undefined, { month: "short" }),
);

export function MonthPicker({
  theme,
  visible,
  monthsWithData,
  viewedYear,
  viewedMonth,
  onPick,
  onClose,
}: Props) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const earliestYear = [...monthsWithData].reduce(
    (min, key) => Math.min(min, Number(key.slice(0, 4))),
    currentYear,
  );

  const [year, setYear] = useState(viewedYear);

  useEffect(() => {
    if (visible) setYear(viewedYear);
  }, [visible, viewedYear]);

  const pick = (month: number) => {
    Haptics.selectionAsync();
    onPick(year, month);
  };

  return (
    <BottomSheet theme={theme} visible={visible} title="Jump to month" onClose={onClose}>
      <View style={styles.yearRow}>
        <Pressable
          onPress={() => setYear((y) => Math.max(earliestYear, y - 1))}
          disabled={year <= earliestYear}
          hitSlop={12}
          accessibilityLabel="Previous year"
        >
          <Text style={[styles.yearChevron, { color: year <= earliestYear ? theme.border : theme.muted }]}>
            ‹
          </Text>
        </Pressable>
        <Text style={[styles.year, { color: theme.text }]}>{year}</Text>
        <Pressable
          onPress={() => setYear((y) => Math.min(currentYear, y + 1))}
          disabled={year >= currentYear}
          hitSlop={12}
          accessibilityLabel="Next year"
        >
          <Text style={[styles.yearChevron, { color: year >= currentYear ? theme.border : theme.muted }]}>
            ›
          </Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {MONTH_NAMES.map((name, i) => {
          const month = i + 1;
          const key = `${year}-${String(month).padStart(2, "0")}`;
          const isFuture = year === currentYear && month > currentMonth;
          const isViewed = year === viewedYear && month === viewedMonth;
          const hasData = monthsWithData.has(key);
          return (
            <Pressable
              key={key}
              onPress={() => pick(month)}
              disabled={isFuture}
              style={[
                styles.monthChip,
                {
                  backgroundColor: isViewed ? theme.accent : theme.inputBg,
                  borderColor: isViewed ? theme.accent : theme.border,
                  opacity: isFuture ? 0.35 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.monthLabel,
                  {
                    color: isViewed ? theme.onAccent : hasData ? theme.text : theme.muted,
                    fontWeight: hasData || isViewed ? "700" : "500",
                  },
                ]}
              >
                {name}
              </Text>
              {hasData && !isViewed && <View style={[styles.dot, { backgroundColor: theme.accent }]} />}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    marginTop: 14,
  },
  year: { fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] },
  yearChevron: { fontSize: 26, fontWeight: "700", marginTop: -4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  monthChip: {
    width: "22.5%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    gap: 3,
  },
  monthLabel: { fontSize: 13 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
