export const METHOD_KEYWORDS: Record<string, string[]> = {
  tarot: [
    "tarot", "card", "major arcana", "minor arcana", "spread", "fool", "magician",
    "high priestess", "empress", "emperor", "hierophant", "lovers", "chariot",
    "strength", "hermit", "wheel", "justice", "hanged", "death", "temperance",
    "devil", "tower", "star", "moon", "sun", "judgement", "world", "cups",
    "swords", "wands", "pentacles", "टैरो", "पत्ते",
  ],
  astrology: [
    "astrology", "zodiac", "planet", "saturn", "venus", "mars", "mercury",
    "jupiter", "sun", "moon", "rising", "ascendant", "horoscope", "navagraha",
    "nakshatra", "panchanga", "houses", "aspects", "aries", "taurus", "gemini",
    "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn",
    "aquarius", "pisces", "retrograde", "transit", "jyotish", "kundli", "graha",
    "ज्योतिष", "कुंडली", "राशि", "ग्रह",
  ],
  numerology: [
    "numerology", "number", "life path", "destiny number", "birth number",
    "chaldean", "pythagorean", "lo shu", "gematria", "अंक", "अंकज्योतिष",
  ],
  runes: ["rune", "elder futhark", "ogham", "runes", "runic", "रून"],
  crystals: [
    "crystal", "gem", "stone", "amethyst", "quartz", "rose quartz", "obsidian",
    "citrine", "moonstone", "labradorite", "clear quartz", "क्रिस्टल", "रत्न",
  ],
  aura: [
    "chakra", "aura", "energy", "subtle body", "kundalini", "prana",
    "seven chakras", "root chakra", "heart chakra", "third eye", "आभा", "चक्र",
  ],
  palmistry: [
    "palmistry", "palm", "hand", "life line", "heart line", "head line",
    "fate line", "mounts", "हस्तरेखा", "हथेली",
  ],
  "feng-shui": [
    "feng shui", "vastu", "direction", "space", "bagua", "trigram",
    "five phases", "five elements", "compass", "वास्तु", "फेंग शुई",
  ],
  kabbalah: [
    "kabbalah", "sefirot", "sephiroth", "hermetic", "alchemy", "tree of life",
    "qabalah", "agrippa", "कब्बाला",
  ],
  "i-ching": ["i ching", "yijing", "hexagram", "iching", "yi jing", "आई चिंग"],
};

export const LIFE_KEYWORDS: Record<string, string[]> = {
  relationships: [
    "relationship", "love", "partner", "marriage", "spouse", "boyfriend",
    "girlfriend", "husband", "wife", "breakup", "ex", "commitment", "date",
    "dating", "pyaar", "ishq", "shaadi", "rishta", "प्यार", "शादी", "रिश्ता",
  ],
  career: [
    "career", "job", "work", "promotion", "boss", "office", "profession",
    "business", "kaam", "naukri", "नौकरी", "काम", "बिज़नेस",
  ],
  money: [
    "money", "finance", "wealth", "rich", "debt", "loan", "invest", "income",
    "paisa", "dhan", "पैसा", "धन", "लोन",
  ],
  health: [
    "health", "sick", "illness", "disease", "wellness", "healing", "body",
    "sehat", "bimari", "सेहत", "बीमारी",
  ],
  purpose: [
    "purpose", "calling", "destiny", "soul", "meaning", "path", "spiritual",
    "dharma", "spirit", "journey", "why am i", "life mission", "धर्म", "आत्मा",
  ],
  timing: ["when", "timing", "soon", "wait", "how long", "kab", "कब", "समय"],
};

export function detectTopics(question: string): string[] {
  const t = (question || "").toLowerCase();
  const found: string[] = [];
  for (const [topic, words] of Object.entries(METHOD_KEYWORDS)) {
    if (words.some((w) => t.includes(w))) found.push(topic);
  }
  for (const [topic, words] of Object.entries(LIFE_KEYWORDS)) {
    if (words.some((w) => t.includes(w))) found.push(topic);
  }
  if (found.length === 0) found.push("general");
  return found;
}
