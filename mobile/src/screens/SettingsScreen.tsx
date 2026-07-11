import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryPicker } from "../components/CategoryPicker";
import { CurrencyGrid } from "../components/CurrencyGrid";
import {
  addCategory,
  addRule,
  alignExpenseCurrency,
  deleteCategory,
  deleteRule,
  getSetting,
  setSetting,
  useCategories,
  useRules,
  type CategoryRecord,
} from "../db";
import { getCategoryMeta } from "../lib/categories";
import type { RootStackParamList } from "../nav";
import { useTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: categoryRows } = useCategories();
  const { data: ruleRows } = useRules();
  const categories = categoryRows ?? [];
  const rules = ruleRows ?? [];

  const [newTagEmoji, setNewTagEmoji] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [currency, setCurrency] = useState<string | null>(() => getSetting("currency"));

  const [rulePattern, setRulePattern] = useState("");
  const [ruleCategory, setRuleCategory] = useState("dining");
  const [pickingRuleCategory, setPickingRuleCategory] = useState(false);

  const addTag = async () => {
    const name = newTagName.trim().toLowerCase();
    if (!name) return;
    await addCategory(name, newTagEmoji.trim());
    setNewTagName("");
    setNewTagEmoji("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeTag = (record: CategoryRecord) => {
    if (record.name === "other") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const meta = getCategoryMeta(record.name, categories);
    Alert.alert(
      `Remove ${meta.emoji} ${meta.label}?`,
      `Expenses already tagged "${record.name}" keep the tag; it just leaves your list.`,
      [
        { text: "Keep", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void deleteCategory(record.name) },
      ],
    );
  };

  const addMemoryRule = () => {
    const pattern = rulePattern.trim();
    if (!pattern) return;
    void addRule(pattern, ruleCategory);
    setRulePattern("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const ruleCategoryMeta = getCategoryMeta(ruleCategory, categories);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            accessibilityLabel="Back"
          >
            <Text style={[styles.backIcon, { color: theme.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>CURRENCY</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionHint, { color: theme.muted }]}>
              Used for everything, old and new. Amounts stay as typed; only the symbol changes.
            </Text>
            <View style={styles.currencyWrap}>
              <CurrencyGrid
                theme={theme}
                selected={currency}
                onSelect={(code) => {
                  setCurrency(code);
                  setSetting("currency", code);
                  void alignExpenseCurrency(code);
                }}
              />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.muted }]}>YOUR TAGS</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionHint, { color: theme.muted }]}>
              Penny sorts expenses into these. Add anything; long-press to remove.
            </Text>
            <View style={styles.tagGrid}>
              {categories.map((record) => {
                const meta = getCategoryMeta(record.name, categories);
                return (
                  <Pressable
                    key={record.name}
                    onLongPress={() => removeTag(record)}
                    delayLongPress={350}
                    style={[styles.chip, { backgroundColor: `${meta.tint}26` }]}
                  >
                    <Text style={[styles.chipLabel, { color: theme.text }]}>
                      {meta.emoji} {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.addRow, { borderTopColor: theme.border }]}>
              <TextInput
                style={[
                  styles.emojiInput,
                  { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
                ]}
                value={newTagEmoji}
                onChangeText={setNewTagEmoji}
                placeholder="🏷️"
                placeholderTextColor={theme.muted}
                maxLength={2}
              />
              <TextInput
                style={[
                  styles.nameInput,
                  { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
                ]}
                value={newTagName}
                onChangeText={setNewTagName}
                placeholder="new tag…"
                placeholderTextColor={theme.muted}
                autoCapitalize="none"
                maxLength={30}
                onSubmitEditing={addTag}
              />
              <AddButton theme={theme} enabled={!!newTagName.trim()} onPress={addTag} />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.muted }]}>✨ PENNY'S MEMORY</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionHint, { color: theme.muted }]}>
              When you fix a tag before saving, Penny remembers. Teach or un-teach her here.
            </Text>
            <View style={styles.ruleAddRow}>
              <TextInput
                style={[
                  styles.nameInput,
                  { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
                ]}
                value={rulePattern}
                onChangeText={setRulePattern}
                placeholder='anything with "chai"…'
                placeholderTextColor={theme.muted}
                autoCapitalize="none"
                onSubmitEditing={addMemoryRule}
              />
              <Pressable
                onPress={() => setPickingRuleCategory(true)}
                style={[styles.chip, { backgroundColor: `${ruleCategoryMeta.tint}26` }]}
                accessibilityLabel={`Tag ${ruleCategoryMeta.label}, tap to change`}
              >
                <Text style={[styles.chipLabel, { color: theme.text }]}>
                  {ruleCategoryMeta.emoji} {ruleCategoryMeta.label}
                </Text>
              </Pressable>
              <AddButton theme={theme} enabled={!!rulePattern.trim()} onPress={addMemoryRule} />
            </View>

            {rules.length === 0 ? (
              <Text style={[styles.emptyRules, { color: theme.muted }]}>
                Nothing learned yet. Change a tag on any expense before saving it, and the
                correction shows up here.
              </Text>
            ) : (
              rules.map((rule) => {
                const meta = getCategoryMeta(rule.category, categories);
                return (
                  <View key={rule.pattern} style={[styles.ruleRow, { borderTopColor: theme.border }]}>
                    <Text style={[styles.rulePattern, { color: theme.text }]} numberOfLines={1}>
                      “{rule.pattern}”
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 13 }}>→</Text>
                    <View style={[styles.chip, { backgroundColor: `${meta.tint}26` }]}>
                      <Text style={[styles.chipLabel, { color: theme.text }]}>
                        {meta.emoji} {meta.label}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void deleteRule(rule.pattern)}
                      hitSlop={10}
                      accessibilityLabel={`Forget rule for ${rule.pattern}`}
                    >
                      <Text style={{ color: theme.muted, fontSize: 16 }}>✕</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CategoryPicker
        theme={theme}
        visible={pickingRuleCategory}
        categories={categories}
        onPick={(name) => {
          setRuleCategory(name);
          setPickingRuleCategory(false);
        }}
        onClose={() => setPickingRuleCategory(false)}
      />
    </View>
  );
}

function AddButton({
  theme,
  enabled,
  onPress,
}: {
  theme: ReturnType<typeof useTheme>;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      style={({ pressed }) => [
        styles.addButton,
        {
          backgroundColor: enabled ? (pressed ? theme.accentPressed : theme.accent) : theme.border,
        },
      ]}
      accessibilityLabel="Add"
    >
      <Text style={{ color: enabled ? theme.onAccent : theme.muted, fontSize: 18, fontWeight: "700" }}>
        +
      </Text>
    </Pressable>
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
    overflow: "hidden",
    paddingVertical: 14,
  },
  sectionHint: { fontSize: 12, lineHeight: 18, paddingHorizontal: 16, marginBottom: 12 },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  chip: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipLabel: { fontSize: 12, fontWeight: "600" },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ruleAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  emojiInput: {
    width: 52,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: "center",
  },
  nameInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  currencyWrap: { paddingHorizontal: 16, paddingBottom: 6 },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rulePattern: { flexShrink: 1, flexGrow: 1, fontSize: 14, fontWeight: "600" },
  emptyRules: { fontSize: 13, lineHeight: 19, paddingHorizontal: 16, paddingBottom: 4 },
});
