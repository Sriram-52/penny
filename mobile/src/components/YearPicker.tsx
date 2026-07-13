import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Theme } from "../theme";
import { BottomSheet } from "./BottomSheet";

interface Props {
  theme: Theme;
  visible: boolean;
  // Years that have at least one entry.
  yearsWithData: Set<number>;
  selectedYear: number;
  minYear: number;
  maxYear: number;
  onPick: (year: number) => void;
  onClose: () => void;
}

export function YearPicker({
  theme,
  visible,
  yearsWithData,
  selectedYear,
  minYear,
  maxYear,
  onPick,
  onClose,
}: Props) {
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);

  const pick = (year: number) => {
    Haptics.selectionAsync();
    onPick(year);
  };

  return (
    <BottomSheet theme={theme} visible={visible} title="Jump to year" onClose={onClose}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator
      >
        {years.map((year) => {
          const isSelected = year === selectedYear;
          const hasData = yearsWithData.has(year);
          return (
            <Pressable
              key={year}
              onPress={() => pick(year)}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? theme.accent : theme.inputBg,
                  borderColor: isSelected ? theme.accent : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: isSelected ? theme.onAccent : hasData ? theme.text : theme.muted,
                    fontWeight: hasData || isSelected ? "700" : "500",
                  },
                ]}
              >
                {year}
              </Text>
              {hasData && !isSelected && <View style={[styles.dot, { backgroundColor: theme.accent }]} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 360, marginTop: 8 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  chip: {
    width: "30.6%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    gap: 4,
  },
  label: { fontSize: 15, fontVariant: ["tabular-nums"] },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
