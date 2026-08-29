// AURELIA — voice-only oracle home.
// Zero on-screen text (except tiny icon-only controls). Pure voice loop:
//   tap orb -> listen -> Claude Sonnet 4.6 -> speak the answer.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { useI18n } from "@/src/i18n";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { speakText, stopSpeak, useSpeaking } from "@/src/speech";
import { useVoiceSTT } from "@/src/voice-stt";
import { ZodiacRing } from "@/src/components/ZodiacRing";

// ------------------------------------------------------------------ THEMES
type ThemeKey = "nebula" | "aura" | "crescent";

type Theme = {
  key: ThemeKey;
  bg: [string, string, string];        // radial-ish backdrop
  orb: [string, string, string];       // main orb gradient
  ring: string;                        // outer ring stroke
  glow: string;                        // outer glow color
  accent: string;                      // small ui icons
};

const THEMES: Record<ThemeKey, Theme> = {
  nebula: {
    key: "nebula",
    bg: ["#05000E", "#0B0322", "#1A0733"],
    orb: ["#8A4CFF", "#4C6BFF", "#FF3D9E"],
    ring: "rgba(190,140,255,0.55)",
    glow: "rgba(140,90,255,0.55)",
    accent: "#C9B8FF",
  },
  aura: {
    key: "aura",
    bg: ["#0A0002", "#170603", "#2A0A0A"],
    orb: ["#FF3B3B", "#FF9F1C", "#FFD166"],
    ring: "rgba(255,180,120,0.65)",
    glow: "rgba(255,120,60,0.55)",
    accent: "#FFD9A8",
  },
  crescent: {
    key: "crescent",
    bg: ["#02030A", "#0A0F1F", "#151B2D"],
    orb: ["#F2F5FF", "#B7C0DA", "#5C6480"],
    ring: "rgba(230,235,255,0.70)",
    glow: "rgba(220,225,255,0.40)",
    accent: "#DDE4FF",
  },
};

const THEME_ORDER: ThemeKey[] = ["nebula", "aura", "crescent"];

// ------------------------------------------------------------------ ORB
type OrbMode = "idle" | "listening" | "thinking" | "speaking";

