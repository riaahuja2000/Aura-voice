// BrandBackdrop — now a starry cosmic backdrop used by every non-orb screen.
// Kept as a thin wrapper around CosmicBackdrop so existing screens don't need
// to change any imports.

import React from "react";
import { ViewStyle } from "react-native";
import { CosmicBackdrop, type CosmicTheme } from "@/src/components/CosmicBackdrop";

export function BrandBackdrop({
  children,
  style,
  theme = "nebula",
  // kept for API compat, ignored — the cosmic backdrop needs no scrim.
  scrim: _scrim,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
  theme?: CosmicTheme;
  scrim?: "heavy" | "medium";
}) {
  return (
    <CosmicBackdrop theme={theme} style={style}>
      {children}
    </CosmicBackdrop>
  );
}
