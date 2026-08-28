import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SPACING } from "@/theme";
import { useI18n } from "@/src/i18n";
import { api, mediaUrl, type Reading } from "@/src/api";
import { useAudio } from "@/src/audio";
import { Txt, useToast } from "@/src/ui";

export default function Journal() {
  const { t, topicLabel } = useI18n();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const audio = useAudio();

  const [rows, setRows] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.readings();
      setRows(data);
    } catch (e: any) {
      toast.show(e?.message || t("try_again"), "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      return () => audio.stop();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const play = async (r: Reading) => {
    setBusy(r.id);
    try {
      const { url } = await api.speak(r.answer, r.lang);
      setPlayingId(r.id);
      await audio.play(mediaUrl(url));
    } catch (e: any) {
      toast.show(e?.message || t("try_again"), "error");
    } finally {
      setBusy(null);
    }
  };

  const dateStr = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  };

  const renderItem = ({ item }: { item: Reading }) => {
    const isOpen = expanded === item.id;
    const isThisPlaying = playingId === item.id && audio.playing;
    return (
      <View style={styles.card} testID={`reading-${item.id}`}>
        <View style={styles.cardTop}>
          <View style={styles.topics}>
            {item.topics.slice(0, 2).map((tp) => (
              <View key={tp} style={styles.chip}>
                <Txt font="bodyMedium" style={styles.chipTxt}>{topicLabel(tp)}</Txt>
              </View>
            ))}
          </View>
          <Txt font="body" style={styles.date}>{dateStr(item.created_at)}</Txt>
        </View>

        <Txt font="displaySemibold" style={styles.question}>{item.question}</Txt>
        <Txt font="body" style={styles.answer} numberOfLines={isOpen ? undefined : 3}>
          {item.answer}
        </Txt>

        <View style={styles.cardActions}>
          <Pressable testID={`replay-${item.id}`} style={styles.rowBtn} onPress={() => (isThisPlaying ? audio.stop() : play(item))}>
            {busy === item.id ? (
              <ActivityIndicator size="small" color={COLORS.gold} />
            ) : (
              <Feather name={isThisPlaying ? "square" : "play"} size={15} color={COLORS.gold} />
            )}
            <Txt font="bodyBold" style={styles.rowBtnTxt}>{isThisPlaying ? t("stop") : t("replay_audio")}</Txt>
          </Pressable>
          <Pressable style={styles.expandBtn} onPress={() => setExpanded(isOpen ? null : item.id)}>
            <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={COLORS.muted} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <Txt font="displayBold" style={styles.title}>{t("journal_title")}</Txt>
        <Txt font="body" style={styles.subtitle}>{t("journal_subtitle")}</Txt>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="sparkles-outline" size={40} color={COLORS.pink} />
          <Txt font="displayMedium" style={styles.emptyTxt}>{t("journal_empty")}</Txt>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: SPACING.xl, paddingBottom: SPACING.xxl, gap: SPACING.md }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={COLORS.gold}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  title: { fontSize: 34, color: COLORS.onSurface },
  subtitle: { color: COLORS.onSurface3, fontSize: 13, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xxl, gap: SPACING.lg },
  emptyTxt: { color: COLORS.onSurface3, fontSize: 20, textAlign: "center", lineHeight: 28 },
  card: {
    backgroundColor: COLORS.surface2, borderRadius: RADIUS.lg, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  topics: { flexDirection: "row", gap: 6 },
  chip: { backgroundColor: COLORS.pinkDeep, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 4 },
  chipTxt: { color: COLORS.goldSoft, fontSize: 10, letterSpacing: 0.4 },
  date: { color: COLORS.muted, fontSize: 12 },
  question: { color: COLORS.onSurface, fontSize: 20, lineHeight: 26, marginBottom: SPACING.sm },
  answer: { color: COLORS.onSurface3, fontSize: 14, lineHeight: 21 },
  cardActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACING.md },
  rowBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  rowBtnTxt: { color: COLORS.gold, fontSize: 13 },
  expandBtn: { padding: SPACING.xs },
});
