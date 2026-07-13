import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { getSetting } from "../../db";
import { useTheme } from "../../theme";

export default function TabsLayout() {
  const theme = useTheme();
  // First run: no currency picked yet → send them through onboarding.
  if (!getSetting("currency")) return <Redirect href="/onboarding" />;

  // Theme the Android bar explicitly (its native bar doesn't repaint from
  // Appearance overrides). iOS uses the system tab bar with our tint.
  const android = Platform.OS === "android";
  return (
    <NativeTabs
      tintColor={theme.accent}
      backgroundColor={android ? theme.card : undefined}
      iconColor={android ? theme.muted : undefined}
      labelStyle={android ? { color: theme.muted } : undefined}
      // The Material active pill defaults to a blue; tint it to the palette.
      indicatorColor={android ? `${theme.accent}26` : undefined}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trends">
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
        <NativeTabs.Trigger.Label>Trends</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
