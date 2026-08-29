import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { COLORS, SPACING } from "@/theme";
import { useI18n } from "@/src/i18n";
import { useAuth } from "@/src/auth";
import { Btn, Field, Txt, useToast } from "@/src/ui";
import { BrandBackdrop } from "@/src/components/BrandBackdrop";
import { LangSwitcher } from "@/src/components/LangSwitcher";
import { AureliaWordmark } from "@/src/components/AureliaWordmark";

export default function Register() {
  const { t } = useI18n();
  const { register } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.show(t("required"), "error");
      return;
    }
    if (password.length < 8) {
      toast.show(t("password_min"), "error");
      return;
    }
    if (password !== confirm) {
      toast.show(t("passwords_dont_match"), "error");
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace("/home" as any);
    } catch (e: any) {
      toast.show(e?.message || "Registration failed", "error");
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
        <View style={{ alignItems: "flex-end", marginBottom: SPACING.lg }}>
          <LangSwitcher compact />
        </View>

        <View style={styles.hero}>
          <AureliaWordmark size={40} subtitle={t("sign_up")} />
        </View>

        <View style={styles.form}>
          <Field testID="reg-name" icon="user" placeholder={t("name_placeholder")} value={name} onChangeText={setName} />
          <Field
            testID="reg-email"
            icon="mail"
            placeholder={t("email")}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field testID="reg-password" icon="lock" placeholder={t("password")} secureTextEntry value={password} onChangeText={setPassword} />
          <Field testID="reg-confirm" icon="lock" placeholder={t("confirm_password")} secureTextEntry value={confirm} onChangeText={setConfirm} />
          <Btn testID="reg-submit" label={t("create_account_btn")} loading={loading} onPress={submit} />
        </View>

        <View style={styles.footer}>
          <Txt font="body" style={{ color: COLORS.onSurface3 }}>{t("already_have")} </Txt>
          <Txt testID="go-login" font="bodyBold" style={styles.link} onPress={() => router.replace("/login" as any)}>
            {t("log_in")}
          </Txt>
        </View>
      </KeyboardAwareScrollView>
    </BrandBackdrop>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", marginBottom: SPACING.xl, marginTop: SPACING.xl },
  form: { gap: SPACING.md },
  link: { color: COLORS.gold, fontSize: 13 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: SPACING.xl, alignItems: "center" },
});
