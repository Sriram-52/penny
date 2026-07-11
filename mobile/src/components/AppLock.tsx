import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { getSetting } from "../db";
import type { Theme } from "../theme";

interface Props {
  theme: Theme;
  children: ReactNode;
}

// Gates the whole app behind the device screen lock (biometric or PIN) when
// the "appLock" setting is on. Locks on cold start and whenever the app
// comes back from the background.
export function AppLock({ theme, children }: Props) {
  const [locked, setLocked] = useState(() => getSetting("appLock") === "1");
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Penny",
        cancelLabel: "Cancel",
      });
      if (result.success) setLocked(false);
    } finally {
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" && getSetting("appLock") === "1") {
        setLocked(true);
      } else if (state === "active" && lockedRef.current) {
        void unlock();
      }
    });
    return () => subscription.remove();
  }, [unlock]);

  // Cold start while locked: prompt right away.
  useEffect(() => {
    if (locked) void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The lock screen is an overlay, not a replacement: unmounting the app
  // while locked would reset navigation state (and replay the initial route)
  // on every unlock.
  return (
    <View style={StyleSheet.absoluteFill}>
      {children}
      {locked && (
        <View style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: theme.bg }]}>
          <Text style={styles.emoji}>🪙</Text>
          <Text style={[styles.title, { color: theme.text }]}>Penny is locked</Text>
          <Pressable
            onPress={() => void unlock()}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: pressed ? theme.accentPressed : theme.accent },
            ]}
          >
            <Text style={[styles.buttonLabel, { color: theme.onAccent }]}>Unlock</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  emoji: { fontSize: 52 },
  title: { fontSize: 18, fontWeight: "700" },
  button: {
    marginTop: 10,
    borderRadius: 24,
    paddingVertical: 13,
    paddingHorizontal: 44,
  },
  buttonLabel: { fontSize: 15, fontWeight: "700" },
});
