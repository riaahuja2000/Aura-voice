import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { FONT_ASSETS, COLORS } from "@/theme";
import { I18nProvider } from "@/src/i18n";
import { SettingsProvider } from "@/src/settings";
import { AuthProvider } from "@/src/auth";
import { ToastProvider } from "@/src/ui";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts(FONT_ASSETS);

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <KeyboardProvider>
      <SafeAreaProvider>
        <I18nProvider>
          <SettingsProvider>
            <AuthProvider>
              <ToastProvider>
                <StatusBar style="light" />
                <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.surface } }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="register" />
                    <Stack.Screen name="forgot-password" />
                    <Stack.Screen name="(app)" />
                  </Stack>
                </View>
                {Platform.OS === "web" && <SpeedInsights />}
              </ToastProvider>
            </AuthProvider>
          </SettingsProvider>
        </I18nProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
