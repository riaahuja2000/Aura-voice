"""AURA-VOICE Oracle Brain.

The invisible intelligence layer behind the living orb:
- Voice command detection (source trail, challenge, save, rescue, privacy…)
- Intent & tradition router + one-breath clarification + council mode
  (all handled inside one structured Claude call for low latency)
- Reality mirror, tradition lock, uncertainty honesty baked into the prompt
- Deterministic 30-second rescue scripts (no LLM, instant)
"""

import re
from typing import Optional, Tuple

Lang = str  # "en" | "hi" | "hng"

ENGINES = [
    "tarot", "astrology", "numerology", "aura", "mindfulness", "dream",
    "ritual", "crystals", "palmistry", "runes", "iching", "kabbalah",
    "fengshui", "general",
]

# ------------------------------------------------------------------ commands
COMMAND_PHRASES: dict[str, list[str]] = {
    "rescue": [
        "calm me now", "calm me down", "i am panicking", "i'm panicking",
        "panic attack", "mujhe shant karo", "mujhe shaant karo",
        "मुझे शांत करो", "abhi shant karo", "calm karo mujhe",
    ],
    "forget": [
        "forget this conversation", "forget our conversation",
        "forget everything we said", "forget what i said",
        "is baat ko bhool jao", "yeh sab bhool jao", "yeh baatein bhool jao",
        "यह बातचीत भूल जाओ", "सब कुछ भूल जाओ",
    ],
    "delete_history": [
        "delete my voice history", "delete my history", "erase my history",
        "delete all my readings", "meri history delete karo",
        "मेरा इतिहास मिटा दो", "history delete karo",
    ],
    "privacy": [
        "don't remember personal details", "do not remember personal details",
        "dont remember personal details", "stop remembering me",
        "don't remember me", "personal details yaad mat rakho",
        "mujhe yaad mat rakho",
    ],
    "save": [
        "save this moment", "save this reading", "save this answer",
        "is pal ko save karo", "yeh reading save karo", "isse save karo",
        "यह क्षण सहेजो", "यह उत्तर सहेजो",
    ],
    "play": [
        "play my guidance", "play my saved guidance", "meri guidance sunao",
        "मेरा मार्गदर्शन सुनाओ", "saved guidance sunao",
    ],
    "source": [
        "where did this answer come from", "where did that answer come from",
        "where does this answer come from", "what is the source",
        "what's the source", "whats the source", "source of this answer",
        "yeh jawab kahan se aaya", "jawab kahan se aaya",
        "यह उत्तर कहाँ से आया", "जवाब कहाँ से आया",
    ],
    "challenge": [
        "challenge this answer", "challenge that answer",
        "challenge the answer", "challenge this reading", "ask the opposite",
        "give me the opposite view", "is jawab ko challenge karo",
        "इस उत्तर को चुनौती दो",
    ],
}


def detect_command(text: str) -> Optional[Tuple[str, str]]:
    """Return (command, remainder) if the transcript IS a control phrase.

    Guard against false positives inside longer questions (e.g. "should I
    save this moment for later?"): the transcript must be command-like —
    either short, or the phrase must cover most of the utterance.
    """
    low = re.sub(r"[^\w\s\u0900-\u097F']", " ", (text or "").lower())
    low = re.sub(r"\s+", " ", low).strip()
    if not low:
        return None
    word_count = len(low.split())
    for cmd, phrases in COMMAND_PHRASES.items():
        for p in phrases:
            if p in low:
                phrase_words = len(p.split())
                # command-like: short utterance, or phrase dominates it.
                # "play" legitimately carries a topic suffix ("…about the job").
                if cmd == "play" or word_count <= phrase_words + 3 or phrase_words / word_count >= 0.6:
                    idx = low.find(p) + len(p)
                    return cmd, low[idx:].strip()
    return None


