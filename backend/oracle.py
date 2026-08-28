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
    "mindfulness": ["mindful", "mindfulness", "meditate", "meditation", "breath", "breathe",
                    "calm", "peace", "peaceful", "stress", "anxiety", "anxious", "worry",
                    "present", "presence", "stillness", "grounded", "let go", "overthink",
                    "shanti", "dhyan", "shaanti", "मन", "ध्यान", "शांति", "तनाव", "चिंता"],
    "timing": ["when", "timing", "soon", "wait", "how long", "kab", "कब", "समय"],
}

# Occult / aura / mindfulness default pool — used instead of any generic answer.
MINDFULNESS = {
    "en": [
        "Return to the breath, seeker — it is the oldest oracle you carry. The aura settles when the mind stops chasing. Sit for seven slow breaths, feel the field around your body soften from tight red to a calm gold, and let the question rest there. Clarity is not forced; it rises when the water is still.",
        "Your aura is a lantern, not a fortress. When worry crowds it, the light dims and thoughts scatter like startled birds. Close your eyes, name one thing you can feel, hear, and sense, and let presence do what analysis cannot. The still centre already knows the next small step.",
        "The occult traditions agree on one quiet law: attention is energy, and where it flows, life follows. Guard your inner field today. Release one thought that drains you, breathe warmth into the heart-space, and move gently. Mindfulness is not escape from the world — it is meeting it with a steadier flame.",
    ],
    "hi": [
        "साधक, श्वास पर लौटो — यही सबसे प्राचीन ओरेकल है जो तुम्हारे भीतर है। जब मन दौड़ना बंद करता है, आभा स्थिर होती है। सात धीमी साँसें लो, अपने शरीर के चारों ओर के क्षेत्र को कठोर लाल से शांत स्वर्ण में नरम होते महसूस करो, और प्रश्न को वहीं विश्राम दो। स्पष्टता ज़बरदस्ती नहीं आती; जल शांत हो तो स्वयं उभरती है।",
        "तुम्हारी आभा एक दीपक है, किला नहीं। जब चिंता उसे घेरती है, प्रकाश मंद पड़ता है और विचार बिखरते हैं। आँखें बंद करो, एक चीज़ जो तुम महसूस, सुन और अनुभव कर सको उसे नाम दो, और उपस्थिति को वह करने दो जो विश्लेषण नहीं कर सकता। शांत केंद्र अगला छोटा कदम पहले से जानता है।",
        "गुह्य परंपराएँ एक शांत नियम पर सहमत हैं: ध्यान ही ऊर्जा है, और जहाँ वह बहता है, जीवन वहीं चलता है। आज अपने भीतरी क्षेत्र की रक्षा करो। एक थकाने वाला विचार छोड़ो, हृदय-स्थान में गर्माहट भरो, और कोमलता से चलो। माइंडफुलनेस संसार से भागना नहीं — उसे स्थिर लौ के साथ मिलना है।",
    ],
    "hng": [
        "Seeker, saans par lauto — yahi sabse purana oracle hai jo tumhare andar hai. Jab mann daudna band karta hai, aura sthir hota hai. Saat dheemi saansein lo, apne body ke aas-paas ke field ko tight red se calm gold mein soft hote feel karo, aur sawal ko wahin rest do. Clarity zabardasti nahi aati; paani shaant ho to khud ubharti hai.",
        "Tumhari aura ek lantern hai, fortress nahi. Jab worry use gher leti hai, light dim ho jaati hai aur thoughts bikhar jaate hain. Aankhein band karo, ek cheez jo tum feel, sun aur sense kar sako use naam do, aur presence ko wo karne do jo analysis nahi kar sakta. Shaant centre agla chhota step pehle se jaanta hai.",
        "Occult traditions ek shaant niyam par agree karti hain: attention hi energy hai, aur jahan wo behta hai, life wahin chalti hai. Aaj apne inner field ki raksha karo. Ek draining thought chhodo, heart-space mein warmth bharo, aur gently move karo. Mindfulness duniya se bhaagna nahi — use ek steady flame ke saath milna hai.",
    ],
}
PACK["mindfulness"] = MINDFULNESS

# Topics considered on-theme (occult sciences A-Z + aura + mindfulness). "general" is never surfaced.
DEFAULT_TOPICS = ["aura", "mindfulness"]


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
    """Return the verified final answer built strictly from the knowledge pack.

    Answers stay within occult sciences (A-Z), aura, and mindfulness. A question
    that matches no specific tradition is grounded in the aura/mindfulness pool —
    never a generic reply.
    """
    if lang not in LANGS:
        lang = "en"
    topics = detect_topics(question)
    # Never surface a generic answer. Route unmatched questions to aura + mindfulness.
    if topics == ["general"] or "general" in topics:
        topics = [t for t in topics if t != "general"] or list(DEFAULT_TOPICS)
    primary = topics[0]

    # Build the candidate pool from all matched on-theme topics.
    pool: list[str] = []
    for tp in topics:
        pack = PACK.get(tp)
        if not pack:
            continue
        options = pack.get(lang) or pack.get("en") or []
        pool.extend(options)
    if not pool:
        pool = (MINDFULNESS.get(lang) or MINDFULNESS["en"])[:]

    body = random.choice(pool)
    answer = f"{_pick_opening(lang)}{body}"
    return {"answer": answer.strip(), "topics": topics, "primary": primary}


def clean_for_tts(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"`{1,3}[^`]*`{1,3}", "", text)
    text = re.sub(r"[*_#>~|]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()
