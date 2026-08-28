import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/theme";

export type OrbState = "idle" | "consulting" | "speaking";

const SIZE = 188;

function Ring({ delay, active }: { delay: number; active: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (active) {
      p.value = 0;
      p.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.ease) }), -1, false);
    } else {
      cancelAnimation(p);
      p.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(p);
  }, [active, p]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + p.value * 0.6 }],
    opacity: (1 - p.value) * 0.5,
  }));
  return <Animated.View style={[styles.ring, style]} pointerEvents="none" />;
}

function Wave({ index, active }: { index: number; active: boolean }) {
  const h = useSharedValue(0.3);
  useEffect(() => {
    if (active) {
      h.value = withRepeat(
        withTiming(1, { duration: 420 + index * 90, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(0.3, { duration: 200 });
    }
    return () => cancelAnimation(h);
  }, [active, h, index]);
  const style = useAnimatedStyle(() => ({ height: 10 + h.value * 34 }));
  return <Animated.View style={[styles.waveBar, style]} />;
}

export function VoiceOrb({
  state,
  onPress,
  disabled,
}: {
  state: OrbState;
  onPress: () => void;
  disabled?: boolean;
}) {
  const breathe = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(breathe);
  }, [breathe]);

  useEffect(() => {
    if (state === "consulting") {
      spin.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(spin);
      spin.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(spin);
  }, [state, spin]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.035 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
    opacity: 0.5 + breathe.value * 0.35,
  }));

  return (
    <Pressable
      testID="voice-orb"
      onPress={() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      style={styles.wrap}
    >
      <Ring delay={0} active={state !== "idle"} />
      <Ring delay={900} active={state !== "idle"} />

      <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none">
        <LinearGradient
          colors={[COLORS.gold, "transparent", COLORS.pink, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill as any}
        />
      </Animated.View>

      <Animated.View style={[styles.core, coreStyle]}>
        <LinearGradient
          colors={["#241826", COLORS.pinkDeep, "#100a12"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.coreGradient}
        >
          {state === "speaking" ? (
            <View style={styles.waves}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Wave key={i} index={i} active />
              ))}
            </View>
          ) : (
            <Ionicons
              name={state === "consulting" ? "sparkles-outline" : "flower-outline"}
              size={54}
              color={COLORS.goldSoft}
            />
          )}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE + 80, height: SIZE + 80, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  halo: {
    position: "absolute",
    width: SIZE + 26,
    height: SIZE + 26,
    borderRadius: SIZE,
    overflow: "hidden",
  },
  core: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.glassLine,
  },
  coreGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  waves: { flexDirection: "row", alignItems: "center", gap: 7, height: 48 },
  waveBar: { width: 5, borderRadius: 3, backgroundColor: COLORS.goldSoft },
});
