import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { COLORS, FONTS, SPACING } from "@/theme";
import { useAuth } from "@/src/auth";
import { useI18n, type I18nKey } from "@/src/i18n";

type TabDef = { name: string; labelKey: I18nKey; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap };

const TABS: Record<string, TabDef> = {
  home: { name: "home", labelKey: "nav_home", icon: "flower-outline", active: "flower" },
  journal: { name: "journal", labelKey: "nav_journal", icon: "book-outline", active: "book" },
  owner: { name: "owner", labelKey: "nav_owner", icon: "shield-outline", active: "shield" },
  account: { name: "account", labelKey: "nav_account", icon: "person-outline", active: "person" },
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();

  const order = user?.is_owner ? ["home", "owner", "account"] : ["home", "journal", "account"];
  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      {order.map((routeName) => {
        const def = TABS[routeName];
        const route = state.routes.find((r) => r.name === routeName);
        if (!route || !def) return null;
        const focused = activeRouteName === routeName;
        return (
          <Pressable
            key={routeName}
            testID={`tab-${routeName}`}
            style={styles.item}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
            }}
          >
            <Ionicons name={focused ? def.active : def.icon} size={22} color={focused ? COLORS.gold : COLORS.muted} />
            <Text
              style={{
                fontFamily: focused ? FONTS.bodyBold : FONTS.bodyMedium,
                color: focused ? COLORS.gold : COLORS.muted,
                fontSize: 11,
                marginTop: 3,
                letterSpacing: 0.3,
              }}
            >
              {t(def.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: COLORS.surface } }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="journal" />
      <Tabs.Screen name="owner" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface2,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SPACING.md,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center" },
});
