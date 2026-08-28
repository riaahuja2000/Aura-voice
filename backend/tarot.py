"""TAROMAYA tarot engine + knowledge (complete 78-card Rider-Waite deck).

Pure data + draw logic, no interface. Meanings are short and easy to understand.
"""
from __future__ import annotations
import random

MAJOR = [
    ("The Fool", "a fresh start; take a leap with trust", "reckless; look before you jump", ["beginnings", "trust"]),
    ("The Magician", "you have the tools; make it happen", "self-doubt or tricks; be honest", ["power", "focus"]),
    ("The High Priestess", "trust your intuition; listen within", "ignoring your inner voice", ["intuition", "mystery"]),
    ("The Empress", "growth, care, and abundance", "care for yourself too", ["nurture", "abundance"]),
    ("The Emperor", "structure, leadership, stability", "too controlling; loosen up", ["order", "authority"]),
    ("The Hierophant", "tradition, learning, guidance", "break a rule that no longer fits", ["wisdom", "belief"]),
    ("The Lovers", "love and a choice from the heart", "disharmony; align your values", ["love", "choice"]),
    ("The Chariot", "willpower and victory; stay focused", "scattered; take back the reins", ["drive", "victory"]),
    ("Strength", "gentle courage; calm control", "self-doubt; be kind to yourself", ["courage", "calm"]),
    ("The Hermit", "seek quiet and inner wisdom", "too isolated; reconnect", ["reflection", "wisdom"]),
    ("Wheel of Fortune", "lucky change; go with the cycle", "a rough patch; it will turn", ["change", "luck"]),
    ("Justice", "fairness, truth, and balance", "own your part; face the truth", ["fairness", "truth"]),
    ("The Hanged Man", "pause and see it differently", "stuck; let go to move on", ["pause", "new view"]),
    ("Death", "an ending makes room for the new", "resisting needed change", ["endings", "renewal"]),
    ("Temperance", "balance and patience; blend well", "excess; find the middle", ["balance", "patience"]),
    ("The Devil", "watch habits that trap you", "breaking free from chains", ["habits", "freedom"]),
    ("The Tower", "a shake-up clears false ground", "avoiding a needed change", ["upheaval", "truth"]),
    ("The Star", "hope, healing, and calm faith", "renew your hope; don't give up", ["hope", "healing"]),
    ("The Moon", "trust feelings; fear hides truth", "confusion clears; truth surfaces", ["dreams", "mystery"]),
    ("The Sun", "joy, success, and clarity", "a small cloud passes; brighten up", ["joy", "success"]),
    ("Judgement", "a wake-up call; rise and renew", "self-judgement; forgive and move", ["renewal", "calling"]),
    ("The World", "completion and happy wholeness", "almost there; finish the loop", ["completion", "wholeness"]),
]

# rank -> (upright, reversed) per suit theme
_RANKS = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"]

