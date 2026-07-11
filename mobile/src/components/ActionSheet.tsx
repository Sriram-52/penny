import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import type { Theme } from "../theme";
import { BottomSheet } from "./BottomSheet";

export interface SheetAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

export interface SheetOptions {
  title: string;
  message?: string;
  actions: SheetAction[];
}

// One state hook per screen; `show()` opens the sheet with whatever options.
export function useActionSheet() {
  const [options, setOptions] = useState<SheetOptions | null>(null);
  return {
    options,
    show: (next: SheetOptions) => setOptions(next),
    hide: () => setOptions(null),
  };
}

interface Props {
  theme: Theme;
  options: SheetOptions | null;
  onClose: () => void;
}

export function ActionSheet({ theme, options, onClose }: Props) {
  return (
    <BottomSheet
      theme={theme}
      visible={options !== null}
      title={options?.title ?? ""}
      subtitle={options?.message}
      onClose={onClose}
    >
      <ScrollView style={styles.actions} bounces={false}>
        {options?.actions.map((action, index) => (
          <Pressable
            key={`${action.label}-${index}`}
            onPress={() => {
              onClose();
              action.onPress();
            }}
            android_ripple={{ color: theme.ripple }}
            style={[styles.actionRow, { borderTopColor: theme.border }]}
          >
            <Text
              style={[
                styles.actionLabel,
                { color: action.destructive ? theme.danger : theme.text },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        onPress={onClose}
        android_ripple={{ color: theme.ripple }}
        style={[styles.actionRow, { borderTopColor: theme.border }]}
      >
        <Text style={[styles.actionLabel, styles.cancelLabel, { color: theme.muted }]}>Cancel</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: 14, maxHeight: 380 },
  actionRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: { fontSize: 15, fontWeight: "600" },
  cancelLabel: { fontWeight: "700" },
});