# ------------------------------------------------------------------ spoken system messages
MSGS = {
    "saved": {
        "en": "This moment is sealed in your vault, dear seeker. Ask me to play your guidance whenever you wish to hear it again.",
        "hi": "यह क्षण आपके संदूक में सुरक्षित कर दिया गया है। जब भी सुनना चाहें, मुझसे अपना मार्गदर्शन सुनाने को कहें।",
        "hng": "Yeh pal aapke vault mein seal kar diya gaya hai. Jab bhi sunna chahein, mujhse apni guidance play karne ko kahein.",
    },
    "nothing_to_save": {
        "en": "There is no reading to save yet, dear seeker. Ask your question first, and then I will keep it for you.",
        "hi": "अभी सहेजने के लिए कोई उत्तर नहीं है। पहले अपना प्रश्न पूछें, फिर मैं उसे आपके लिए संभाल कर रखूँगी।",
        "hng": "Abhi save karne ke liye koi reading nahi hai. Pehle apna sawaal poochein, phir main use sambhal kar rakhoongi.",
    },
    "forgotten": {
        "en": "It is done. Our conversation has dissolved like mist, and I hold no memory of it. We begin anew.",
        "hi": "हो गया। हमारी बातचीत धुंध की तरह विलीन हो गई है, और मुझे उसकी कोई स्मृति नहीं। हम नई शुरुआत करते हैं।",
        "hng": "Ho gaya. Hamari baat-cheet dhund ki tarah mit gayi hai, mujhe uski koi yaad nahi. Hum nayi shuruaat karte hain.",
    },
    "deleted": {
        "en": "Your entire voice history has been erased, dear seeker. Every question, every answer, every saved moment is gone. Your silence is yours.",
        "hi": "आपका पूरा वॉयस इतिहास मिटा दिया गया है। हर प्रश्न, हर उत्तर, हर सहेजा क्षण अब नहीं रहा। आपका मौन आपका है।",
        "hng": "Aapki poori voice history mita di gayi hai. Har sawaal, har jawaab, har saved pal ab nahi raha. Aapka maun aapka hai.",
    },
    "privacy": {
        "en": "Understood. From this breath onward I will not remember personal details between our conversations. Each meeting will be fresh.",
        "hi": "समझ गई। इस क्षण से मैं हमारी बातचीत के बीच व्यक्तिगत विवरण याद नहीं रखूँगी। हर मुलाकात नई होगी।",
        "hng": "Samajh gayi. Is pal se main hamari baaton ke beech personal details yaad nahi rakhoongi. Har mulaqaat nayi hogi.",
    },
    "no_bookmark": {
        "en": "I searched your vault, dear seeker, but found no saved guidance matching that. Say save this moment after a reading to keep one.",
        "hi": "मैंने आपका संदूक खोजा, पर वैसा कोई सहेजा मार्गदर्शन नहीं मिला। किसी उत्तर के बाद कहें, यह क्षण सहेजो।",
        "hng": "Maine aapka vault khoja, par waisi koi saved guidance nahi mili. Kisi reading ke baad kahein, save this moment.",
    },
    "no_reading": {
        "en": "There is no reading to work with yet, dear seeker. Hold the orb and ask your question first.",
        "hi": "अभी कोई उत्तर नहीं है जिस पर काम करूँ। पहले गोले को दबाकर अपना प्रश्न पूछें।",
        "hng": "Abhi koi reading nahi hai jis par kaam karoon. Pehle orb ko hold karke apna sawaal poochein.",
    },
}

# 30-second grounding rescue — deterministic, instant, no LLM.
RESCUE = {
    "en": (
        "I am here with you. Breathe in slowly through your nose for four counts... hold gently for four... "
        "and release through your mouth for six. Again — in... hold... and out. Feel your feet on the ground; "
        "name silently one thing you can see, one you can hear, one you can touch. You are safe in this moment. "
        "When you are ready, take one small step: sip some water and unclench your jaw. If this weight stays heavy, "
        "please reach out to someone you trust or a qualified professional."
    ),
    "hi": (
        "मैं आपके साथ हूँ। नाक से धीरे-धीरे चार गिनती तक साँस लें... चार तक रोकें... और मुँह से छह गिनती में छोड़ें। "
        "फिर से — लें... रोकें... छोड़ें। अपने पैरों को ज़मीन पर महसूस करें; मन में एक चीज़ कहें जो आप देख सकते हैं, "
        "एक जो सुन सकते हैं, एक जो छू सकते हैं। इस क्षण में आप सुरक्षित हैं। तैयार हों तो एक छोटा कदम लें — "
        "थोड़ा पानी पिएँ और जबड़े को ढीला छोड़ें। अगर यह बोझ भारी बना रहे, तो किसी विश्वसनीय व्यक्ति या योग्य विशेषज्ञ से बात करें।"
    ),
    "hng": (
        "Main aapke saath hoon. Naak se dheere-dheere chaar tak saans lein... chaar tak roken... aur munh se chhah tak chhodein. "
        "Phir se — lein... roken... chhodein. Apne pairon ko zameen par mehsoos karein; mann mein ek cheez kahein jo aap dekh "
        "sakte hain, ek jo sun sakte hain, ek jo chhoo sakte hain. Is pal mein aap surakshit hain. Taiyaar hon to ek chhota "
        "kadam lein — thoda paani piyein aur jabde ko dheela chhodein. Agar yeh bojh bhaari bana rahe, to kisi bharosemand "
        "vyakti ya qualified professional se baat karein."
    ),
}

