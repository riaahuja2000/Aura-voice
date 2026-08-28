import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SPACING } from "@/theme";
import { useI18n } from "@/src/i18n";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { Btn, Field, Txt, useToast } from "@/src/ui";
import { LangSwitcher } from "@/src/components/LangSwitcher";

const VOICES = ["shimmer", "coral", "nova", "sage", "fable", "alloy", "echo", "onyx", "ash"];
const SPEEDS = [0.85, 0.95, 1.0, 1.15];

export default function Account() {
  const { t } = useI18n();
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [voice, setVoice] = useState(user?.voice || "shimmer");
  const [speed, setSpeed] = useState<number>(user?.speed || 0.95);

  const saveVoice = async (v: string, s: number) => {
    setVoice(v);
    setSpeed(s);
    try {
      const updated = await api.updateProfile({ voice: v, speed: s });
      setUser(updated);
    } catch {
      /* keep local selection */
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile({ name: name.trim() || undefined, language: user?.language });
      setUser(updated);
      toast.show(t("saved"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("try_again"), "error");
    } finally {
      setSaving(false);
    }
  };

  const onLang = async (lang: any) => {
    try {
      const updated = await api.updateProfile({ language: lang });
      setUser(updated);
    } catch {
      /* language still applies locally */
    }
  };

  const doLogout = async () => {
    await logout();
    router.replace("/login" as any);
  };

  const memberSince = (() => {
    try {
      return user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "";
    } catch {
      return "";
    }
  })();

  const initial = (user?.name || user?.email || "V").charAt(0).toUpperCase();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <Txt font="displayBold" style={styles.title}>{t("account_title")}</Txt>
        <Txt font="body" style={styles.subtitle}>{t("account_subtitle")}</Txt>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.xl, paddingBottom: SPACING.xxxl, gap: SPACING.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Txt font="displayBold" style={styles.avatarTxt}>{initial}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt font="displaySemibold" style={styles.name} numberOfLines={1}>{user?.name || t("customer_role")}</Txt>
            <Txt font="body" style={styles.email} numberOfLines={1}>{user?.email}</Txt>
          </View>
          <View style={[styles.roleBadge, user?.is_owner && styles.roleOwner]}>
            <Ionicons name={user?.is_owner ? "shield" : "star"} size={12} color={user?.is_owner ? COLORS.onGold : COLORS.gold} />
            <Txt font="bodyBold" style={[styles.roleTxt, user?.is_owner && { color: COLORS.onGold }]}>
              {user?.is_owner ? t("owner_role") : t("customer_role")}
            </Txt>
          </View>
        </View>

        {/* Display name */}
        <View style={styles.section}>
          <Txt font="bodyBold" style={styles.sectionLabel}>{t("display_name")}</Txt>
          <Field testID="account-name" icon="user" value={name} onChangeText={setName} placeholder={t("name_placeholder")} />
          <Btn testID="account-save" label={saving ? t("saved") : t("save_changes")} loading={saving} onPress={save} variant="outline" />
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Txt font="bodyBold" style={styles.sectionLabel}>{t("language")}</Txt>
          <LangSwitcher onChange={onLang} />
        </View>

        {/* Voice choice */}
        <View style={styles.section}>
          <Txt font="bodyBold" style={styles.sectionLabel}>{t("voice_label")}</Txt>
          <View style={styles.chips}>
            {VOICES.map((v) => (
              <Pressable key={v} testID={`voice-${v}`} onPress={() => saveVoice(v, speed)} style={[styles.chip, voice === v && styles.chipOn]}>
                <Txt font="bodyMedium" style={[styles.chipTxt, voice === v && { color: COLORS.onGold }]}>{v}</Txt>
              </Pressable>
            ))}
          </View>
          <Txt font="bodyBold" style={[styles.sectionLabel, { marginTop: SPACING.md }]}>{t("speed_label")}</Txt>
          <View style={styles.chips}>
            {SPEEDS.map((s) => (
              <Pressable key={s} testID={`speed-${s}`} onPress={() => saveVoice(voice, s)} style={[styles.chip, speed === s && styles.chipOn]}>
                <Txt font="bodyMedium" style={[styles.chipTxt, speed === s && { color: COLORS.onGold }]}>{s}x</Txt>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Txt font="displayBold" style={styles.metaValue}>{memberSince || "—"}</Txt>
            <Txt font="body" style={styles.metaLabel}>{t("member_since")}</Txt>
          </View>
        </View>

        <Btn testID="account-logout" icon="log-out" label={t("sign_out")} onPress={doLogout} variant="outline" style={{ borderColor: COLORS.error }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  title: { fontSize: 34, color: COLORS.onSurface },
  subtitle: { color: COLORS.onSurface3, fontSize: 13, marginTop: 2 },
  identity: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surface2, borderRadius: RADIUS.lg, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 30, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.pinkDeep, borderWidth: 1, borderColor: COLORS.glassLine,
  },
  avatarTxt: { color: COLORS.goldSoft, fontSize: 24 },
  name: { color: COLORS.onSurface, fontSize: 20 },
  email: { color: COLORS.onSurface3, fontSize: 13, marginTop: 1 },
  roleBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.surface3, borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.gold, paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  roleOwner: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  roleTxt: { color: COLORS.gold, fontSize: 11 },
  section: { gap: SPACING.md },
  sectionLabel: { color: COLORS.gold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  chip: { backgroundColor: COLORS.surface3, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 8 },
  chipOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipTxt: { color: COLORS.onSurface3, fontSize: 12 },
  metaRow: { flexDirection: "row", gap: SPACING.md },
  metaCard: {
    flex: 1, backgroundColor: COLORS.surface2, borderRadius: RADIUS.lg, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  metaValue: { color: COLORS.onSurface, fontSize: 20 },
  metaLabel: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
});
