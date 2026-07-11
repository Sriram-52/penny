import * as Haptics from "expo-haptics";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import type { CategoryRecord, ExpenseRecord } from "../db";
import { getCategoryMeta } from "../lib/categories";
import { formatMoney } from "../lib/format";
import type { Theme } from "../theme";

interface Props {
  theme: Theme;
  item: ExpenseRecord;
  categories: CategoryRecord[];
  // Shown after the category, e.g. "Shopping · Bangalore trip".
  pocketName?: string;
  onPress: (item: ExpenseRecord) => void;
  onDelete: (item: ExpenseRecord) => void;
}

export function ExpenseRow({ theme, item, categories, pocketName, onPress, onDelete }: Props) {
  const meta = getCategoryMeta(item.category, categories);
  const subtitle = pocketName ? `${meta.label} · ${pocketName}` : meta.label;
  const swipeable = useRef<SwipeableMethods>(null);

  const confirmDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeable.current?.close();
    onDelete(item);
  };

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={confirmDelete}
          style={[styles.deleteAction, { backgroundColor: theme.danger }]}
          accessibilityLabel={`Delete ${item.description}`}
        >
          <Text style={styles.deleteLabel}>Delete</Text>
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => onPress(item)}
        android_ripple={{ color: theme.ripple }}
        style={[styles.row, { backgroundColor: theme.bg }]}
        accessibilityHint="Tap to edit, swipe left to delete"
      >
        <View style={[styles.badge, { backgroundColor: `${meta.tint}26` }]}>
          <Text style={styles.badgeEmoji}>{meta.emoji}</Text>
        </View>
        <View style={styles.middle}>
          <Text style={[styles.description, { color: theme.text }]} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={[styles.category, { color: theme.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Text style={[styles.amount, { color: item.kind === "credit" ? theme.credit : theme.text }]}>
          {item.kind === "credit" ? "+" : ""}
          {formatMoney(item.amount, item.currency)}
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeEmoji: { fontSize: 17 },
  middle: { flex: 1, gap: 1 },
  description: { fontSize: 15, fontWeight: "600" },
  category: { fontSize: 12 },
  amount: { fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
  deleteAction: {
    width: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