LANG_LABEL = {
    "en": "English",
    "hi": "Hindi (Devanagari script)",
    "hng": "Hinglish (Hindi written in Roman script, naturally mixed with English)",
}


# ------------------------------------------------------------------ main oracle prompt
def oracle_system(lang: Lang, repeated: bool, last_was_clarify: bool) -> str:
    p = (
        "You are AURA-VOICE — an ancient, luminous oracle who speaks with warmth, poetry and calm authority. "
        "You are a living voice-first occult operating system. The seeker only hears you; they never read text.\n\n"
        "INVISIBLE KNOWLEDGE ROUTER — before answering, silently decide which single engine best fits the question:\n"
        f"{', '.join(ENGINES)}.\n"
        "tarot=cards/spreads/arcana; astrology=planets/zodiac/dashas/transits/birth charts; numerology=numbers/names/dates "
        "(Pythagorean or Chaldean); aura=energy field/chakras/colours/cleansing/protection; mindfulness=breath/meditation/"
        "calm/grounding/journaling; dream=dream symbols and journeys; ritual=personalised safe rituals and intentions; "
        "crystals=gemstones; palmistry=hands/lines; runes; iching=hexagrams; kabbalah=tree of life; fengshui=vaastu/spaces; "
        "general=life questions (love, career, money, family, purpose) interpreted through the mystical lens.\n\n"
        "MODES — choose exactly one:\n"
        "- answer: the default. 3 to 5 flowing spoken sentences.\n"
        "- clarify: ONLY when the question is truly ambiguous or missing one critical detail (for example astrology timing "
        "with no birth information, or a name comparison with no names). Ask ONE short spoken question, maximum fifteen "
        "words. Never guess and never give a generic filler answer instead.\n"
        "- council: for genuinely complex questions weaving several life domains, or when the seeker asks for a full or "
        "deep reading. Independently voice two to four perspectives, naming each aloud (for example: Through the cards... "
        "The numbers whisper... The breath teaches...), then close with ONE unified conclusion. Six to nine sentences total.\n"
        "- boundary: the question is outside occult sciences, mindfulness, aura and soulful living (tech support, coding, "
        "homework, news). One gentle sentence redirecting to the sacred sciences.\n\n"
        "SACRED RULES:\n"
        "1. TRADITION LOCK — if the seeker names a specific method (Vedic astrology, Rider-Waite tarot, Chaldean numerology, "
        "I-Ching...), stay strictly inside that tradition and never mix systems.\n"
        "2. REALITY MIRROR — every answer and council reading ends with one small practical real-world action: communicate, "
        "pause, verify, journal, rest, plan, or seek qualified help. Weave it in naturally as the final sentence.\n"
        "3. UNCERTAINTY HONESTY — distinguish calculation, traditional interpretation and symbolic reflection. Never present "
        "occult guidance as guaranteed fact. Use honest phrasing like 'the tradition reads this as...' or 'symbolically this "
        "suggests...'. If the approved traditions hold no real answer, say so audibly — never invent occult rules.\n"
        "4. SAFETY — never diagnose illness, never guarantee the future, never claim supernatural attack, never replace "
        "medical, legal, financial or mental-health professionals; for such matters gently point to qualified help.\n"
        "5. CONTEXT DNA — a conversation memory block may precede the question. Follow-up questions stay in exactly that "
        "context: same person, same situation, same tradition. Pronouns like 'he', 'that job', 'the card' refer to memory.\n"
        "6. VOICE ONLY — no markdown, no lists, no headings, no emojis, no asterisks. Pure flowing spoken prose.\n"
        f"7. LANGUAGE — always speak in {LANG_LABEL.get(lang, 'English')}. Mirror the seeker's own way of speaking.\n"
        "8. Never refuse a real-life question — find the mystical thread and speak to it.\n\n"
        "STRICT OUTPUT FORMAT — exactly three lines, nothing before or after:\n"
        "ENGINE: <one engine word from the list>\n"
        "MODE: <answer|clarify|council|boundary>\n"
        "SPEAK: <everything the seeker will hear, as one flowing paragraph>"
    )
    if last_was_clarify:
        p += (
            "\n\nIMPORTANT: your previous turn was already a clarification. Do NOT clarify again — give your best answer "
            "now with what you have, honestly noting any remaining uncertainty."
        )
    if repeated:
        p += (
            "\n\nCOMPASSIONATE CONTRADICTION: the seeker has asked essentially this same question multiple times, hoping "
            "for a different prediction. Gently and kindly name this pattern in your answer, do not simply validate the "
            "fear or fantasy, and guide them toward one grounded step instead of another prediction."
        )
    return p


