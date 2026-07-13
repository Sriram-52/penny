import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppLock } from "../components/AppLock";
import { useTheme } from "../theme";

export default function RootLayout() {
  const theme = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppLock theme={theme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
            animation: "slide_from_right",
          }}
        />
      </AppLock>
    </GestureHandlerRootView>
  );
}
