export const OWNER_EMAIL = "riaahuja2000@gmail.com";
export const OWNER_PASSWORD = "rioelixir";
export const OWNER_NAME = "Ria Ahuja";

export const APP_NAME = "VELORA";
export const APP_TAGLINE = "Ask · Receive · Apply · Move";

export type Lang = "en" | "hi" | "hng";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिन्दी", short: "हि" },
  { code: "hng", label: "Hinglish", short: "हिं" },
];

export function isOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL;
}

export const TOPIC_KEYS = [
  "tarot",
  "astrology",
  "numerology",
  "runes",
  "crystals",
  "aura",
  "palmistry",
  "feng-shui",
  "kabbalah",
  "i-ching",
  "relationships",
  "career",
  "money",
  "health",
  "purpose",
  "timing",
  "general",
] as const;

export type TopicKey = (typeof TOPIC_KEYS)[number];

export const TOPIC_COLORS: Record<string, string> = {
  tarot: "chip-tarot",
  astrology: "chip-astrology",
  numerology: "chip-numerology",
  runes: "chip-runes",
  crystals: "chip-crystals",
  aura: "chip-aura",
  palmistry: "chip-palmistry",
  "feng-shui": "chip-feng",
  kabbalah: "chip-kabbalah",
  "i-ching": "chip-iching",
  relationships: "chip-love",
  career: "chip-career",
  money: "chip-money",
  health: "chip-health",
  purpose: "chip-purpose",
  timing: "chip-timing",
  general: "chip-general",
};
