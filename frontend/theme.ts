// AURA VOICE — premium celestial voice design tokens.
export const COLORS = {
  surface: "#070713",
  surface2: "#100D24",
  surface3: "#191532",
  onSurface: "#FCF9FF",
  onSurface2: "#EEE8F8",
  onSurface3: "#C9BEDC",
  muted: "#9387AA",

  // Compatibility names retained so existing screens inherit the new brand.
  gold: "#E2B19F",
  goldSoft: "#F1D6CD",
  pink: "#B89CFF",
  pinkDeep: "#362653",
  onGold: "#201329",

  success: "#79CDBB",
  warning: "#F0C77E",
  error: "#FF8FA3",
  border: "#2D2848",
  borderStrong: "#C8AAFF",
  divider: "#211D38",
  glass: "rgba(12,10,29,0.82)",
  glassLine: "rgba(226,177,159,0.28)",

  // Explicit Aura Voice palette.
  indigo: "#201A54",
  violet: "#7659D7",
  lavender: "#C8B3FF",
  roseGold: "#E2B19F",
  pearl: "#FCF9FF",
  aqua: "#9DE2DD",
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const RADIUS = { sm: 8, md: 14, lg: 22, xl: 30, pill: 999 };

export const FONTS = {
  display: "Cormorant",
  displayMedium: "Cormorant-Medium",
  displaySemibold: "Cormorant-SemiBold",
  displayBold: "Cormorant-Bold",
  body: "Satoshi",
  bodyMedium: "Satoshi-Medium",
  bodyBold: "Satoshi-Bold",
};

export const FONT_ASSETS = {
  Cormorant: require("./assets/fonts/CormorantGaramond-Regular.ttf"),
  "Cormorant-Medium": require("./assets/fonts/CormorantGaramond-Medium.ttf"),
  "Cormorant-SemiBold": require("./assets/fonts/CormorantGaramond-SemiBold.ttf"),
  "Cormorant-Bold": require("./assets/fonts/CormorantGaramond-Bold.ttf"),
  Satoshi: require("./assets/fonts/Satoshi-Regular.ttf"),
  "Satoshi-Medium": require("./assets/fonts/Satoshi-Medium.ttf"),
  "Satoshi-Bold": require("./assets/fonts/Satoshi-Bold.ttf"),
};
