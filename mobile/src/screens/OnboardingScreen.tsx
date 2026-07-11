import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CurrencyGrid } from "../components/CurrencyGrid";
import { alignExpenseCurrency, setSetting } from "../db";
import { entryExample } from "../lib/examples";
import type { RootStackParamList } from "../nav";
import { useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export function OnboardingScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [currency, setCurrency] = useState<string | null>(null);

  const start = () => {
    if (!currency) return;
    setSetting("currency", currency);
    void alignExpenseCurrency(currency);
    navigation.replace("Home");
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🪙</Text>
        <Text style={[styles.title, { color: theme.text }]}>Hi, I'm Penny</Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          Type expenses like you'd text a friend: "{entryExample(currency)}". I'll keep the
          books tidy.
        </Text>
        <Text style={[styles.question, { color: theme.text }]}>
          One thing first: what currency do you spend in?
        </Text>
        <CurrencyGrid theme={theme} selected={currency} onSelect={setCurrency} />
      </ScrollView>
      <View style={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) }}>
        <Pressable
          onPress={start}
          disabled={!currency}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: currency
                ? pressed
                  ? theme.accentPressed
                  : theme.accent
                : theme.border,
            },
          ]}
        >
          <Text style={[styles.ctaLabel, { color: currency ? theme.onAccent : theme.muted }]}>
            {currency ? `Start with ${currency}` : "Pick a currency"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingTop: 72, gap: 12 },
  emoji: { fontSize: 56 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  body: { fontSize: 15, lineHeight: 22 },
  question: { fontSize: 15, fontWeight: "700", marginTop: 16, marginBottom: 4 },
  cta: { borderRadius: 26, paddingVertical: 15, alignItems: "center" },
  ctaLabel: { fontSize: 16, fontWeight: "700" },
});
