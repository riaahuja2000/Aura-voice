import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONTS } from "@/theme";

export type AuraBrandProps = {
  size?: number;
  subtitle?: string;
  glow?: string;
  ink?: string;
};

function WaveBar({ height, color }: { height: number; color: string }) {
  return <View style={{ width: 2, height, borderRadius: 999, backgroundColor: color, opacity: 0.9 }} />;
}

export function AuraVoiceEmblem({ size = 82 }: { size?: number }) {
  const inner = size * 0.62;
  const micSize = size * 0.27;
  const wave = COLORS.lavender;

  return (
    <View style={[styles.emblemWrap, { width: size, height: size }]} accessibilityLabel="Aura Voice">
      <LinearGradient
        colors={["rgba(200,179,255,0.18)", "rgba(157,226,221,0.10)", "rgba(226,177,159,0.08)"]}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={[styles.outerHalo, { width: size, height: size, borderRadius: size / 2 }]}
      />
      <View
        style={[
          styles.ring,
          {
            width: size * 0.82,
            height: size * 0.82,
            borderRadius: size,
            borderColor: "rgba(226,177,159,0.52)",
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: size * 0.68,
            height: size * 0.68,
            borderRadius: size,
            borderColor: "rgba(200,179,255,0.50)",
          },
        ]}
      />

      <Ionicons
        name="sparkles"
        size={Math.max(8, size * 0.13)}
        color={COLORS.roseGold}
        style={{ position: "absolute", top: size * 0.02 }}
      />

      <View style={[styles.waveRow, { width: inner }]}>
        {[0.26, 0.5, 0.78, 0.46].map((v, i) => (
          <WaveBar key={`l-${i}`} height={size * v * 0.26} color={wave} />
        ))}
        <LinearGradient
          colors={[COLORS.lavender, COLORS.violet, COLORS.indigo]}
          style={[
            styles.micPill,
            {
              width: micSize * 0.82,
              height: micSize * 1.34,
              borderRadius: micSize,
              borderColor: COLORS.roseGold,
            },
          ]}
        >
          <Ionicons name="mic" size={micSize * 0.60} color={COLORS.pearl} />
        </LinearGradient>
        {[0.46, 0.78, 0.5, 0.26].map((v, i) => (
          <WaveBar key={`r-${i}`} height={size * v * 0.26} color={wave} />
        ))}
      </View>

      <Ionicons
        name="moon"
        size={Math.max(8, size * 0.14)}
        color={COLORS.roseGold}
        style={{ position: "absolute", bottom: size * 0.015 }}
      />
    </View>
  );
}

export function AuraVoiceWordmark({
  size = 44,
  subtitle,
  glow = COLORS.roseGold,
  ink = COLORS.pearl,
}: AuraBrandProps) {
  const emblemSize = Math.max(64, size * 1.62);
  return (
    <View style={styles.wordmarkWrap}>
      <AuraVoiceEmblem size={emblemSize} />
      <Text
        style={{
          fontFamily: FONTS.displaySemibold,
          fontSize: size,
          color: ink,
          letterSpacing: Math.max(3, size * 0.10),
          textShadowColor: "rgba(200,179,255,0.42)",
          textShadowRadius: 14,
          marginTop: 8,
        }}
      >
        AURA VOICE
      </Text>
      <View style={styles.divider}>
        <View style={[styles.hair, { backgroundColor: glow }]} />
        <Ionicons name="sparkles" size={10} color={glow} />
        <View style={[styles.hair, { backgroundColor: glow }]} />
      </View>
      <Text style={styles.tagline}>ASK · RECEIVE · APPLY</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emblemWrap: { alignItems: "center", justifyContent: "center" },
  outerHalo: { position: "absolute", borderWidth: 1, borderColor: "rgba(200,179,255,0.22)" },
  ring: { position: "absolute", borderWidth: 1 },
  waveRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  micPill: { borderWidth: 1.3, alignItems: "center", justifyContent: "center" },
  wordmarkWrap: { alignItems: "center", justifyContent: "center" },
  divider: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  hair: { width: 58, height: 1, opacity: 0.62 },
  tagline: {
    fontFamily: FONTS.bodyMedium,
    color: COLORS.lavender,
    fontSize: 10,
    letterSpacing: 2.2,
    marginTop: 7,
  },
  subtitle: {
    fontFamily: FONTS.body,
    color: COLORS.onSurface3,
    fontSize: 12,
    letterSpacing: 1.1,
    marginTop: 12,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
