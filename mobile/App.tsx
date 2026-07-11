import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppLock } from "./src/components/AppLock";
import { getSetting } from "./src/db";
import type { RootStackParamList } from "./src/nav";
import { HomeScreen } from "./src/screens/HomeScreen";
import { InsightsScreen } from "./src/screens/InsightsScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { PocketScreen } from "./src/screens/PocketScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { useTheme } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigator() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.bg,
      card: theme.bg,
      text: theme.text,
      primary: theme.accent,
      border: theme.border,
    },
  };

  return (
    <AppLock theme={theme}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          initialRouteName={getSetting("currency") ? "Home" : "Onboarding"}
          screenOptions={{ headerShown: false, animation: "slide_from_right" }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Pocket" component={PocketScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Insights" component={InsightsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppLock>
  );
}
