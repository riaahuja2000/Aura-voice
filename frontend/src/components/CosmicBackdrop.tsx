// Reusable Aura Voice celestial backdrop used across non-orb screens.
import React, { useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ZodiacRing } from "@/src/components/ZodiacRing";

export type CosmicTheme = "nebula" | "aura" | "crescent";

const BACKDROPS: Record<CosmicTheme, { bg: [string, string, string]; accent: string; secondary: string }> = {
  nebula:   { bg: ["#070713", "#110D28", "#21143A"], accent: "#C8B3FF", secondary: "#9DE2DD" },
  aura:     { bg: ["#0E0811", "#241426", "#3A2031"], accent: "#E2B19F", secondary: "#C8B3FF" },
  crescent: { bg: ["#060811", "#11172B", "#202A42"], accent: "#EEF0FF", secondary: "#9DE2DD" },
};

function Twinkle({ top, left, size, delay, accent }: { top: number; left: number; size: number; delay: number; accent: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      v.value = withRepeat(
        withTiming(1, { duration: 1700 + Math.random() * 1500, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    }, delay);
    return () => clearTimeout(t);
  }, [v, delay]);
  const s = useAnimatedStyle(() => ({ opacity: interpolate(v.value, [0, 1], [0.08, 0.72]) }));
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
  starCount = 24,
  showZodiac = true,
  children,
  style,
}: {
  theme?: CosmicTheme;
  starCount?: number;
  showZodiac?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const conf = BACKDROPS[theme];
  const { width, height } = Dimensions.get("window");
  const ringSize = Math.max(width, height) * 0.92;

  const stars = useMemo(
    () =>
      new Array(starCount).fill(0).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 1 + Math.random() * 2.1,
        delay: Math.random() * 1900,
      })),
    [starCount, theme],
  );

  return (
    <View style={[{ flex: 1, backgroundColor: conf.bg[0] }, style]}>
      <LinearGradient colors={conf.bg} style={StyleSheet.absoluteFill} />

      <LinearGradient
        colors={[conf.accent + "24", conf.secondary + "0C", "transparent"]}
        style={styles.topGlow}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", conf.secondary + "0A", conf.accent + "10"]}
        style={styles.bottomGlow}
        pointerEvents="none"
      />

      {showZodiac ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <ZodiacRing size={ringSize} color={conf.accent} opacity={0.055} duration={135000} />
          <ZodiacRing size={ringSize * 0.66} color={conf.secondary} opacity={0.035} duration={98000} reverse />
        </View>
      ) : null}

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
    left: -70,
    right: -70,
    height: 360,
    borderBottomLeftRadius: 220,
    borderBottomRightRadius: 220,
  },
  bottomGlow: {
    position: "absolute",
    bottom: -150,
    left: -100,
    right: -100,
    height: 340,
    borderTopLeftRadius: 240,
    borderTopRightRadius: 240,
  },
});
