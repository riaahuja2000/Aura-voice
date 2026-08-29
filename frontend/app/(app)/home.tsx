// AURA-VOICE — the living oracle orb. Zero on-screen text (optional captions for accessibility).
// Gestures: hold = speak · tap = pause/continue · double-tap = replay · swipe ↑ deeper
// · swipe ↓ shorter · swipe → practical · swipe ← alternative · two-finger tap = whisper mode.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { useI18n } from "@/src/i18n";
import { useAuth } from "@/src/auth";
import { api, type Lang, type RefineDirection } from "@/src/api";
import { pauseSpeak, resumeSpeak, speakText, stopSpeak, useSpeaking } from "@/src/speech";
import { useVoiceSTT } from "@/src/voice-stt";
import { ZodiacRing } from "@/src/components/ZodiacRing";

// ------------------------------------------------------------------ THEMES
type ThemeKey = "nebula" | "aura" | "crescent";

type Theme = {
  key: ThemeKey;
  bg: [string, string, string];
  orb: [string, string, string];
  ring: string;
  glow: string;
  accent: string;
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

const DISCLOSURE: Record<Lang, string> = {
  en: "Welcome, seeker. You are speaking with an AI-generated voice guide. My readings are traditional interpretation and symbolic reflection, never guaranteed fact, and never a replacement for medical, legal or professional help. Hold the orb, and speak your question.",
  hi: "स्वागत है। आप एक ए-आई द्वारा निर्मित वॉयस गाइड से बात कर रहे हैं। मेरे उत्तर पारंपरिक व्याख्या और प्रतीकात्मक चिंतन हैं, कभी भी निश्चित तथ्य नहीं, और कभी भी चिकित्सा या पेशेवर सलाह का विकल्प नहीं। गोले को दबाकर रखें और अपना प्रश्न बोलें।",
  hng: "Swagat hai. Aap ek AI-generated voice guide se baat kar rahe hain. Mere jawab traditional vyakhya aur symbolic reflection hain, kabhi bhi guaranteed fact nahi, aur kabhi bhi medical ya professional salaah ka vikalp nahi. Orb ko hold karein aur apna sawaal bolein.",
};

const FAIL_LINE: Record<Lang, string> = {
  en: "The stars are quiet, dear seeker. Please ask again in a moment.",
  hi: "क्षमा करें, अभी सितारे मौन हैं। कृपया थोड़ी देर बाद पूछें।",
  hng: "Kshama karein, abhi sitaare maun hain. Thodi der baad pooch lein.",
};

const NO_STT_LINE: Record<Lang, string> = {
  en: "Voice recognition is not available on this device.",
  hi: "इस डिवाइस पर आवाज़ पहचान उपलब्ध नहीं है।",
  hng: "Is device par voice recognition available nahi hai.",
};

const MIC_DENIED_LINE: Record<Lang, string> = {
  en: "Please allow microphone access for this site in your browser, then hold the orb and speak.",
  hi: "कृपया अपने ब्राउज़र में इस साइट के लिए माइक्रोफ़ोन की अनुमति दें, फिर गोले को दबाकर बोलें।",
  hng: "Kripya apne browser mein is site ke liye microphone allow karein, phir orb ko hold karke bolein.",
};

const DISCLOSURE_KEY = "aura_ai_disclosure_v1";
const CAPTIONS_KEY = "aura_captions_on";

// ------------------------------------------------------------------ ORB
type OrbMode = "idle" | "listening" | "thinking" | "speaking";

function ReactiveOrb({ theme, mode, size = 260 }: { theme: Theme; mode: OrbMode; size?: number }) {
  const pulse = useSharedValue(0);
  const rot = useSharedValue(0);
  const rotBack = useSharedValue(0);
  const wobble = useSharedValue(0);

  useEffect(() => {
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
      <Animated.View style={[styles.absCenter, { width: OUTER, height: OUTER, borderRadius: OUTER }, glowStyle]}>
        <LinearGradient colors={[theme.glow, "transparent"]} style={{ flex: 1, borderRadius: OUTER }} />
      </Animated.View>

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

      <Animated.View style={[styles.absCenter, wobbleStyle]}>
        <Animated.View style={[coreStyle, { width: size, height: size, borderRadius: size }]}>
          <LinearGradient
            colors={theme.orb}
            start={{ x: 0.2, y: 0.15 }}
            end={{ x: 0.85, y: 0.9 }}
            style={{ flex: 1, borderRadius: size }}
          />
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
  const [paused, setPaused] = useState(false);
  const [whisper, setWhisper] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [caption, setCaption] = useState<{ q: string; a: string } | null>(null);

  const busyRef = useRef(false);
  const holdRef = useRef(false);
  const lastAnswerRef = useRef("");
  const whisperRef = useRef(false);
  whisperRef.current = whisper;

  // -------- speech helper (respects whisper mode + captions)
  const speak = useCallback(
    (text: string, q = "") => {
      setPaused(false);
      setCaption({ q, a: text });
      speakText(text, { lang, whisper: whisperRef.current });
    },
    [lang],
  );

  // -------- consult flow
  const onFinal = useCallback(
    async (transcript: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setPhase("thinking");
      setCaption({ q: transcript, a: "" });
      try {
        const r = await api.voiceConsult(transcript, lang);
        lastAnswerRef.current = r.answer;
        if (r.action === "rescue") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPhase("speaking");
        speak(r.answer, transcript);
      } catch (_e) {
        setPhase("idle");
        speak(FAIL_LINE[lang]);
      } finally {
        busyRef.current = false;
      }
    },
    [lang, speak],
  );

  const stt = useVoiceSTT(
    lang,
    onFinal,
    useCallback(
      (code: string) => {
        if (code === "not-allowed" || code === "service-not-allowed" || code === "permission") {
          setPhase("idle");
          speak(MIC_DENIED_LINE[lang]);
        }
      },
      [lang, speak],
    ),
  );
  const sttRef = useRef(stt);
  sttRef.current = stt;

  // -------- first-launch spoken AI disclosure
  useEffect(() => {
    (async () => {
      try {
        const [done, cap] = await Promise.all([
          AsyncStorage.getItem(DISCLOSURE_KEY),
          AsyncStorage.getItem(CAPTIONS_KEY),
        ]);
        if (cap === "1") setCaptions(true);
        if (!done) {
          await AsyncStorage.setItem(DISCLOSURE_KEY, "1");
          if (Platform.OS === "web" && typeof document !== "undefined") {
            // Browsers block audio before the first user gesture — speak the
            // AI disclosure on the visitor's first interaction instead.
            const handler = () => {
              document.removeEventListener("pointerdown", handler);
              setTimeout(() => speak(DISCLOSURE[lang]), 200);
            };
            document.addEventListener("pointerdown", handler, { once: true });
          } else {
            setTimeout(() => speak(DISCLOSURE[lang]), 800);
          }
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- phase sync
  useEffect(() => {
    if (speaking && !paused) setPhase("speaking");
    else if (!speaking && phase === "speaking" && !paused) setPhase("idle");
  }, [speaking, paused, phase]);

  useEffect(() => {
    if (stt.listening) setPhase("listening");
    else if (phase === "listening") setPhase(busyRef.current ? "thinking" : "idle");
  }, [stt.listening, phase]);

  // -------- gesture actions
  const startListening = useCallback(async () => {
    const s = sttRef.current;
    if (busyRef.current || s.listening) return;
    if (!s.available) {
      speak(NO_STT_LINE[lang]);
      return;
    }
    stopSpeak();
    setPaused(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await s.start();
    } catch {
      setPhase("idle");
    }
  }, [lang, speak]);

  const stopListening = useCallback(() => {
    const s = sttRef.current;
    if (s.listening) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      s.stop();
    }
  }, []);

  const onSingleTap = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (paused) {
      // continue
      if (!resumeSpeak()) {
        // resume unsupported (Android) → replay from start
        if (lastAnswerRef.current) speak(lastAnswerRef.current);
      } else {
        setPaused(false);
        setPhase("speaking");
      }
      return;
    }
    if (speaking) {
      // pause (barge-in)
      if (Platform.OS !== "android" && pauseSpeak()) {
        setPaused(true);
        setPhase("idle");
      } else {
        stopSpeak();
        setPaused(false);
        setPhase("idle");
      }
      return;
    }
    if (sttRef.current.listening) {
      stopListening();
      return;
    }
    // idle → tap-to-talk convenience
    startListening();
  }, [paused, speaking, speak, startListening, stopListening]);

  const onDoubleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (lastAnswerRef.current) {
      setPhase("speaking");
      speak(lastAnswerRef.current);
    }
  }, [speak]);

  const toggleWhisper = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setWhisper((w) => !w);
  }, []);

  const doRefine = useCallback(
    async (direction: RefineDirection) => {
      if (busyRef.current) return;
      busyRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      stopSpeak();
      setPaused(false);
      setPhase("thinking");
      try {
        const r = await api.voiceRefine(direction, lang);
        lastAnswerRef.current = r.answer;
        setPhase("speaking");
        speak(r.answer, r.question || "");
      } catch (_e) {
        setPhase("idle");
        speak(FAIL_LINE[lang]);
      } finally {
        busyRef.current = false;
      }
    },
    [lang, speak],
  );

  const onSwipe = useCallback(
    (dx: number, dy: number) => {
      if (Math.abs(dy) >= Math.abs(dx)) {
        doRefine(dy < 0 ? "deeper" : "shorter");
      } else {
        doRefine(dx > 0 ? "practical" : "alternative");
      }
    },
    [doRefine],
  );

  // -------- gesture composition
  const gestures = useMemo(() => {
    const hold = Gesture.LongPress()
      .minDuration(350)
      .maxDistance(90)
      .runOnJS(true)
      .onStart(() => {
        holdRef.current = true;
        startListening();
      })
      .onFinalize(() => {
        if (holdRef.current) {
          holdRef.current = false;
          stopListening();
        }
      });

    const twoFinger = Gesture.Tap()
      .minPointers(2)
      .maxDuration(600)
      .runOnJS(true)
      .onEnd((_e, ok) => {
        if (ok) toggleWhisper();
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(280)
      .runOnJS(true)
      .onEnd((_e, ok) => {
        if (ok) onDoubleTap();
      });

    const singleTap = Gesture.Tap()
      .numberOfTaps(1)
      .maxDuration(280)
      .runOnJS(true)
      .onEnd((_e, ok) => {
        if (ok) onSingleTap();
      });

    const pan = Gesture.Pan()
      .minDistance(55)
      .maxPointers(1)
      .runOnJS(true)
      .onEnd((e) => {
        if (Math.abs(e.translationX) > 40 || Math.abs(e.translationY) > 40) {
          onSwipe(e.translationX, e.translationY);
        }
      });

    return Gesture.Race(pan, hold, Gesture.Exclusive(twoFinger, doubleTap, singleTap));
  }, [startListening, stopListening, toggleWhisper, onDoubleTap, onSingleTap, onSwipe]);

  const cycleTheme = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setThemeIdx((i) => (i + 1) % THEME_ORDER.length);
  }, []);

  const toggleCaptions = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    setCaptions((c) => {
      AsyncStorage.setItem(CAPTIONS_KEY, c ? "0" : "1").catch(() => {});
      return !c;
    });
  }, []);

  // ---------------- Ambient sparkles
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

  const orbMode: OrbMode = paused ? "idle" : phase;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg[0] }}>
      <LinearGradient colors={theme.bg} style={StyleSheet.absoluteFill} />

      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <ZodiacRing size={520} color={theme.accent} opacity={0.08} duration={140000} />
        <ZodiacRing size={360} color={theme.accent} opacity={0.05} duration={95000} reverse />
      </View>

      {stars.map((s) => (
        <Twinkle key={`${themeIdx}-${s.id}`} top={s.top} left={s.left} size={s.size} delay={s.delay} accent={theme.accent} />
      ))}

      {/* Top-right controls — icon only */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable
          testID="captions-btn"
          onPress={toggleCaptions}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }, captions && styles.iconBtnOn]}
          hitSlop={12}
        >
          <Ionicons name={captions ? "eye" : "eye-off-outline"} size={22} color={theme.accent} />
        </Pressable>

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
        <GestureDetector gesture={gestures}>
          <View testID="orb-btn" collapsable={false}>
            <ReactiveOrb theme={theme} mode={orbMode} size={260} />
          </View>
        </GestureDetector>

        {/* Status row — icon only */}
        <View style={styles.statusRow} pointerEvents="none">
          <StatusIcon mode={orbMode} paused={paused} accent={theme.accent} />
          {whisper && (
            <Ionicons name="moon" size={18} color={theme.accent} style={{ opacity: 0.8, marginLeft: 14 }} />
          )}
        </View>
      </View>

      {/* Optional accessibility captions */}
      {captions && caption && (
        <View style={[styles.captionsWrap, { paddingBottom: insets.bottom + 14 }]} pointerEvents="box-none">
          <View style={styles.captionCard}>
            <ScrollView style={{ maxHeight: 170 }} showsVerticalScrollIndicator={false}>
              {!!caption.q && (
                <Text style={[styles.captionQ, { color: theme.accent }]} testID="caption-question">
                  {caption.q}
                </Text>
              )}
              {!!caption.a && (
                <Text style={styles.captionA} testID="caption-answer">
                  {caption.a}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------- small helpers ----------------
function StatusIcon({ mode, paused, accent }: { mode: OrbMode; paused: boolean; accent: string }) {
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
  if (paused) icon = "pause";
  else if (mode === "listening") icon = "mic";
  else if (mode === "thinking") icon = "sparkles";
  else if (mode === "speaking") icon = "volume-high";
  else icon = "hand-left-outline";

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
  iconBtnOn: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.30)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    marginTop: 34,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  captionsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    zIndex: 20,
  },
  captionCard: {
    backgroundColor: "rgba(5,3,14,0.78)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  captionQ: {
    fontSize: 12,
    opacity: 0.75,
    marginBottom: 6,
    fontStyle: "italic",
  },
  captionA: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    lineHeight: 21,
  },
});
