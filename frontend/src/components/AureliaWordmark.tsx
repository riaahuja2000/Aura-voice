// AURELIA — mystical glowing wordmark for auth screens.
// Serif letterform with breathing golden glow and a small crescent-star crown.

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { FONTS } from "@/theme";

type Props = {
  size?: number;                // font size
  subtitle?: string;            // optional line beneath
  glow?: string;                // glow color
  ink?: string;                 // letter color
};

export function AureliaWordmark({
  size = 44,
  subtitle,
  glow = "#F2D07A",
  ink = "#FFF7DA",
}: Props) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.5, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.98, 1.04]) }],
  }));

  return (
    <View style={styles.wrap}>
      {/* crown */}
      <View style={styles.crown}>
        <Ionicons name="star" size={10} color={glow} style={{ marginHorizontal: 3, opacity: 0.7 }} />
        <Ionicons name="moon" size={16} color={glow} style={{ marginHorizontal: 4 }} />
        <Ionicons name="star" size={10} color={glow} style={{ marginHorizontal: 3, opacity: 0.7 }} />
      </View>

      {/* breathing glow behind letters */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 22,
            left: 0,
            right: 0,
            height: size * 1.4,
            alignItems: "center",
            justifyContent: "center",
          },
          glowStyle,
        ]}
      >
        <Text
          style={{
            fontFamily: FONTS.displayBold,
            fontSize: size,
            color: glow,
            letterSpacing: size * 0.08,
            textShadowColor: glow,
            textShadowRadius: 22,
            opacity: 0.45,
          }}
        >
          AURELIA
        </Text>
      </Animated.View>

      {/* solid letters on top */}
      <Text
        style={{
          fontFamily: FONTS.displayBold,
          fontSize: size,
          color: ink,
          letterSpacing: size * 0.08,
          textShadowColor: glow,
          textShadowRadius: 12,
        }}
      >
        AURELIA
      </Text>

      {/* hairline divider */}
      <View style={styles.divider}>
        <View style={[styles.dot, { backgroundColor: glow }]} />
        <View style={[styles.hair, { backgroundColor: glow }]} />
        <View style={[styles.dot, { backgroundColor: glow }]} />
      </View>

      {subtitle ? (
        <Text
          style={{
            fontFamily: FONTS.body,
            color: "#E1E1E6",
            fontSize: 12,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginTop: 8,
            opacity: 0.75,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  crown: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  divider: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 6 },
  dot: { width: 4, height: 4, borderRadius: 2, opacity: 0.85 },
  hair: { width: 80, height: 1, opacity: 0.55 },
});
