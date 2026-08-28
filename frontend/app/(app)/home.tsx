import React, { useCallback, useState } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { COLORS, FONTS, RADIUS, SPACING } from "@/theme";
import { useI18n } from "@/src/i18n";
import { useSettings } from "@/src/settings";
import { useAuth } from "@/src/auth";
import { api, type Reading } from "@/src/api";
import { speakText, stopSpeak, useSpeaking } from "@/src/speech";
import { useSTT } from "@/src/stt";
import { moonKind, moonLabelKey } from "@/src/moon";
import { Txt, useToast } from "@/src/ui";
import { BrandBackdrop } from "@/src/components/BrandBackdrop";
import { LangSwitcher } from "@/src/components/LangSwitcher";
import { VoiceOrb, type OrbState } from "@/src/components/VoiceOrb";

type Phase = "idle" | "consulting";

export default function Home() {
  const { t, topicLabel, lang } = useI18n();
  const { settings } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const speaking = useSpeaking();

  const [phase, setPhase] = useState<Phase>("idle");
  const [reading, setReading] = useState<Reading | null>(null);
  const [text, setText] = useState("");

  const ask = useCallback(
    async (raw: string) => {
      const q = (raw || "").trim();
      if (!q) {
        toast.show(t("ask_something"), "error");
        return;
      }
      Keyboard.dismiss();
      setPhase("consulting");
      setReading(null);
      stopSpeak();
      try {
        const r = await api.consult(q, lang);
        setReading(r);
        setPhase("idle");
        speakText(r.answer, { lang, rate: user?.speed, voice: user?.voice });
      } catch (e: any) {
        setPhase("idle");
        toast.show(e?.message || t("try_again"), "error");
      }
    },
    [lang, t, toast, user?.speed, user?.voice],
  );

  const stt = useSTT(lang, (finalText) => {
    setText(finalText);
    ask(finalText);
  });

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopSpeak();
        stt.stop();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const orbState: OrbState = stt.listening
    ? "listening"
    : phase === "consulting"
      ? "processing"
      : speaking
        ? "speaking"
        : "idle";

  const onOrb = async () => {
    if (phase === "consulting") return;
    if (stt.listening) {
      stt.stop();
      return;
    }
    if (speaking) {
      stopSpeak();
      return;
    }
    if (!stt.available) {
      toast.show(t("voice_needs_build"), "info");
      return;
    }
    setReading(null);
    setText("");
    try {
      await stt.start();
    } catch (e: any) {
      if (e?.message === "permission") toast.show(t("mic_permission"), "error");
      else toast.show(t("voice_needs_build"), "info");
    }
  };

  const askAgain = () => {
    stopSpeak();
    setReading(null);
    setText("");
    setPhase("idle");
  };

  const stateLabel = stt.listening
    ? t("listening")
    : phase === "consulting"
      ? t("consulting")
      : speaking
        ? t("velora_speaks")
        : t("tap_to_speak");

  const moon = moonKind();

  return (
    <BrandBackdrop scrim="heavy">
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + SPACING.md, paddingBottom: SPACING.xxl, paddingHorizontal: SPACING.xl }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.moonPill}>
            <Ionicons name="moon" size={13} color={COLORS.goldSoft} />
            <Txt font="bodyMedium" style={styles.moonTxt}>{t(moonLabelKey(moon))}</Txt>
          </View>
          <LangSwitcher compact />
        </View>

        <View style={styles.hero}>
          <Txt font="displayBold" style={styles.brand}>{settings.app_name || "VELORA"}</Txt>
          <Txt font="bodyMedium" style={styles.tagline}>{settings.tagline}</Txt>
        </View>

        <View style={styles.center}>
          <Txt font="displayMedium" style={styles.stateLabel}>{stateLabel}</Txt>
          <VoiceOrb state={orbState} onPress={onOrb} disabled={phase === "consulting"} />

          {!reading ? (
            <Animated.View entering={FadeIn} style={styles.composer}>
              <View style={styles.inputWrap}>
                <Ionicons name="sparkles-outline" size={16} color={COLORS.pink} />
                <TextInput
                  testID="ask-input"
                  value={text}
                  onChangeText={setText}
                  placeholder={t("ask_placeholder")}
                  placeholderTextColor={COLORS.muted}
                  onSubmitEditing={() => ask(text)}
                  returnKeyType="send"
                  multiline
                  style={styles.input}
                />
                <Pressable testID="ask-send" onPress={() => ask(text)} style={styles.send}>
                  <Feather name="arrow-up" size={18} color={COLORS.onGold} />
                </Pressable>
              </View>
              <Txt font="body" style={styles.hint}>
                {stt.listening ? t("auto_hint") : stt.available ? t("speak_hint") : t("type_hint")}
              </Txt>
            </Animated.View>
          ) : (
            <Txt font="body" style={[styles.hint, { marginTop: SPACING.lg }]}>
              {speaking ? t("speaking_hint") : ""}
            </Txt>
          )}
        </View>
      </KeyboardAwareScrollView>

      {reading ? (
        <Animated.View entering={SlideInDown.springify().damping(18)} style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={styles.sheetHandle} />
          <KeyboardAwareScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingBottom: SPACING.md }} showsVerticalScrollIndicator={false}>
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
          </KeyboardAwareScrollView>

          <View style={styles.sheetActions}>
            {speaking ? (
              <Pressable testID="answer-stop" style={styles.actionBtn} onPress={stopSpeak}>
                <Feather name="square" size={16} color={COLORS.gold} />
                <Txt font="bodyBold" style={styles.actionTxt}>{t("stop")}</Txt>
              </Pressable>
            ) : (
              <Pressable testID="answer-replay" style={styles.actionBtn} onPress={() => speakText(reading.answer, { lang, rate: user?.speed, voice: user?.voice })}>
                <Feather name="play" size={16} color={COLORS.gold} />
                <Txt font="bodyBold" style={styles.actionTxt}>{t("replay_audio")}</Txt>
              </Pressable>
            )}
            <Pressable testID="answer-ask-again" style={[styles.actionBtn, styles.actionPrimary]} onPress={askAgain}>
              <Feather name="refresh-cw" size={16} color={COLORS.onGold} />
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
  moonPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(18,18,26,0.6)", borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.glassLine, paddingHorizontal: SPACING.md, paddingVertical: 7 },
  moonTxt: { color: COLORS.goldSoft, fontSize: 11, letterSpacing: 0.3 },
  hero: { alignItems: "center", marginTop: SPACING.xl },
  brand: { fontSize: 46, color: COLORS.onSurface, letterSpacing: 4 },
  tagline: { color: COLORS.gold, fontSize: 12, letterSpacing: 2, marginTop: 2, textTransform: "uppercase" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.md },
  stateLabel: { color: COLORS.onSurface2, fontSize: 22, letterSpacing: 1 },
  composer: { width: "100%", alignItems: "center", gap: SPACING.md },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, width: "100%", backgroundColor: "rgba(18,18,26,0.82)", borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.glassLine, paddingLeft: SPACING.lg, paddingRight: 6, paddingVertical: 6, minHeight: 54 },
  input: { flex: 1, color: COLORS.onSurface, fontFamily: FONTS.body, fontSize: 15, maxHeight: 96 },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, alignItems: "center", justifyContent: "center" },
  hint: { color: COLORS.onSurface3, fontSize: 13, textAlign: "center", lineHeight: 19, paddingHorizontal: SPACING.lg },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: COLORS.glass, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.glassLine, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  sheetHandle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SPACING.md },
  topicRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md, flexWrap: "wrap" },
  topicChip: { backgroundColor: COLORS.pinkDeep, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 5 },
  topicChipTxt: { color: COLORS.goldSoft, fontSize: 11, letterSpacing: 0.4 },
  qLabel: { color: COLORS.gold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  qText: { color: COLORS.onSurface2, fontSize: 15, lineHeight: 21 },
  divider: { height: 1, backgroundColor: COLORS.divider, marginVertical: SPACING.lg },
  answer: { color: COLORS.onSurface, fontSize: 21, lineHeight: 31 },
  sheetActions: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.lg },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, height: 50, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gold, backgroundColor: "transparent" },
  actionPrimary: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  actionTxt: { color: COLORS.gold, fontSize: 14 },
});
