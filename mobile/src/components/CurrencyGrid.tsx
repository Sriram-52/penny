import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { currencySymbol } from "../lib/format";
import type { Theme } from "../theme";

const COMMON_CURRENCIES = ["USD", "INR", "EUR", "GBP", "JPY", "CAD", "AUD", "SGD", "AED", "CHF"];

interface Props {
  theme: Theme;
  selected: string | null;
  onSelect: (code: string) => void;
}

export function CurrencyGrid({ theme, selected, onSelect }: Props) {
  const [custom, setCustom] = useState("");

  const codes = COMMON_CURRENCIES.includes(selected ?? "")
    ? COMMON_CURRENCIES
    : selected
      ? [selected, ...COMMON_CURRENCIES]
      : COMMON_CURRENCIES;

  const pick = (code: string) => {
    Haptics.selectionAsync();
    onSelect(code);
  };

  const submitCustom = () => {
    const code = custom.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) {
      setCustom("");
      pick(code);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {codes.map((code) => {
          const active = code === selected;
          return (
            <Pressable
              key={code}
              onPress={() => pick(code)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.accent : theme.card,
                  borderColor: active ? theme.accent : theme.border,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: active ? theme.onAccent : theme.text }]}>
                {currencySymbol(code)} {code}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.customRow}>
        <TextInput
          style={[
            styles.customInput,
            { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
          ]}
          value={custom}
          onChangeText={setCustom}
          placeholder="other (ISO code, e.g. NZD)"
          placeholderTextColor={theme.muted}
          autoCapitalize="characters"
          maxLength={3}
          onSubmitEditing={submitCustom}
        />
        <Pressable
          onPress={submitCustom}
          disabled={!/^[A-Za-z]{3}$/.test(custom.trim())}
          style={({ pressed }) => [
            styles.customButton,
            {
              backgroundColor: /^[A-Za-z]{3}$/.test(custom.trim())
                ? pressed
                  ? theme.accentPressed
                  : theme.accent
                : theme.border,
            },
          ]}
          accessibilityLabel="Use this currency"
        >
          <Text
            style={{
              color: /^[A-Za-z]{3}$/.test(custom.trim()) ? theme.onAccent : theme.muted,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            Use
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipLabel: { fontSize: 13, fontWeight: "700" },
  customRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  customInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  customButton: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 9 },
});