MINOR = {
    "Wands": [
        ("a spark of new passion or idea", "delay; find your motivation"),
        ("planning your next bold move", "fear of the unknown; decide"),
        ("progress; your ships are coming", "delays; stay patient"),
        ("celebration, home, and harmony", "a small hiccup in the party"),
        ("friendly competition or squabbles", "avoid needless conflict"),
        ("victory and public praise", "keep going; recognition comes"),
        ("stand your ground bravely", "don't give up your position"),
        ("fast movement; news arrives", "things speed up soon"),
        ("resilient; one more push", "tired; rest then continue"),
        ("carrying a heavy load", "put some burdens down"),
        ("a curious spark; explore it", "scattered ideas; focus"),
        ("bold action and adventure", "impatience; think first"),
        ("warm, confident, and lively", "recentre your fire"),
        ("visionary leader; inspire others", "temper; lead calmly"),
    ],
    "Cups": [
        ("new love or deep feeling begins", "guard your heart gently"),
        ("a loving bond or partnership", "mend a small rift"),
        ("friendship and celebration", "too much party; balance"),
        ("feeling bored; a gift you missed", "open up; say yes again"),
        ("grief over a loss; hope remains", "healing; see what's left"),
        ("sweet memories and kindness", "let go of the past gently"),
        ("many choices; dream clearly", "pick one real option"),
        ("walk away to find deeper meaning", "fear of leaving; be brave"),
        ("wish granted; contentment", "true joy over show"),
        ("happy family and lasting love", "mend home harmony"),
        ("a sweet message or new feeling", "moody; share your heart"),
        ("romance and a heartfelt offer", "check if promises are real"),
        ("caring, intuitive, and warm", "refill your own cup"),
        ("calm, wise, and kind-hearted", "balance feelings and logic"),
    ],
    "Swords": [
        ("clear truth and a fresh idea", "confusion; find clarity"),
        ("a hard choice; weigh it calmly", "decide; stop stalling"),
        ("heartache; let it out to heal", "healing begins; release pain"),
        ("rest and recover your mind", "time to wake and act"),
        ("a win with a cost; choose peace", "let go of the fight"),
        ("moving to calmer waters", "the shift is coming"),
        ("be smart; watch for tricks", "come clean; return what's due"),
        ("you feel trapped by thoughts", "free yourself; you can move"),
        ("worry and sleepless nights", "fear fades in daylight"),
        ("a painful ending; dawn follows", "recovery; the worst has passed"),
        ("curious mind; watch and learn", "guard your words"),
        ("fast, bold, and direct", "slow down; think of others"),
        ("clear-headed and honest", "soften your words"),
        ("a fair, logical leader", "be fair, not cold"),
    ],
    "Pentacles": [
        ("a new chance for money or work", "don't miss the opportunity"),
        ("juggling well; stay flexible", "over-loaded; simplify"),
        ("teamwork builds something good", "improve skills together"),
        ("saving and holding steady", "loosen your grip a little"),
        ("hard times; help is near", "recovery; ask for support"),
        ("giving and receiving fairly", "check the balance of giving"),
        ("patience; your effort grows", "reassess; don't quit early"),
        ("practice makes you skilled", "focus on quality, not rush"),
        ("comfort earned by yourself", "enjoy what you built"),
        ("lasting wealth and family", "protect long-term security"),
        ("a student of money and skills", "finish what you start"),
        ("steady, reliable worker", "avoid getting stuck"),
        ("practical, nurturing, secure", "balance self-care and work"),
        ("a successful, stable provider", "balance money and heart"),
    ],
}


def _build_deck() -> list[dict]:
    deck: list[dict] = []
    for i, (name, up, rev, kw) in enumerate(MAJOR):
        deck.append({"id": f"major-{i}", "name": name, "arcana": "Major", "suit": None,
                     "rank": None, "upright": up, "reversed": rev, "keywords": kw})
    for suit, rows in MINOR.items():
        for idx, (up, rev) in enumerate(rows):
            rank = _RANKS[idx]
            deck.append({"id": f"{suit.lower()}-{rank.lower()}", "name": f"{rank} of {suit}",
                         "arcana": "Minor", "suit": suit, "rank": rank,
                         "upright": up, "reversed": rev, "keywords": [suit.lower()]})
    return deck


DECK = _build_deck()  # 78 cards

SPREADS = {
    "single": ["Your card"],
    "three": ["Past", "Present", "Future"],
    "situation": ["Situation", "Action", "Outcome"],
    "five": ["You", "Challenge", "Advice", "Nearby", "Outcome"],
}


def draw(spread: str = "three") -> dict:
    positions = SPREADS.get(spread) or SPREADS["three"]
    picks = random.sample(DECK, len(positions))
    cards = []
    for pos, card in zip(positions, picks):
        reversed_ = random.random() < 0.35
        cards.append({
            "position": pos,
            "id": card["id"],
            "name": card["name"],
            "arcana": card["arcana"],
            "suit": card["suit"],
            "orientation": "reversed" if reversed_ else "upright",
            "meaning": card["reversed"] if reversed_ else card["upright"],
            "keywords": card["keywords"],
        })
    return {"spread": spread, "positions": positions, "cards": cards}
