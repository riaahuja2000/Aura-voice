"""VELORA oracle engine.

The complete knowledge base (oracle-pack.json + the source PDF) lives ONLY on the
server and is never shipped to the client. Answers are produced strictly from this
stored knowledge pack: question -> topic detection -> knowledge-base answer -> verified
final answer text (which is then spoken).
"""
import json
import random
import re
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"

with open(KNOWLEDGE_DIR / "oracle-pack.json", "r", encoding="utf-8") as _f:
    PACK: dict = json.load(_f)

LANGS = ("en", "hi", "hng")

OPENINGS = {
    "en": [
        "Beloved seeker, ",
        "Hear me, child of the cosmos: ",
        "The veil thins for your question. ",
        "I have listened to your spirit. ",
        "Ancient eyes see your longing. ",
    ],
    "hi": [
        "प्रिय साधक, ",
        "हे ब्रह्मांड के बालक, सुनो: ",
        "तुम्हारे प्रश्न के लिए पर्दा पतला होता है। ",
        "मैंने तुम्हारी आत्मा सुनी है। ",
        "प्राचीन आँखें तुम्हारी लालसा देखती हैं। ",
    ],
    "hng": [
        "Pyare seeker, ",
        "He cosmos ke bachhe, suno: ",
        "Tumhare question ke liye pardaa patla hota hai. ",
        "Maine tumhari atma suni hai. ",
        "Ancient eyes tumhari longing dekhti hain. ",
    ],
}

METHOD_KEYWORDS = {
    "tarot": ["tarot", "card", "major arcana", "minor arcana", "spread", "fool", "magician",
              "high priestess", "empress", "emperor", "hierophant", "lovers", "chariot",
              "strength", "hermit", "wheel", "justice", "hanged", "death", "temperance",
              "devil", "tower", "star", "cups", "swords", "wands", "pentacles", "टैरो", "पत्ते"],
    "astrology": ["astrology", "zodiac", "planet", "saturn", "venus", "mars", "mercury",
                  "jupiter", "rising", "ascendant", "horoscope", "navagraha", "nakshatra",
                  "panchanga", "houses", "aspects", "aries", "taurus", "gemini", "cancer",
                  "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius",
                  "pisces", "retrograde", "transit", "jyotish", "kundli", "graha",
                  "ज्योतिष", "कुंडली", "राशि", "ग्रह"],
    "numerology": ["numerology", "number", "life path", "destiny number", "birth number",
                   "chaldean", "pythagorean", "lo shu", "gematria", "अंक", "अंकज्योतिष"],
    "runes": ["rune", "elder futhark", "ogham", "runes", "runic", "रून"],
    "crystals": ["crystal", "gem", "stone", "amethyst", "quartz", "rose quartz", "obsidian",
                 "citrine", "moonstone", "labradorite", "clear quartz", "क्रिस्टल", "रत्न"],
    "aura": ["chakra", "aura", "energy", "subtle body", "kundalini", "prana", "seven chakras",
             "root chakra", "heart chakra", "third eye", "आभा", "चक्र"],
    "palmistry": ["palmistry", "palm", "hand", "life line", "heart line", "head line",
                  "fate line", "mounts", "हस्तरेखा", "हथेली"],
    "feng-shui": ["feng shui", "vastu", "direction", "space", "bagua", "trigram",
                  "five phases", "five elements", "compass", "वास्तु", "फेंग शुई"],
    "kabbalah": ["kabbalah", "sefirot", "sephiroth", "hermetic", "alchemy", "tree of life",
                 "qabalah", "agrippa", "कब्बाला"],
    "i-ching": ["i ching", "yijing", "hexagram", "iching", "yi jing", "आई चिंग"],
}

LIFE_KEYWORDS = {
    "relationships": ["relationship", "love", "partner", "marriage", "spouse", "boyfriend",
                      "girlfriend", "husband", "wife", "breakup", "ex", "commitment", "date",
                      "dating", "pyaar", "ishq", "shaadi", "rishta", "प्यार", "शादी", "रिश्ता"],
    "career": ["career", "job", "work", "promotion", "boss", "office", "profession",
               "business", "kaam", "naukri", "नौकरी", "काम", "बिज़नेस"],
    "money": ["money", "finance", "wealth", "rich", "debt", "loan", "invest", "income",
              "paisa", "dhan", "पैसा", "धन", "लोन"],
    "health": ["health", "sick", "illness", "disease", "wellness", "healing", "body",
               "sehat", "bimari", "सेहत", "बीमारी"],
    "purpose": ["purpose", "calling", "destiny", "soul", "meaning", "path", "spiritual",
                "dharma", "spirit", "journey", "why am i", "life mission", "धर्म", "आत्मा"],
    "timing": ["when", "timing", "soon", "wait", "how long", "kab", "कब", "समय"],
}


def detect_topics(question: str) -> list[str]:
    t = (question or "").lower()
    found: list[str] = []
    for topic, words in METHOD_KEYWORDS.items():
        if any(w in t for w in words):
            found.append(topic)
    for topic, words in LIFE_KEYWORDS.items():
        if any(w in t for w in words):
            found.append(topic)
    if not found:
        found.append("general")
    return found


def _pick_opening(lang: str) -> str:
    return random.choice(OPENINGS.get(lang, OPENINGS["en"]))


def compose_answer(question: str, lang: str) -> dict:
    """Return the verified final answer built strictly from the knowledge pack."""
    if lang not in LANGS:
        lang = "en"
    topics = detect_topics(question)
    primary = topics[0] if topics else "general"
    pack = PACK.get(primary) or PACK["general"]
    options = pack.get(lang) or pack.get("en") or PACK["general"]["en"]
    body = random.choice(options) if options else PACK["general"]["en"][0]
    answer = f"{_pick_opening(lang)}{body}"
    return {"answer": answer.strip(), "topics": topics, "primary": primary}


def clean_for_tts(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"`{1,3}[^`]*`{1,3}", "", text)
    text = re.sub(r"[*_#>~|]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()
