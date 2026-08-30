import React from "react";
import { StyleSheet, View } from "react-native";
import { Stack, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/theme";
import { AuraVoiceEmblem } from "@/src/components/AuraVoiceBrand";

export default function AppLayout() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const showHomeMark = pathname === "/home" || pathname.endsWith("/home");

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.surface },
          animation: "fade",
        }}
      >
        <Stack.Screen name="home" />
        <Stack.Screen name="owner" />
        <Stack.Screen name="account" />
      </Stack>

      {showHomeMark ? (
        <View pointerEvents="none" style={[styles.brandMark, { top: insets.top + 8 }]}>
          <AuraVoiceEmblem size={48} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  brandMark: {
    position: "absolute",
    left: 14,
    zIndex: 20,
    opacity: 0.88,
  },
});
