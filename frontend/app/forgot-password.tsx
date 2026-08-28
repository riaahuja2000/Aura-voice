import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { COLORS, SPACING } from "@/theme";
import { useI18n } from "@/src/i18n";
import { api } from "@/src/api";
import { Btn, Field, Txt, useToast } from "@/src/ui";
import { BrandBackdrop } from "@/src/components/BrandBackdrop";

export default function ForgotPassword() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      toast.show(t("required"), "error");
      return;
    }
    setLoading(true);
    try {
      const res = await api.forgot(email.trim());
      setSent(true);
      toast.show(res.message || t("request_sent"), "success");
    } catch (e: any) {
      toast.show(e?.message || "Error", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BrandBackdrop>
      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom + SPACING.xxl, paddingHorizontal: SPACING.xl }}
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        <Txt
          testID="back-to-login"
          font="bodyMedium"
          onPress={() => router.replace("/login" as any)}
          style={styles.back}
        >
          <Feather name="chevron-left" size={16} color={COLORS.gold} />  {t("back_to_login")}
        </Txt>

        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Feather name="key" size={26} color={COLORS.gold} />
          </View>
          <Txt font="displaySemibold" style={styles.title}>{t("forgot_title")}</Txt>
          <Txt font="body" style={styles.subtitle}>{t("forgot_subtitle")}</Txt>
        </View>

        {sent ? (
          <View style={styles.sentBox}>
            <Feather name="check-circle" size={22} color={COLORS.gold} />
            <Txt font="body" style={styles.sentTxt}>{t("request_sent")}</Txt>
            <Btn testID="forgot-back" variant="outline" label={t("back_to_login")} onPress={() => router.replace("/login" as any)} />
          </View>
        ) : (
          <View style={styles.form}>
            <Field
              testID="forgot-email"
              icon="mail"
              placeholder={t("email")}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Btn testID="forgot-submit" label={t("send_reset")} loading={loading} onPress={submit} />
          </View>
        )}
      </KeyboardAwareScrollView>
    </BrandBackdrop>
  );
}

const styles = StyleSheet.create({
  back: { color: COLORS.gold, fontSize: 13, marginBottom: SPACING.xxl },
  hero: { alignItems: "center", marginBottom: SPACING.xxl },
  iconWrap: {
    width: 64, height: 64, borderRadius: 40, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surface3, borderWidth: 1, borderColor: COLORS.glassLine, marginBottom: SPACING.lg,
  },
  title: { fontSize: 36, color: COLORS.onSurface, lineHeight: 40 },
  subtitle: { color: COLORS.onSurface3, fontSize: 14, marginTop: SPACING.sm, textAlign: "center", lineHeight: 20 },
  form: { gap: SPACING.md },
  sentBox: { alignItems: "center", gap: SPACING.lg, padding: SPACING.xl },
  sentTxt: { color: COLORS.onSurface2, textAlign: "center", lineHeight: 22 },
});
