import React, { useCallback, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView } from "react-native-gesture-handler";
import { useFocusEffect } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { COLORS, RADIUS, SPACING } from "@/theme";
import { useI18n } from "@/src/i18n";
import { useSettings } from "@/src/settings";
import { api, mediaUrl, type Reading } from "@/src/api";
import { useAudio } from "@/src/audio";
import { moonKind, moonLabelKey } from "@/src/moon";
import { Txt, useToast } from "@/src/ui";
import { BrandBackdrop } from "@/src/components/BrandBackdrop";
import { LangSwitcher } from "@/src/components/LangSwitcher";
import { VoiceOrb, type OrbState } from "@/src/components/VoiceOrb";

type Phase = "idle" | "listening" | "processing";

export default function Home() {
  const { t, topicLabel, lang } = useI18n();
  const { settings } = useSettings();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const audio = useAudio();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [phase, setPhase] = useState<Phase>("idle");
  const [reading, setReading] = useState<Reading | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const orbState: OrbState =
    phase === "listening" ? "listening" : phase === "processing" ? "processing" : audio.playing || audio.loading ? "speaking" : "idle";

  useFocusEffect(
    useCallback(() => {
      return () => {
        audio.stop();
        recorder.stop?.().catch?.(() => {});
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const moon = moonKind();

  const ensureMic = async (): Promise<boolean> => {
    const current = await AudioModule.getRecordingPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain) {
      const req = await AudioModule.requestRecordingPermissionsAsync();
      if (req.granted) return true;
      if (!req.canAskAgain) {
        toast.show(t("mic_permission"), "error");
        Linking.openSettings().catch(() => {});
      } else {
        toast.show(t("mic_permission"), "error");
      }
      return false;
    }
    toast.show(t("mic_permission"), "error");
    Linking.openSettings().catch(() => {});
    return false;
  };

  const startListening = async () => {
    const ok = await ensureMic();
    if (!ok) return;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setReading(null);
      setPhase("listening");
    } catch {
      toast.show(t("try_again"), "error");
      setPhase("idle");
    }
  };

  const stopAndProcess = async () => {
    setPhase("processing");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("no-audio");
      const fname = uri.split("/").pop() || "question.m4a";
      const type = fname.endsWith(".webm")
        ? "audio/webm"
        : fname.endsWith(".wav")
          ? "audio/wav"
          : fname.endsWith(".mp3")
            ? "audio/mpeg"
            : "audio/m4a";
      const { text } = await api.transcribe(uri, lang, fname, type);
      if (!text || !text.trim()) {
        toast.show(t("couldnt_hear"), "error");
        setPhase("idle");
        return;
      }
      const r = await api.consult(text.trim(), lang);
      setReading(r);
      const { url } = await api.speak(r.answer, lang);
      const full = mediaUrl(url);
      setAudioUrl(full);
      setPhase("idle");
      await audio.play(full);
    } catch (e: any) {
      setPhase("idle");
      toast.show(e?.message || t("couldnt_hear"), "error");
    }
  };

  const onOrb = () => {
    if (phase === "processing") return;
    if (phase === "listening") {
      stopAndProcess();
    } else if (!reading) {
      startListening();
    } else {
      // a reading is showing; start a fresh question
      askAgain();
      setTimeout(startListening, 60);
    }
  };

  const replay = async () => {
    if (!audioUrl) return;
    Haptics.selectionAsync().catch(() => {});
    try {
      await audio.play(audioUrl);
    } catch {
      toast.show(t("try_again"), "error");
    }
  };

  const askAgain = () => {
    audio.stop();
    setReading(null);
    setAudioUrl(null);
    setPhase("idle");
  };

  const stateLabel =
    phase === "listening"
      ? t("listening")
      : phase === "processing"
        ? t("consulting")
        : orbState === "speaking"
          ? t("velora_speaks")
          : t("tap_to_speak");

  return (
    <BrandBackdrop scrim="heavy">
      <View style={{ flex: 1, paddingTop: insets.top + SPACING.md, paddingHorizontal: SPACING.xl }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.moonPill}>
            <Ionicons name="moon" size={13} color={COLORS.goldSoft} />
            <Txt font="bodyMedium" style={styles.moonTxt}>{t(moonLabelKey(moon))}</Txt>
          </View>
          <LangSwitcher compact />
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Txt font="displayBold" style={styles.brand}>{settings.app_name || "VELORA"}</Txt>
          <Txt font="bodyMedium" style={styles.tagline}>{settings.tagline}</Txt>
        </View>

        {/* Center cluster */}
        <View style={styles.center}>
          <Txt font="displayMedium" style={styles.stateLabel}>{stateLabel}</Txt>
          <VoiceOrb state={orbState} onPress={onOrb} disabled={phase === "processing"} />
          {!reading ? (
            <Animated.View entering={FadeIn}>
              <Txt font="body" style={styles.hint}>
                {phase === "listening" ? "" : t("speak_hint")}
              </Txt>
            </Animated.View>
          ) : orbState === "speaking" ? (
            <Txt font="body" style={styles.hint}>{t("speaking_hint")}</Txt>
          ) : (
            <View style={{ height: 20 }} />
          )}
        </View>
      </View>

      {/* Answer sheet */}
      {reading ? (
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}
        >
          <View style={styles.sheetHandle} />
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingBottom: SPACING.md }} showsVerticalScrollIndicator={false}>
            <View style={styles.topicRow}>
              {reading.topics.slice(0, 3).map((tp) => (
                <View key={tp} style={styles.topicChip}>
                  <Txt font="bodyMedium" style={styles.topicChipTxt}>{topicLabel(tp)}</Txt>
                </View>
              ))}
            </View>
            <Txt font="bodyBold" style={styles.qLabel}>{t("your_question")}</Txt>
            <Txt font="body" style={styles.qText}>{reading.question}</Txt>
            <View style={styles.divider} />
            <Txt font="bodyBold" style={styles.qLabel}>{t("oracle_answer")}</Txt>
            <Txt font="displayMedium" style={styles.answer}>{reading.answer}</Txt>
          </ScrollView>

          <View style={styles.sheetActions}>
            {audio.playing ? (
              <Pressable testID="answer-stop" style={styles.actionBtn} onPress={audio.stop}>
                <Feather name="square" size={16} color={COLORS.gold} />
                <Txt font="bodyBold" style={styles.actionTxt}>{t("stop")}</Txt>
              </Pressable>
            ) : (
              <Pressable testID="answer-replay" style={styles.actionBtn} onPress={replay}>
                <Feather name="play" size={16} color={COLORS.gold} />
                <Txt font="bodyBold" style={styles.actionTxt}>{t("replay_audio")}</Txt>
              </Pressable>
            )}
            <Pressable testID="answer-ask-again" style={[styles.actionBtn, styles.actionPrimary]} onPress={() => { askAgain(); setTimeout(startListening, 60); }}>
              <Feather name="mic" size={16} color={COLORS.onGold} />
              <Txt font="bodyBold" style={[styles.actionTxt, { color: COLORS.onGold }]}>{t("ask_again")}</Txt>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </BrandBackdrop>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  moonPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(18,18,26,0.6)", borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.glassLine, paddingHorizontal: SPACING.md, paddingVertical: 7,
  },
  moonTxt: { color: COLORS.goldSoft, fontSize: 11, letterSpacing: 0.3 },
  hero: { alignItems: "center", marginTop: SPACING.xl },
  brand: { fontSize: 46, color: COLORS.onSurface, letterSpacing: 4 },
  tagline: { color: COLORS.gold, fontSize: 12, letterSpacing: 2, marginTop: 2, textTransform: "uppercase" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.md },
  stateLabel: { color: COLORS.onSurface2, fontSize: 22, letterSpacing: 1 },
  hint: { color: COLORS.onSurface3, fontSize: 13, textAlign: "center", lineHeight: 19, paddingHorizontal: SPACING.xl },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.glass, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.glassLine, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md,
  },
  sheetHandle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SPACING.md },
  topicRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md, flexWrap: "wrap" },
  topicChip: { backgroundColor: COLORS.pinkDeep, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 5 },
  topicChipTxt: { color: COLORS.goldSoft, fontSize: 11, letterSpacing: 0.4 },
  qLabel: { color: COLORS.gold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  qText: { color: COLORS.onSurface2, fontSize: 15, lineHeight: 21 },
  divider: { height: 1, backgroundColor: COLORS.divider, marginVertical: SPACING.lg },
  answer: { color: COLORS.onSurface, fontSize: 21, lineHeight: 31 },
  sheetActions: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.lg },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    height: 50, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gold, backgroundColor: "transparent",
  },
  actionPrimary: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  actionTxt: { color: COLORS.gold, fontSize: 14 },
});
