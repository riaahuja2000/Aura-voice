import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { COLORS, SPACING } from "@/theme";
import { useI18n } from "@/src/i18n";
import { useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { mediaUrl } from "@/src/api";
import { Btn, Field, Txt, useToast } from "@/src/ui";
import { BrandBackdrop } from "@/src/components/BrandBackdrop";
import { LangSwitcher } from "@/src/components/LangSwitcher";

const LOGO = require("@/assets/brand/velora-logo.png");

export default function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const logo = settings.logo_url ? { uri: mediaUrl(settings.logo_url) } : LOGO;

  const submit = async () => {
    if (!email.trim() || !password) {
      toast.show(t("invalid_credentials"), "error");
      return;
    }
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      router.replace(u.is_owner ? ("/owner" as any) : ("/home" as any));
    } catch (e: any) {
      toast.show(e?.message || t("invalid_credentials"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BrandBackdrop>
      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.xxl, paddingHorizontal: SPACING.xl }}
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.langRow}>
          <LangSwitcher compact />
        </View>

        <View style={styles.hero}>
          <Image source={logo} style={styles.logo} contentFit="contain" />
          <Txt font="displaySemibold" style={styles.title}>{t("welcome_back")}</Txt>
          <Txt font="body" style={styles.subtitle}>{t("log_in_account")}</Txt>
        </View>

        <View style={styles.form}>
          <Field
            testID="login-email"
            icon="mail"
            placeholder={t("email")}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            testID="login-password"
            icon="lock"
            placeholder={t("password")}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <View style={{ alignItems: "flex-end" }}>
            <Txt
              testID="forgot-link"
              font="bodyMedium"
              onPress={() => router.push("/forgot-password" as any)}
              style={styles.link}
            >
              {t("forgot_password")}
            </Txt>
          </View>
          <Btn testID="login-submit" label={t("log_in")} loading={loading} onPress={submit} />
        </View>

        <View style={styles.footer}>
          <Txt font="body" style={{ color: COLORS.onSurface3 }}>{t("dont_have_account")} </Txt>
          <Txt
            testID="go-register"
            font="bodyBold"
            style={styles.link}
            onPress={() => router.push("/register" as any)}
          >
            {t("create_one")}
          </Txt>
        </View>
      </KeyboardAwareScrollView>
    </BrandBackdrop>
  );
}

const styles = StyleSheet.create({
  langRow: { alignItems: "flex-end", marginBottom: SPACING.lg },
  hero: { alignItems: "center", marginBottom: SPACING.xxl },
  logo: { width: 150, height: 150, marginBottom: SPACING.sm },
  title: { fontSize: 40, color: COLORS.onSurface, lineHeight: 44 },
  subtitle: { color: COLORS.onSurface3, fontSize: 14, marginTop: SPACING.xs, textAlign: "center" },
  form: { gap: SPACING.md },
  link: { color: COLORS.gold, fontSize: 13 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: SPACING.xxl, alignItems: "center" },
});