function ReactiveOrb({ theme, mode, size = 260 }: { theme: Theme; mode: OrbMode; size?: number }) {
  const pulse = useSharedValue(0);
  const rot = useSharedValue(0);
  const rotBack = useSharedValue(0);
  const wobble = useSharedValue(0);

  useEffect(() => {
    // idle: gentle 4s breath; listening/speaking: quick 0.9s pulse; thinking: 1.6s
    const period =
      mode === "listening" ? 900 : mode === "speaking" ? 1100 : mode === "thinking" ? 1600 : 3800;
    cancelAnimation(pulse);
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.quad) }), -1, true);

    cancelAnimation(rot);
    rot.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.linear }), -1, false);

    cancelAnimation(rotBack);
    rotBack.value = withRepeat(withTiming(1, { duration: 34000, easing: Easing.linear }), -1, false);

    cancelAnimation(wobble);
    wobble.value = withRepeat(
      withTiming(1, { duration: mode === "listening" ? 1300 : 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [mode, pulse, rot, rotBack, wobble]);

  const coreStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], mode === "idle" ? [0.97, 1.03] : [0.9, 1.12]);
    return { transform: [{ scale }] };
  });

  const glowStyle = useAnimatedStyle(() => {
    const s = interpolate(pulse.value, [0, 1], mode === "idle" ? [1.0, 1.15] : [1.0, 1.35]);
    const o = interpolate(pulse.value, [0, 1], mode === "idle" ? [0.4, 0.7] : [0.5, 0.95]);
    return { transform: [{ scale: s }], opacity: o };
  });

  const ring1Style = useAnimatedStyle(() => {
    const deg = interpolate(rot.value, [0, 1], [0, 360]);
    const s = interpolate(pulse.value, [0, 1], [1.0, 1.05]);
    return { transform: [{ rotate: `${deg}deg` }, { scale: s }] };
  });

  const ring2Style = useAnimatedStyle(() => {
    const deg = interpolate(rotBack.value, [0, 1], [360, 0]);
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  const wobbleStyle = useAnimatedStyle(() => {
    const t = interpolate(wobble.value, [0, 1], [-1, 1]);
    return { transform: [{ translateY: t * (mode === "listening" ? 6 : 3) }] };
  });

  const OUTER = size * 1.55;
  const RING2 = size * 1.28;
  const RING1 = size * 1.12;

  const isCrescent = theme.key === "crescent";

  return (
    <View style={[styles.orbWrap, { width: OUTER, height: OUTER }]} pointerEvents="none">
      {/* Outer glow halo */}
      <Animated.View style={[styles.absCenter, { width: OUTER, height: OUTER, borderRadius: OUTER }, glowStyle]}>
        <LinearGradient
          colors={[theme.glow, "transparent"]}
          style={{ flex: 1, borderRadius: OUTER }}
        />
      </Animated.View>

      {/* Slow rotating outer ring */}
      <Animated.View
        style={[
          styles.absCenter,
          {
            width: RING2,
            height: RING2,
            borderRadius: RING2,
            borderWidth: 1,
            borderColor: theme.ring,
            borderStyle: "dashed",
            opacity: 0.55,
          },
          ring2Style,
        ]}
      />

      {/* Counter rotating inner ring */}
      <Animated.View
        style={[
          styles.absCenter,
          {
            width: RING1,
            height: RING1,
            borderRadius: RING1,
            borderWidth: 1,
            borderColor: theme.ring,
            opacity: 0.85,
          },
          ring1Style,
        ]}
      />

      {/* Wobbling core */}
      <Animated.View style={[styles.absCenter, wobbleStyle]}>
        <Animated.View style={[coreStyle, { width: size, height: size, borderRadius: size }]}>
          <LinearGradient
            colors={theme.orb}
            start={{ x: 0.2, y: 0.15 }}
            end={{ x: 0.85, y: 0.9 }}
            style={{ flex: 1, borderRadius: size }}
          />
          {/* highlight sheen */}
          <View
            style={{
              position: "absolute",
              top: size * 0.12,
              left: size * 0.18,
              width: size * 0.4,
              height: size * 0.22,
              borderRadius: size * 0.22,
              backgroundColor: "rgba(255,255,255,0.28)",
              transform: [{ rotate: "-20deg" }],
            }}
          />
          {/* crescent overlay */}
          {isCrescent && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: -size * 0.22,
                width: size,
                height: size,
                borderRadius: size,
                backgroundColor: "#02030A",
              }}
            />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ------------------------------------------------------------------ SCREEN
export default function VoiceHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useI18n();
  const { user, logout } = useAuth();
  const speaking = useSpeaking();

  const [themeIdx, setThemeIdx] = useState(0);
  const theme = THEMES[THEME_ORDER[themeIdx]];

  const [phase, setPhase] = useState<OrbMode>("idle");
  const busyRef = useRef(false);

  const onFinal = useCallback(
    async (transcript: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setPhase("thinking");
      try {
        const r = await api.voiceConsult(transcript, lang);
        setPhase("speaking");
        speakText(r.answer, { lang });
      } catch (_e) {
        setPhase("idle");
        // Speak a graceful failure message
        speakText(
          lang === "hi"
            ? "क्षमा करें, अभी सितारे मौन हैं। कृपया थोड़ी देर बाद पूछें।"
            : lang === "hng"
              ? "Kshama karein, abhi sitaare maun hain. Thodi der baad pooch lein."
              : "The stars are quiet, dear seeker. Please ask again in a moment.",
          { lang },
        );
      } finally {
        busyRef.current = false;
      }
    },
    [lang],
  );

  const stt = useVoiceSTT(lang, onFinal);

  // Sync phase with speaking status
  useEffect(() => {
    if (speaking) setPhase("speaking");
    else if (phase === "speaking") setPhase("idle");
  }, [speaking, phase]);

  useEffect(() => {
    if (stt.listening) setPhase("listening");
    else if (phase === "listening") setPhase(busyRef.current ? "thinking" : "idle");
  }, [stt.listening, phase]);

  const onOrbTap = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // If speaking, tap silences the oracle
    if (speaking) {
      stopSpeak();
      setPhase("idle");
      return;
    }
    // Toggle listening
    if (stt.listening) {
      stt.stop();
      return;
    }
    if (!stt.available) {
      speakText(
        lang === "hi"
          ? "इस डिवाइस पर आवाज़ पहचान उपलब्ध नहीं है।"
          : lang === "hng"
            ? "Is device par voice recognition available nahi hai."
            : "Voice recognition is not available on this device.",
        { lang },
      );
      return;
    }
    try {
      // Small welcoming chime (spoken)
      stopSpeak();
      await stt.start();
    } catch (_e) {
      setPhase("idle");
    }
  }, [speaking, stt, lang]);

  const cycleTheme = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setThemeIdx((i) => (i + 1) % THEME_ORDER.length);
  }, []);

  const onLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    cycleTheme();
  }, [cycleTheme]);

  // ---------------- Ambient sparkles (tiny stars)
  const stars = useMemo(
    () =>
      new Array(28).fill(0).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 1 + Math.random() * 2.4,
        delay: Math.random() * 1600,
      })),
    [themeIdx],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg[0] }}>
      <LinearGradient colors={theme.bg} style={StyleSheet.absoluteFill} />

      {/* Zodiac watermark rings */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <ZodiacRing size={520} color={theme.accent} opacity={0.08} duration={140000} />
        <ZodiacRing size={360} color={theme.accent} opacity={0.05} duration={95000} reverse />
      </View>

      {/* Tiny stars */}
      {stars.map((s) => (
        <Twinkle key={`${themeIdx}-${s.id}`} top={s.top} left={s.left} size={s.size} delay={s.delay} accent={theme.accent} />
      ))}

      {/* Top-right controls — icon only, no text */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable
          testID="theme-btn"
          onPress={cycleTheme}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          hitSlop={12}
        >
          <Ionicons name="color-palette-outline" size={22} color={theme.accent} />
        </Pressable>

        {user?.is_owner && (
          <Pressable
            testID="owner-btn"
            onPress={() => router.push("/owner" as any)}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            hitSlop={12}
          >
            <Ionicons name="shield-outline" size={22} color={theme.accent} />
          </Pressable>
        )}

        <Pressable
          testID="logout-btn"
          onPress={async () => {
            stopSpeak();
            await logout();
            router.replace("/login" as any);
          }}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          hitSlop={12}
        >
          <Ionicons name="log-out-outline" size={22} color={theme.accent} />
        </Pressable>
      </View>

      {/* Center orb — the ENTIRE interaction */}
      <View style={styles.center}>
        <Pressable
          testID="orb-btn"
          onPress={onOrbTap}
          onLongPress={onLongPress}
          delayLongPress={450}
          hitSlop={20}
        >
          <ReactiveOrb theme={theme} mode={phase} size={260} />
        </Pressable>

        {/* Status ring around orb — icon only */}
        <View style={styles.statusRow} pointerEvents="none">
          <StatusIcon mode={phase} accent={theme.accent} />
        </View>
      </View>
    </View>
  );
}

// ---------------- small helpers ----------------
function StatusIcon({ mode, accent }: { mode: OrbMode; accent: string }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: mode === "thinking" ? 900 : 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [mode, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: interpolate(opacity.value, [0, 1], [0.35, 1]) }));

  let icon: keyof typeof Ionicons.glyphMap = "ellipse-outline";
  if (mode === "listening") icon = "mic";
  else if (mode === "thinking") icon = "sparkles";
  else if (mode === "speaking") icon = "volume-high";
  else icon = "hand-left-outline"; // tap prompt

  return (
    <Animated.View style={style}>
      <Ionicons name={icon} size={26} color={accent} />
    </Animated.View>
  );
}

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
        withTiming(1, { duration: 1600 + Math.random() * 1400, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    }, delay);
    return () => clearTimeout(t);
  }, [v, delay]);
  const s = useAnimatedStyle(() => ({ opacity: interpolate(v.value, [0, 1], [0.15, 0.95]) }));
  return (
    <Animated.View
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

// ------------------------------------------------------------------ styles
const styles = StyleSheet.create({
  orbWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  absCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  topBar: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 18,
    zIndex: 10,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    marginTop: 34,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
