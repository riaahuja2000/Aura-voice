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
import { LinearGradient } from "expo-linear-gradient";
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

export function Txt({ font = "body", style, children, ...rest }: TextProps & { font?: FontKind }) {
  return (
    <Text {...rest} style={[{ fontFamily: FONT_MAP[font], color: COLORS.onSurface }, style]}>
      {children}
    </Text>
  );
}

function BrandGlyph({
  name,
  size = 16,
  strong = false,
}: {
  name: keyof typeof Feather.glyphMap;
  size?: number;
  strong?: boolean;
}) {
  const box = size + 14;
  return (
    <LinearGradient
      colors={strong ? [COLORS.roseGold, COLORS.lavender] : ["rgba(200,179,255,0.18)", "rgba(226,177,159,0.10)"]}
      style={[styles.glyphHalo, { width: box, height: box, borderRadius: box / 2 }]}
    >
      <Feather name={name} size={size} color={strong ? COLORS.onGold : COLORS.lavender} />
    </LinearGradient>
  );
}

export function Field({ style, icon, ...rest }: TextInputProps & { icon?: keyof typeof Feather.glyphMap }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      {icon ? <BrandGlyph name={icon} size={15} strong={focused} /> : null}
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
        pressed && { transform: [{ scale: 0.985 }], opacity: 0.88 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? COLORS.onGold : COLORS.lavender} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <BrandGlyph name={icon} size={14} strong={isPrimary} /> : null}
          <Txt
            font="bodyBold"
            style={{ color: isPrimary ? COLORS.onGold : COLORS.roseGold, fontSize: 15, letterSpacing: 0.45 }}
          >
            {label}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

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
      Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 5 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(y, { toValue: -160, duration: 260, useNativeDriver: true }).start();
      }, 2800);
    },
    [y],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const accent = type === "error" ? COLORS.error : type === "success" ? COLORS.aqua : COLORS.lavender;
  const glyph: keyof typeof Feather.glyphMap = type === "error" ? "alert-circle" : type === "success" ? "check-circle" : "star";

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, { top: insets.top + 8, transform: [{ translateY: y }], borderColor: accent }]}
      >
        <BrandGlyph name={glyph} size={14} />
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
  glyphHalo: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(226,177,159,0.24)",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(25,21,50,0.78)",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    height: 56,
  },
  fieldFocused: {
    borderColor: COLORS.lavender,
    shadowColor: COLORS.violet,
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  input: { flex: 1, color: COLORS.onSurface, fontFamily: FONTS.body, fontSize: 15, height: "100%" },
  btn: {
    minHeight: 54,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  btnPrimary: {
    backgroundColor: COLORS.roseGold,
    borderWidth: 1,
    borderColor: COLORS.goldSoft,
    shadowColor: COLORS.lavender,
    shadowOpacity: 0.20,
    shadowRadius: 16,
  },
  btnOutline: { borderWidth: 1, borderColor: COLORS.roseGold, backgroundColor: "rgba(226,177,159,0.045)" },
  btnGhost: { backgroundColor: "transparent", minHeight: 44 },
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
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    zIndex: 1000,
  },
});
