import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { COLORS, FONTS, RADIUS, SPACING } from "@/theme";

type FontKind =
  | "body"
  | "bodyMedium"
  | "bodyBold"
  | "display"
  | "displayMedium"
  | "displaySemibold"
  | "displayBold";

const FONT_MAP: Record<FontKind, string> = {
  body: FONTS.body,
  bodyMedium: FONTS.bodyMedium,
  bodyBold: FONTS.bodyBold,
  display: FONTS.display,
  displayMedium: FONTS.displayMedium,
  displaySemibold: FONTS.displaySemibold,
  displayBold: FONTS.displayBold,
};

export function Txt({
  font = "body",
  style,
  children,
  ...rest
}: TextProps & { font?: FontKind }) {
  return (
    <Text {...rest} style={[{ fontFamily: FONT_MAP[font], color: COLORS.onSurface }, style]}>
      {children}
    </Text>
  );
}

export function Field({
  style,
  icon,
  ...rest
}: TextInputProps & { icon?: keyof typeof Feather.glyphMap }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      {icon ? <Feather name={icon} size={18} color={focused ? COLORS.gold : COLORS.muted} /> : null}
      <TextInput
        placeholderTextColor={COLORS.muted}
        style={[styles.input, style]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
    </View>
  );
}

export function Btn({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  icon,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "outline";
  icon?: keyof typeof Feather.glyphMap;
  style?: ViewStyle;
  testID?: string;
}) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  const handle = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };
  return (
    <Pressable
      testID={testID}
      onPress={handle}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isPrimary && styles.btnPrimary,
        variant === "outline" && styles.btnOutline,
        isGhost && styles.btnGhost,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? COLORS.onGold : COLORS.gold} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? (
            <Feather name={icon} size={16} color={isPrimary ? COLORS.onGold : COLORS.gold} />
          ) : null}
          <Txt
            font="bodyBold"
            style={{
              color: isPrimary ? COLORS.onGold : COLORS.gold,
              fontSize: 15,
              letterSpacing: 0.3,
            }}
          >
            {label}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

// ---------------- Toast ----------------
type ToastType = "info" | "error" | "success";
type ToastCtx = { show: (msg: string, type?: ToastType) => void };
const ToastContext = createContext<ToastCtx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState("");
  const [type, setType] = useState<ToastType>("info");
  const y = useRef(new Animated.Value(-140)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (m: string, t: ToastType = "info") => {
      setMsg(m);
      setType(t);
      if (timer.current) clearTimeout(timer.current);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(y, { toValue: -160, duration: 260, useNativeDriver: true }).start();
      }, 2800);
    },
    [y],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const accent = type === "error" ? COLORS.error : type === "success" ? COLORS.gold : COLORS.pink;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          { top: insets.top + 8, transform: [{ translateY: y }], borderColor: accent },
        ]}
      >
        <Feather
          name={type === "error" ? "alert-circle" : type === "success" ? "check-circle" : "moon"}
          size={16}
          color={accent}
        />
        <Txt font="bodyMedium" style={{ flex: 1, color: COLORS.onSurface, fontSize: 13 }}>
          {msg}
        </Txt>
      </Animated.View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surface3,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    height: 54,
  },
  fieldFocused: { borderColor: COLORS.gold },
  input: { flex: 1, color: COLORS.onSurface, fontFamily: FONTS.body, fontSize: 15, height: "100%" },
  btn: {
    height: 54,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  btnPrimary: { backgroundColor: COLORS.gold },
  btnOutline: { borderWidth: 1, borderColor: COLORS.gold, backgroundColor: "transparent" },
  btnGhost: { backgroundColor: "transparent", height: 44 },
  btnRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  toast: {
    position: "absolute",
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    zIndex: 1000,
  },
});
