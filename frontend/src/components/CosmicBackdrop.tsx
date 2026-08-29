// Reusable cosmic starry backdrop used across every screen of the app.
// Renders a deep-space gradient + twinkling ambient stars.
// Themes match the voice-orb home so the visual language stays consistent.

import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

export type CosmicTheme = "nebula" | "aura" | "crescent";

const BACKDROPS: Record<CosmicTheme, { bg: [string, string, string]; accent: string }> = {
  nebula:   { bg: ["#05000E", "#0B0322", "#1A0733"], accent: "#C9B8FF" },
  aura:     { bg: ["#0A0002", "#170603", "#2A0A0A"], accent: "#FFD9A8" },
  crescent: { bg: ["#02030A", "#0A0F1F", "#151B2D"], accent: "#DDE4FF" },
};

function Twinkle({
  top,
  left,
  size,
  delay,
  accent,
}: {
  top: number;
  left: number;
  size: number;
  delay: number;
  accent: string;
}) {
  const v = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      v.value = withRepeat(
        withTiming(1, { duration: 1600 + Math.random() * 1600, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    }, delay);
    return () => clearTimeout(t);
  }, [v, delay]);
  const s = useAnimatedStyle(() => ({ opacity: interpolate(v.value, [0, 1], [0.12, 0.9]) }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: `${top}%`,
          left: `${left}%`,
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: accent,
        },
        s,
      ]}
    />
  );
}

export function CosmicBackdrop({
  theme = "nebula",
  starCount = 28,
  children,
  style,
}: {
  theme?: CosmicTheme;
  starCount?: number;
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const conf = BACKDROPS[theme];

  const stars = useMemo(
    () =>
      new Array(starCount).fill(0).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 1 + Math.random() * 2.4,
        delay: Math.random() * 1800,
      })),
    [starCount, theme],
  );

  return (
    <View style={[{ flex: 1, backgroundColor: conf.bg[0] }, style]}>
      <LinearGradient colors={conf.bg} style={StyleSheet.absoluteFill} />

      {/* Soft radial glow near top-center */}
      <LinearGradient
        colors={[conf.accent + "22", "transparent"]}
        style={styles.topGlow}
        pointerEvents="none"
      />

      {stars.map((s) => (
        <Twinkle key={`${theme}-${s.id}`} top={s.top} left={s.left} size={s.size} delay={s.delay} accent={conf.accent} />
      ))}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topGlow: {
    position: "absolute",
    top: -120,
    left: -60,
    right: -60,
    height: 340,
    borderBottomLeftRadius: 200,
    borderBottomRightRadius: 200,
  },
});