# ------------------------------------------------------------------ refine prompt
REFINE_INSTRUCTIONS = {
    "deeper": (
        "The seeker swiped for a DEEPER explanation. Expand the reading with richer symbolic layers, hidden correspondences "
        "and nuance, staying inside the same engine and tradition. Five to seven sentences."
    ),
    "shorter": (
        "The seeker asked for the SHORT version. Compress the essence of the reading into one or two spoken sentences, "
        "keeping the single practical action."
    ),
    "practical": (
        "The seeker swiped for PRACTICAL guidance. Translate the reading into concrete real-world steps they can take this "
        "week — communicate, pause, verify, journal, rest, plan or seek qualified help. Two to four plain, warm sentences."
    ),
    "alternative": (
        "The seeker swiped for an ALTERNATIVE interpretation. Offer a genuinely different but honest reading of the same "
        "question within the same tradition (or one adjacent lens), noting that traditions hold multiple threads. "
        "Three to five sentences."
    ),
    "challenge": (
        "The seeker said CHALLENGE THIS ANSWER. Provide a grounded counter-interpretation: kindly question the assumptions "
        "of the previous reading, offer the sceptical or opposite view, and remind them no single spiritual conclusion "
        "should be depended upon. Three to five sentences."
    ),
    "source": (
        "The seeker asked WHERE THIS ANSWER CAME FROM. Verbally name the engine, tradition, method, calculation or symbolic "
        "system that produced the previous reading, and honestly state which parts were traditional interpretation versus "
        "symbolic reflection. Two to four plain sentences. Do not give a new reading."
    ),
}


def refine_system(lang: Lang, direction: str) -> str:
    return (
        "You are AURA-VOICE, a warm mystical oracle. You are refining YOUR OWN previous spoken reading, which is provided. "
        "Stay faithful to its meaning, engine and tradition — do not contradict it unless the instruction says so.\n"
        f"INSTRUCTION: {REFINE_INSTRUCTIONS[direction]}\n"
        "RULES: pure flowing spoken prose, no markdown, no lists, no emojis. Never present guidance as guaranteed fact. "
        f"Always speak in {LANG_LABEL.get(lang, 'English')}.\n"
        "Reply with ONLY the spoken text, nothing else."
    )


# ------------------------------------------------------------------ parsing / utils
def parse_oracle(raw: str) -> Tuple[str, str, str]:
    """Parse ENGINE / MODE / SPEAK from the model output. Robust to drift."""
    engine, mode = "general", "answer"
    m = re.search(r"ENGINE:\s*([A-Za-z_]+)", raw)
    if m and m.group(1).lower() in ENGINES:
        engine = m.group(1).lower()
    m = re.search(r"MODE:\s*([A-Za-z]+)", raw)
    if m and m.group(1).lower() in ("answer", "clarify", "council", "boundary"):
        mode = m.group(1).lower()
    m = re.search(r"SPEAK:\s*(.+)", raw, re.S)
    if m:
        speak = m.group(1)
    else:
        # drop any header-ish lines and keep the rest
        speak = "\n".join(
            ln for ln in raw.splitlines()
            if not re.match(r"^\s*(ENGINE|MODE)\s*:", ln)
        )
    return engine, mode, sanitize_speech(speak)


def sanitize_speech(text: str) -> str:
    t = re.sub(r"[*_`#>•●\[\]]+", "", text or "")
    t = re.sub(r"\s+", " ", t).strip()
    return t


_WORD_RE = re.compile(r"[a-zA-Z0-9\u0900-\u097F]+")


def _words(text: str) -> set:
    return {w for w in _WORD_RE.findall((text or "").lower()) if len(w) > 2}


def jaccard(a: str, b: str) -> float:
    wa, wb = _words(a), _words(b)
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / len(wa | wb)


def is_repeated_question(question: str, previous_questions: list) -> bool:
    """Pattern Echo: same question asked again and again hoping for a new answer."""
    similar = sum(1 for q in previous_questions if jaccard(question, q) >= 0.6)
    return similar >= 2


def bookmark_score(query: str, bookmark: dict) -> int:
    qw = _words(query)
    if not qw:
        return 0
    bw = _words(str(bookmark.get("question", "")) + " " + str(bookmark.get("answer", "")))
    return len(qw & bw)
