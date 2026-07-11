import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { addCategory, deleteCategory, type CategoryRecord } from "../db";
import { getCategoryMeta } from "../lib/categories";
import type { Theme } from "../theme";
import { BottomSheet } from "./BottomSheet";

interface Props {
  theme: Theme;
  visible: boolean;
  categories: CategoryRecord[];
  onPick: (name: string) => void;
  onClose: () => void;
}

// Bottom sheet for choosing a tag - and the place where the user owns the
// list: add any tag with any emoji, long-press to remove.
export function CategoryPicker({ theme, visible, categories, onPick, onClose }: Props) {
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");

  const pick = (name: string) => {
    Haptics.selectionAsync();
    onPick(name);
  };

  const addNew = async () => {
    const name = newName.trim().toLowerCase();
    if (!name) return;
    await addCategory(name, newEmoji.trim());
    setNewName("");
    setNewEmoji("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPick(name);
  };

  const startRemove = (record: CategoryRecord) => {
    if (record.name === "other") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const meta = getCategoryMeta(record.name, categories);
    Alert.alert(
      `Remove ${meta.emoji} ${meta.label}?`,
      `Expenses already tagged "${record.name}" keep the tag; it just leaves this list.`,
      [
        { text: "Keep", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void deleteCategory(record.name) },
      ],
    );
  };

  return (
    <BottomSheet
      theme={theme}
      visible={visible}
      title="Pick a tag"
      subtitle="These are yours. Add anything; long-press to remove."
      onClose={onClose}
    >
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.grid}>
          {categories.map((record) => {
            const meta = getCategoryMeta(record.name, categories);
            return (
              <Pressable
                key={record.name}
                onPress={() => pick(record.name)}
                onLongPress={() => startRemove(record)}
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
      </ScrollView>
      <View style={[styles.addRow, { borderTopColor: theme.border }]}>
        <TextInput
          style={[
            styles.emojiInput,
            { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
          ]}
          value={newEmoji}
          onChangeText={setNewEmoji}
          placeholder="🏷️"
          placeholderTextColor={theme.muted}
          maxLength={2}
        />
        <TextInput
          style={[
            styles.nameInput,
            { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
          ]}
          value={newName}
          onChangeText={setNewName}
          placeholder="new tag…"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          maxLength={30}
          onSubmitEditing={addNew}
        />
        <Pressable
          onPress={addNew}
          disabled={!newName.trim()}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: newName.trim()
                ? pressed
                  ? theme.accentPressed
                  : theme.accent
                : theme.border,
            },
          ]}
          accessibilityLabel="Add tag"
        >
          <Text
            style={{
              color: newName.trim() ? theme.onAccent : theme.muted,
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            +
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginTop: 14, maxHeight: 320 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: { fontSize: 13, fontWeight: "600" },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
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
});
