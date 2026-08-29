import React from "react";
import { Stack } from "expo-router";
import { COLORS } from "@/theme";

export default function AppLayout() {
  return (
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
  );
}
