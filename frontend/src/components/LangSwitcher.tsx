import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, RADIUS, SPACING } from "@/theme";
import { LANGS, useI18n } from "@/src/i18n";
import { Txt } from "@/src/ui";
import type { Lang } from "@/src/api";

export function LangSwitcher({
  compact,
  onChange,
}: {
  compact?: boolean;
  onChange?: (l: Lang) => void;
}) {
  const { lang, setLang } = useI18n();
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      {LANGS.map((l) => {
        const active = l.code === lang;
        return (
          <Pressable
            key={l.code}
            testID={`lang-${l.code}`}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setLang(l.code);
              onChange?.(l.code);
            }}
            style={[styles.item, active && styles.itemActive, compact && styles.itemCompact]}
          >
            <Txt
              font={active ? "bodyBold" : "bodyMedium"}
              style={{ color: active ? COLORS.onGold : COLORS.onSurface3, fontSize: compact ? 12 : 13 }}
            >
              {compact ? l.short : l.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: COLORS.surface3,
    borderRadius: RADIUS.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  compact: { padding: 3 },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
  },
  itemCompact: { paddingVertical: 6, paddingHorizontal: 12, flex: 0 },
  itemActive: { backgroundColor: COLORS.gold },
});
