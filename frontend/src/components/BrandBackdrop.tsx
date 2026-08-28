import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/theme";
import { useSettings } from "@/src/settings";
import { mediaUrl } from "@/src/api";

const LOCAL_BG = require("@/assets/brand/velora-crystal-bg.png");

export function BrandBackdrop({
  children,
  style,
  scrim = "heavy",
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
  scrim?: "heavy" | "medium";
}) {
  const { settings } = useSettings();
  const bg = settings.background_url ? { uri: mediaUrl(settings.background_url) } : LOCAL_BG;

  const colors =
    scrim === "heavy"
      ? (["rgba(5,5,8,0.55)", "rgba(5,5,8,0.82)", COLORS.surface] as const)
      : (["rgba(5,5,8,0.35)", "rgba(5,5,8,0.7)", "rgba(5,5,8,0.96)"] as const);

  return (
    <View style={[styles.root, style]}>
      <Image source={bg} style={StyleSheet.absoluteFill as any} contentFit="cover" transition={400} />
      <LinearGradient
        colors={colors}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill as any}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
});
