import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { COLORS, RADIUS, SPACING } from "@/theme";
import { useI18n } from "@/src/i18n";
import { api, mediaUrl } from "@/src/api";
import { useSettings } from "@/src/settings";
import { Btn, Field, Txt, useToast } from "@/src/ui";

const VOICES = ["shimmer", "coral", "nova", "sage", "fable", "alloy", "echo", "onyx", "ash"];
const SPEEDS = [0.85, 0.95, 1.0, 1.15];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

export default function Owner() {
  const { t, topicLabel, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { settings, refresh: refreshSettings, set: setSettings } = useSettings();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // knowledge
  const [kb, setKb] = useState<any>(null);
  const [kTopic, setKTopic] = useState("tarot");
  const [kText, setKText] = useState("");
  const [addingK, setAddingK] = useState(false);
  const [uploadingKb, setUploadingKb] = useState(false);

  // branding form
  const [appName, setAppName] = useState(settings.app_name);
  const [tagline, setTagline] = useState(settings.tagline);
  const [subtitle, setSubtitle] = useState(settings.subtitle);
  const [voice, setVoice] = useState(settings.voice);
  const [speed, setSpeed] = useState(settings.speed);
  const [savingBrand, setSavingBrand] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "background" | null>(null);

  // reset modal
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [newPass, setNewPass] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, k] = await Promise.all([api.ownerOverview(), api.knowledge()]);
      setData(d);
      setKb(k);
    } catch (e: any) {
      toast.show(e?.message || t("try_again"), "error");
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const addKnowledge = async () => {
    if (kText.trim().length < 8) {
      toast.show(t("answer_text"), "error");
      return;
    }
    setAddingK(true);
    try {
      await api.addKnowledge(kTopic, lang, kText.trim());
      setKText("");
      toast.show(t("entry_added"), "success");
      const k = await api.knowledge();
      setKb(k);
    } catch (e: any) {
      toast.show(e?.message || t("try_again"), "error");
    } finally {
      setAddingK(false);
    }
  };

  const deleteKnowledge = async (id: string) => {
    try {
      await api.deleteKnowledge(id);
      setKb(await api.knowledge());
    } catch (e: any) {
      toast.show(e?.message || t("try_again"), "error");
    }
  };

  const uploadKb = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploadingKb(true);
    try {
      await api.uploadKnowledge(a.uri, a.name || "knowledge.bin", a.mimeType || "application/octet-stream");
      toast.show(t("kb_uploaded"), "success");
      setKb(await api.knowledge());
    } catch (e: any) {
      toast.show(e?.message || t("try_again"), "error");
    } finally {
      setUploadingKb(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
      setAppName(settings.app_name);
      setTagline(settings.tagline);
      setSubtitle(settings.subtitle);
      setVoice(settings.voice);
      setSpeed(settings.speed);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  const saveBranding = async () => {
    setSavingBrand(true);
    try {
      const updated = await api.updateSettings({ app_name: appName, tagline, subtitle, voice, speed });
      setSettings({ ...settings, ...updated });
      toast.show(t("published"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("try_again"), "error");
    } finally {
      setSavingBrand(false);
    }
  };

  const pickImage = async (kind: "logo" | "background") => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      if (perm.canAskAgain) {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = req.status;
        if (status !== "granted" && !req.canAskAgain) {
          toast.show(t("permission_photos"), "error");
          Linking.openSettings().catch(() => {});
          return;
        }
      } else {
        toast.show(t("permission_photos"), "error");
        Linking.openSettings().catch(() => {});
        return;
      }
    }
    if (status !== "granted") return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: kind === "logo",
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const uri = asset.uri;
    const lower = (asset.fileName || uri).toLowerCase();
    const isPng = lower.endsWith(".png") || asset.mimeType === "image/png";
    const isJpg = lower.endsWith(".jpg") || lower.endsWith(".jpeg") || asset.mimeType === "image/jpeg";
    if (!isPng && !isJpg) {
      toast.show(t("image_type_error"), "error");
      return;
    }
    const type = isPng ? "image/png" : "image/jpeg";
    const name = asset.fileName || `${kind}.${isPng ? "png" : "jpg"}`;
    setUploading(kind);
    try {
      await api.upload(kind, uri, name, type);
      await refreshSettings();
      toast.show(t("published"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("try_again"), "error");
    } finally {
      setUploading(null);
    }
  };

  const toggleActive = async (m: any) => {
    try {
      await api.setActive(m.id, !m.active);
      toast.show(m.active ? t("inactive") : t("active"), "success");
      load();
    } catch (e: any) {
      toast.show(e?.message || t("try_again"), "error");
    }
  };

  const doReset = async () => {
    if (!resetTarget || newPass.length < 8) {
      toast.show(t("password_min"), "error");
      return;
    }
    setResetting(true);
    try {
      await api.resetCustomer(resetTarget.id, newPass);
      toast.show(t("reset_done"), "success");
      setResetTarget(null);
      setNewPass("");
      load();
    } catch (e: any) {
      toast.show(e?.message || t("try_again"), "error");
    } finally {
      setResetting(false);
    }
  };

  const maxCount = Math.max(1, ...((data?.last7 || []).map((d: any) => d.count) as number[]));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <Txt font="displayBold" style={styles.title}>{t("owner_title")}</Txt>
        <Txt font="body" style={styles.subtitle}>{t("owner_subtitle")}</Txt>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.gold} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.xl, paddingBottom: SPACING.xxxl, gap: SPACING.xxl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Metrics */}
          <View style={styles.metrics}>
            <Metric icon="activity" value={data?.total_sessions ?? 0} label={t("total_sessions")} />
            <Metric icon="users" value={data?.registered_users ?? 0} label={t("registered_users")} />
            <Metric icon="sun" value={data?.today ?? 0} label={t("today")} />
            <Metric icon="grid" value={data?.topics_covered ?? 0} label={t("topics_covered")} />
          </View>

          {/* Chart */}
          <View style={styles.block}>
            <Txt font="bodyBold" style={styles.blockLabel}>{t("sessions_7days")}</Txt>
            <View style={styles.chart}>
              {(data?.last7 || []).map((d: any, i: number) => (
                <View key={i} style={styles.chartCol}>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { height: `${8 + (d.count / maxCount) * 82}%` }]} />
                  </View>
                  <Txt font="bodyMedium" style={styles.barLabel}>{DOW[d.dow] ?? ""}</Txt>
                </View>
              ))}
            </View>
          </View>

          {/* Most asked */}
          {(data?.most_asked || []).length > 0 && (
            <View style={styles.block}>
              <Txt font="bodyBold" style={styles.blockLabel}>{t("most_asked")}</Txt>
              <View style={styles.chipsWrap}>
                {data.most_asked.map((m: any) => (
                  <View key={m.name} style={styles.topicChip}>
                    <Txt font="bodyMedium" style={styles.topicChipTxt}>{topicLabel(m.name)}</Txt>
                    <View style={styles.countPill}><Txt font="bodyBold" style={styles.countTxt}>{m.count}</Txt></View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Reset requests */}
          {(data?.reset_requests || []).length > 0 && (
            <View style={styles.block}>
              <Txt font="bodyBold" style={styles.blockLabel}>{t("reset_requests")}</Txt>
              {data.reset_requests.map((r: any) => (
                <View key={r.email} style={styles.requestRow}>
                  <Feather name="key" size={16} color={COLORS.warning} />
                  <Txt font="body" style={styles.requestTxt}>{r.email}</Txt>
                  <Pressable style={styles.smallBtn} onPress={() => setResetTarget({ id: r.user_id, name: r.name || r.email })}>
                    <Txt font="bodyBold" style={styles.smallBtnTxt}>{t("reset")}</Txt>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Members */}
          <View style={styles.block}>
            <Txt font="bodyBold" style={styles.blockLabel}>{t("member_management")}</Txt>
            {(data?.members || []).filter((m: any) => !m.is_owner).length === 0 ? (
              <Txt font="body" style={styles.muted}>{t("no_members")}</Txt>
            ) : (
              (data?.members || []).filter((m: any) => !m.is_owner).map((m: any) => (
                <View key={m.id} style={styles.memberRow} testID={`member-${m.id}`}>
                  <View style={{ flex: 1 }}>
                    <Txt font="displaySemibold" style={styles.memberName}>{m.name || t("customer_role")}</Txt>
                    <Txt font="body" style={styles.memberEmail}>{m.email}</Txt>
                    <View style={styles.memberMeta}>
                      <View style={[styles.dot, { backgroundColor: m.active ? COLORS.success : COLORS.error }]} />
                      <Txt font="bodyMedium" style={styles.memberMetaTxt}>{m.active ? t("active") : t("inactive")}</Txt>
                      <Txt font="body" style={styles.memberMetaTxt}>· {m.readings} {t("readings_count")}</Txt>
                    </View>
                  </View>
                  <View style={styles.memberActions}>
                    <Pressable testID={`toggle-${m.id}`} style={styles.iconBtn} onPress={() => toggleActive(m)}>
                      <Feather name={m.active ? "user-x" : "user-check"} size={16} color={m.active ? COLORS.error : COLORS.success} />
                    </Pressable>
                    <Pressable testID={`reset-${m.id}`} style={styles.iconBtn} onPress={() => setResetTarget({ id: m.id, name: m.name || m.email })}>
                      <Feather name="key" size={16} color={COLORS.gold} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Branding */}
          <View style={styles.block}>
            <Txt font="bodyBold" style={styles.blockLabel}>{t("branding")}</Txt>

            <BrandImage
              label={t("logo_label")}
              uri={settings.logo_url ? mediaUrl(settings.logo_url) : ""}
              busy={uploading === "logo"}
              onPress={() => pickImage("logo")}
              t={t}
              square
            />
            <BrandImage
              label={t("background_label")}
              uri={settings.background_url ? mediaUrl(settings.background_url) : ""}
              busy={uploading === "background"}
              onPress={() => pickImage("background")}
              t={t}
            />

            <Txt font="bodyMedium" style={styles.fieldLabel}>{t("app_name_label")}</Txt>
            <Field testID="brand-appname" value={appName} onChangeText={setAppName} />
            <Txt font="bodyMedium" style={styles.fieldLabel}>{t("tagline_label")}</Txt>
            <Field testID="brand-tagline" value={tagline} onChangeText={setTagline} />
            <Txt font="bodyMedium" style={styles.fieldLabel}>{t("subtitle_label")}</Txt>
            <Field testID="brand-subtitle" value={subtitle} onChangeText={setSubtitle} />

            <Txt font="bodyMedium" style={styles.fieldLabel}>{t("voice_label")}</Txt>
            <View style={styles.chipsWrap}>
              {VOICES.map((v) => (
                <Pressable key={v} onPress={() => setVoice(v)} style={[styles.selectChip, voice === v && styles.selectChipOn]}>
                  <Txt font="bodyMedium" style={[styles.selectChipTxt, voice === v && { color: COLORS.onGold }]}>{v}</Txt>
                </Pressable>
              ))}
            </View>

            <Txt font="bodyMedium" style={styles.fieldLabel}>{t("speed_label")}</Txt>
            <View style={styles.chipsWrap}>
              {SPEEDS.map((s) => (
                <Pressable key={s} onPress={() => setSpeed(s)} style={[styles.selectChip, speed === s && styles.selectChipOn]}>
                  <Txt font="bodyMedium" style={[styles.selectChipTxt, speed === s && { color: COLORS.onGold }]}>{s}x</Txt>
                </Pressable>
              ))}
            </View>

            <Btn testID="brand-save" label={t("save_publish")} loading={savingBrand} onPress={saveBranding} style={{ marginTop: SPACING.md }} />
          </View>

          {/* Knowledge — deeper traditions */}
          <View style={styles.block}>
            <Txt font="bodyBold" style={styles.blockLabel}>{t("knowledge")}</Txt>

            <Txt font="bodyMedium" style={styles.fieldLabel}>{t("select_tradition")}</Txt>
            <View style={styles.chipsWrap}>
              {(kb?.topics || []).map((tp: string) => (
                <Pressable key={tp} onPress={() => setKTopic(tp)} style={[styles.selectChip, kTopic === tp && styles.selectChipOn]}>
                  <Txt font="bodyMedium" style={[styles.selectChipTxt, kTopic === tp && { color: COLORS.onGold }]}>{topicLabel(tp)}</Txt>
                </Pressable>
              ))}
            </View>

            <Txt font="bodyMedium" style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>{t("answer_text")}</Txt>
            <Field testID="kb-text" value={kText} onChangeText={setKText} placeholder={t("answer_text")} multiline style={{ height: 80, textAlignVertical: "top", paddingTop: 6 }} />
            <Btn testID="kb-add" icon="plus" label={t("add_answer")} loading={addingK} onPress={addKnowledge} variant="outline" />

            <Btn testID="kb-upload" icon="upload" label={uploadingKb ? t("upload_kb") : t("upload_kb")} loading={uploadingKb} onPress={uploadKb} variant="outline" style={{ marginTop: SPACING.sm }} />

            {(kb?.entries || []).length > 0 && (
              <>
                <Txt font="bodyMedium" style={[styles.fieldLabel, { marginTop: SPACING.md }]}>{t("custom_answers")}</Txt>
                {(kb.entries || []).slice(0, 30).map((e: any) => (
                  <View key={e.id} style={styles.kbRow} testID={`kb-entry-${e.id}`}>
                    <View style={styles.kbTag}><Txt font="bodyMedium" style={styles.kbTagTxt}>{topicLabel(e.topic)} · {e.lang}</Txt></View>
                    <Txt font="body" style={styles.kbText} numberOfLines={2}>{e.text}</Txt>
                    <Pressable testID={`kb-del-${e.id}`} onPress={() => deleteKnowledge(e.id)} style={styles.kbDel}>
                      <Feather name="trash-2" size={15} color={COLORS.error} />
                    </Pressable>
                  </View>
                ))}
              </>
            )}

            {(kb?.files || []).length > 0 && (
              <>
                <Txt font="bodyMedium" style={[styles.fieldLabel, { marginTop: SPACING.md }]}>{t("kb_files_label")}</Txt>
                {(kb.files || []).map((f: any) => (
                  <View key={f.id} style={styles.kbRow}>
                    <Feather name="file-text" size={15} color={COLORS.gold} />
                    <Txt font="body" style={styles.kbText} numberOfLines={1}>{f.name}</Txt>
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* Reset password modal */}
      <Modal visible={!!resetTarget} transparent animationType="fade" onRequestClose={() => setResetTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Txt font="displaySemibold" style={styles.modalTitle}>{t("reset_password")}</Txt>
            <Txt font="body" style={styles.modalSub}>{resetTarget?.name}</Txt>
            <Field
              testID="reset-newpass"
              icon="lock"
              placeholder={t("new_password")}
              secureTextEntry
              value={newPass}
              onChangeText={setNewPass}
              style={{ marginTop: SPACING.md }}
            />
            <View style={styles.modalActions}>
              <Btn variant="outline" label={t("cancel")} onPress={() => { setResetTarget(null); setNewPass(""); }} style={{ flex: 1 }} />
              <Btn testID="reset-confirm" label={t("reset")} loading={resetting} onPress={doReset} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Metric({ icon, value, label }: { icon: keyof typeof Feather.glyphMap; value: number; label: string }) {
  return (
    <View style={styles.metric}>
      <Feather name={icon} size={16} color={COLORS.gold} />
      <Txt font="displayBold" style={styles.metricValue}>{value}</Txt>
      <Txt font="body" style={styles.metricLabel}>{label}</Txt>
    </View>
  );
}

function BrandImage({ label, uri, busy, onPress, t, square }: any) {
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <Txt font="bodyMedium" style={styles.fieldLabel}>{label}</Txt>
      <Pressable onPress={onPress} style={[styles.imageBox, square && { height: 120 }]} testID={`upload-${label}`}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill as any} contentFit={square ? "contain" : "cover"} />
        ) : null}
        <View style={styles.imageOverlay}>
          {busy ? (
            <ActivityIndicator color={COLORS.gold} />
          ) : (
            <>
              <Feather name={uri ? "refresh-cw" : "upload"} size={18} color={COLORS.goldSoft} />
              <Txt font="bodyMedium" style={styles.imageTxt}>{uri ? t("change_image") : t("upload_image")}</Txt>
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  title: { fontSize: 34, color: COLORS.onSurface },
  subtitle: { color: COLORS.onSurface3, fontSize: 13, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  metric: {
    width: "47%", flexGrow: 1, backgroundColor: COLORS.surface2, borderRadius: RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  metricValue: { color: COLORS.onSurface, fontSize: 30, marginTop: SPACING.xs },
  metricLabel: { color: COLORS.muted, fontSize: 12 },
  block: {
    backgroundColor: COLORS.surface2, borderRadius: RADIUS.lg, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md,
  },
  blockLabel: { color: COLORS.gold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 120, gap: SPACING.sm },
  chartCol: { flex: 1, alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" },
  barTrack: { width: "70%", flex: 1, justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 6, backgroundColor: COLORS.gold, minHeight: 4 },
  barLabel: { color: COLORS.muted, fontSize: 11 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  topicChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.pinkDeep, borderRadius: RADIUS.pill, paddingLeft: SPACING.md, paddingRight: 5, paddingVertical: 5 },
  topicChipTxt: { color: COLORS.goldSoft, fontSize: 12 },
  countPill: { backgroundColor: "rgba(0,0,0,0.35)", borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 1 },
  countTxt: { color: COLORS.onSurface, fontSize: 11 },
  requestRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  requestTxt: { flex: 1, color: COLORS.onSurface2, fontSize: 13 },
  smallBtn: { backgroundColor: COLORS.surface3, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.gold, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  smallBtnTxt: { color: COLORS.gold, fontSize: 12 },
  muted: { color: COLORS.muted, fontSize: 13 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.divider },
  memberName: { color: COLORS.onSurface, fontSize: 16 },
  memberEmail: { color: COLORS.onSurface3, fontSize: 12, marginTop: 1 },
  memberMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  memberMetaTxt: { color: COLORS.muted, fontSize: 11 },
  memberActions: { flexDirection: "row", gap: SPACING.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface3, borderWidth: 1, borderColor: COLORS.border },
  fieldLabel: { color: COLORS.onSurface3, fontSize: 12, marginBottom: 2 },
  imageBox: {
    height: 90, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: COLORS.surface3,
    borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed",
  },
  imageOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(5,5,8,0.35)" },
  imageTxt: { color: COLORS.goldSoft, fontSize: 12 },
  selectChip: { backgroundColor: COLORS.surface3, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 7 },
  selectChipOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  selectChipTxt: { color: COLORS.onSurface3, fontSize: 12 },
  kbRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.divider },
  kbTag: { backgroundColor: COLORS.pinkDeep, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 },
  kbTagTxt: { color: COLORS.goldSoft, fontSize: 10 },
  kbText: { flex: 1, color: COLORS.onSurface3, fontSize: 12 },
  kbDel: { padding: 6 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  modalCard: { width: "100%", backgroundColor: COLORS.surface2, borderRadius: RADIUS.lg, padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.glassLine },
  modalTitle: { color: COLORS.onSurface, fontSize: 22 },
  modalSub: { color: COLORS.onSurface3, fontSize: 13, marginTop: 2 },
  modalActions: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.lg },
});
