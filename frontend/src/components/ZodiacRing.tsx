// A slow-rotating zodiac ring rendered with plain RN — no SVG dependency.
// Sits as a subtle watermark behind the content on every screen.

import React, { useEffect, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

type Props = {
  size?: number;
  color?: string;
  opacity?: number;
  duration?: number; // ms per full rotation
  reverse?: boolean;
};

export function ZodiacRing({
  size = 340,
  color = "#C9B8FF",
  opacity = 0.09,
  duration = 90000,
  reverse = false,
}: Props) {
  const rot = useSharedValue(0);

  useEffect(() => {
    rot.value = 0;
    rot.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
  }, [duration, rot]);

  const style = useAnimatedStyle(() => {
    const deg = rot.value * (reverse ? -360 : 360);
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  const items = useMemo(() => {
    const R = size / 2 - 14;
    return GLYPHS.map((g, i) => {
      const a = (i / GLYPHS.length) * Math.PI * 2 - Math.PI / 2;
      return {
        g,
        i,
        x: Math.cos(a) * R,
        y: Math.sin(a) * R,
        rot: (i / GLYPHS.length) * 360,
      };
    });
  }, [size]);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
        },
      ]}
    >
      <Animated.View style={[styles.inner, { width: size, height: size, borderRadius: size / 2 }, style]}>
        {/* concentric rings */}
        <View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: color,
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              width: size - 26,
              height: size - 26,
              borderRadius: (size - 26) / 2,
              borderColor: color,
              borderStyle: Platform.OS === "web" ? "dashed" : "solid",
              opacity: 0.5,
            },
          ]}
        />

        {items.map((it) => (
          <View
            key={it.i}
            style={{
              position: "absolute",
              left: size / 2 + it.x - 14,
              top: size / 2 + it.y - 14,
              width: 28,
              height: 28,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ rotate: `${it.rot + 90}deg` }],
            }}
          >
            <Text style={{ color, fontSize: 18, lineHeight: 22 }}>{it.g}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
  },
});
