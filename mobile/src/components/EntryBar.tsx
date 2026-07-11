import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { Theme } from "../theme";

interface Props {
  theme: Theme;
  value: string;
  busy: boolean;
  // Whether this note records money spent or money received.
  kind: "debit" | "credit";
  onToggleKind: () => void;
  placeholder?: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
}

export function EntryBar({
  theme,
  value,
  busy,
  kind,
  onToggleKind,
  placeholder,
  onChange,
  onSubmit,
}: Props) {
  const canSend = value.trim().length > 0 && !busy;
  const receiving = kind === "credit";
  const sendColor = receiving ? theme.credit : theme.accent;

  return (
    <View
      style={{
        backgroundColor: theme.bg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.border,
        paddingTop: receiving ? 10 : 0,
      }}
    >
      {receiving && (
        <Pressable
          onPress={onToggleKind}
          style={[styles.banner, { backgroundColor: `${theme.credit}1F` }]}
          accessibilityLabel="Recording money received; tap to switch back to spending"
        >
          <Text style={[styles.bannerText, { color: theme.credit }]}>
            + Recording money received · tap to switch back
          </Text>
        </Pressable>
      )}
      <View style={[styles.bar, { backgroundColor: theme.bg }]}>
        <Pressable
          onPress={onToggleKind}
          hitSlop={8}
          style={[
            styles.kindToggle,
            {
              backgroundColor: receiving ? theme.credit : theme.inputBg,
              borderColor: receiving ? theme.credit : theme.border,
            },
          ]}
          accessibilityLabel={
            receiving
              ? "Recording money received; tap for spending"
              : "Recording spending; tap for money received"
          }
        >
          <Text style={[styles.kindIcon, { color: receiving ? theme.onAccent : theme.muted }]}>
            {receiving ? "+" : "−"}
          </Text>
        </Pressable>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.inputBg,
            borderColor: receiving ? theme.credit : theme.border,
            color: theme.text,
          },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={receiving ? "money received…" : (placeholder ?? "coffee 6.50, uber 32…")}
        placeholderTextColor={theme.muted}
        multiline
        editable={!busy}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={onSubmit}
        disabled={!canSend}
        hitSlop={8}
        style={({ pressed }) => [
          styles.send,
          {
            backgroundColor: canSend
              ? pressed
                ? theme.accentPressed
                : sendColor
              : theme.border,
          },
        ]}
        accessibilityLabel={receiving ? "Add money received" : "Add expenses"}
      >
          {busy ? (
            <ActivityIndicator color={theme.onAccent} size="small" />
          ) : (
            <Text style={[styles.sendIcon, { color: canSend ? theme.onAccent : theme.muted }]}>↑</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bannerText: { fontSize: 12, fontWeight: "700" },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  kindToggle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  kindIcon: {
    fontSize: 18,
    fontWeight: "800",
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    lineHeight: 21,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: -2,
  },
});
