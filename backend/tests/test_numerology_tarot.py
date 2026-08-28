"""VELORA — Numerology + Tarot engine tests (round 3).

Covers:
- POST /api/numerology/reading (auth, master-number preservation, validation)
- GET  /api/tarot/deck (78 cards, spreads, shape)
- POST /api/tarot/draw (cardinality per spread, uniqueness, orientation<->meaning)
- Regression: /oracle/consult (no 'general'), /oracle/illustrate (PNG), owner RBAC.
"""
import os
import pytest
import requests

_env = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert _env, "EXPO_PUBLIC_BACKEND_URL must be set"
BASE_URL = _env.rstrip("/")
API = BASE_URL + "/api"

OWNER_EMAIL = "riaahuja2000@gmail.com"
OWNER_PW = "rioelixir"
CUSTOMER_EMAIL = "taromaya@gmail.com"
CUSTOMER_PW = "123456789"


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def customer_token(s):
    r = s.post(f"{API}/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PW})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_token(s):
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------------------------------------------------------------- NUMEROLOGY
class TestNumerology:
    def test_requires_auth(self, s):
        r = s.post(f"{API}/numerology/reading",
                   json={"full_name": "Ria Ahuja", "dob": "2000-11-29"})
        assert r.status_code == 401

    def test_reading_shape_and_values(self, s, customer_token):
        r = s.post(f"{API}/numerology/reading",
                   json={"full_name": "Ria Ahuja", "dob": "2000-11-29"},
                   headers=_auth(customer_token))
        assert r.status_code == 200, r.text
        d = r.json()

        # Envelope
        assert d["name"] == "Ria Ahuja"
        assert d["dob"] == "2000-11-29"
        nums = d["numbers"]
        chart = d["chart"]

        # All six numbers present
        for k in ("life_path", "expression", "soul_urge", "personality", "birthday", "maturity"):
            assert k in nums, f"missing number {k}"
            assert k in chart, f"missing chart {k}"
            item = chart[k]
            for f in ("number", "title", "keywords", "meaning", "dimension"):
                assert f in item, f"chart[{k}] missing {f}"
            assert isinstance(item["keywords"], list) and len(item["keywords"]) >= 2
            assert item["number"] == nums[k]

        # Ria Ahuja / 2000-11-29 -> agent-verified values
        assert nums["life_path"] == 6
        assert nums["expression"] == 33   # master preserved
        assert nums["birthday"] == 11     # master preserved (day 29 -> 2+9=11)

        # Master numbers preserved (not reduced) in chart entries
        assert chart["expression"]["number"] == 33
        assert "Master" in chart["expression"]["title"]
        assert chart["birthday"]["number"] == 11
        assert "Master" in chart["birthday"]["title"]

    def test_all_numbers_in_valid_range(self, s, customer_token):
        # Every reported number must be in [1..9] ∪ {11, 22, 33}.
        r = s.post(f"{API}/numerology/reading",
                   json={"full_name": "Alice Marie Anderson", "dob": "1984-04-04"},
                   headers=_auth(customer_token))
        assert r.status_code == 200, r.text
        d = r.json()
        allowed = set(range(1, 10)) | {11, 22, 33}
        for k, v in d["numbers"].items():
            assert v in allowed, f"{k}={v} not in allowed set"

    def test_name_without_vowels_no_500(self, s, customer_token):
        # BUG FIX: no-vowel name must return 200 (not 500) with a valid chart.
        r = s.post(f"{API}/numerology/reading",
                   json={"full_name": "K K", "dob": "1990-01-01"},
                   headers=_auth(customer_token))
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        d = r.json()
        # Chart entries must all be well-formed (fallback to a valid number).
        allowed = set(range(1, 10)) | {11, 22, 33}
        for k in ("life_path", "expression", "soul_urge", "personality", "birthday", "maturity"):
            item = d["chart"][k]
            for f in ("number", "title", "keywords", "meaning", "dimension"):
                assert f in item, f"chart[{k}] missing {f}"
            assert item["number"] in allowed, f"chart[{k}].number={item['number']} invalid"

    def test_name_without_consonants_no_500(self, s, customer_token):
        # BUG FIX: no-consonant name must also not 500.
        r = s.post(f"{API}/numerology/reading",
                   json={"full_name": "AEI OU", "dob": "1990-01-01"},
                   headers=_auth(customer_token))
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        d = r.json()
        allowed = set(range(1, 10)) | {11, 22, 33}
        for k in ("life_path", "expression", "soul_urge", "personality", "birthday", "maturity"):
            item = d["chart"][k]
            assert item["number"] in allowed, f"chart[{k}].number={item['number']} invalid"

    def test_invalid_dob_400(self, s, customer_token):
        r = s.post(f"{API}/numerology/reading",
                   json={"full_name": "Ria Ahuja", "dob": "notadate"},
                   headers=_auth(customer_token))
        assert r.status_code == 400, r.text

    def test_invalid_dob_out_of_range_400(self, s, customer_token):
        r = s.post(f"{API}/numerology/reading",
                   json={"full_name": "Ria Ahuja", "dob": "2000-13-40"},
                   headers=_auth(customer_token))
        assert r.status_code == 400, r.text

    def test_empty_name_rejected(self, s, customer_token):
        # BUG FIX: empty full_name must be normalised to 400 (not 422/500).
        r = s.post(f"{API}/numerology/reading",
                   json={"full_name": "", "dob": "2000-11-29"},
                   headers=_auth(customer_token))
        assert r.status_code == 400, f"expected 400 for empty name, got {r.status_code}: {r.text}"

        r2 = s.post(f"{API}/numerology/reading",
                    json={"full_name": "   ", "dob": "2000-11-29"},
                    headers=_auth(customer_token))
        assert r2.status_code == 400, r2.text


# ---------------------------------------------------------------- TAROT DECK
class TestTarotDeck:
    def test_requires_auth(self, s):
        r = s.get(f"{API}/tarot/deck")
        assert r.status_code == 401

    def test_deck_shape(self, s, customer_token):
        r = s.get(f"{API}/tarot/deck", headers=_auth(customer_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["count"] == 78
        assert set(d["spreads"]) == {"single", "three", "situation", "five"}
        cards = d["cards"]
        assert len(cards) == 78

        # 22 Major + 4 * 14 Minor
        majors = [c for c in cards if c["arcana"] == "Major"]
        minors = [c for c in cards if c["arcana"] == "Minor"]
        assert len(majors) == 22
        assert len(minors) == 56
        for suit in ("Wands", "Cups", "Swords", "Pentacles"):
            assert len([c for c in minors if c["suit"] == suit]) == 14

        # Every card has required fields
        for c in cards:
            for f in ("id", "name", "arcana", "suit", "upright", "reversed", "keywords"):
                assert f in c, f"card {c.get('name')} missing {f}"
            assert isinstance(c["keywords"], list) and len(c["keywords"]) >= 1
            assert isinstance(c["upright"], str) and len(c["upright"]) > 0
            assert isinstance(c["reversed"], str) and len(c["reversed"]) > 0

        # IDs unique
        ids = [c["id"] for c in cards]
        assert len(ids) == len(set(ids))


# ---------------------------------------------------------------- TAROT DRAW
class TestTarotDraw:
    def test_requires_auth(self, s):
        r = s.post(f"{API}/tarot/draw", json={"spread": "single"})
        assert r.status_code == 401

    @pytest.mark.parametrize("spread,n", [
        ("single", 1),
        ("three", 3),
        ("situation", 3),
        ("five", 5),
    ])
    def test_draw_cardinality_and_orientation(self, s, customer_token, spread, n):
        r = s.post(f"{API}/tarot/draw", json={"spread": spread}, headers=_auth(customer_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["spread"] == spread
        assert len(d["positions"]) == n
        assert len(d["cards"]) == n

        # Cards unique within a draw
        ids = [c["id"] for c in d["cards"]]
        assert len(ids) == len(set(ids)), f"duplicate cards in draw: {ids}"

        # Positions and orientation<->meaning
        # Fetch full deck once to cross-check meanings
        for card in d["cards"]:
            assert card["orientation"] in ("upright", "reversed")
            assert card["position"] in d["positions"]
            assert isinstance(card["meaning"], str) and len(card["meaning"]) > 0

    def test_draw_meaning_matches_orientation(self, s, customer_token):
        # Get deck map: id -> (upright, reversed)
        deck = s.get(f"{API}/tarot/deck", headers=_auth(customer_token)).json()["cards"]
        by_id = {c["id"]: c for c in deck}

        # Draw the biggest spread to sample more cards
        r = s.post(f"{API}/tarot/draw", json={"spread": "five"}, headers=_auth(customer_token))
        assert r.status_code == 200
        for card in r.json()["cards"]:
            src = by_id[card["id"]]
            if card["orientation"] == "upright":
                assert card["meaning"] == src["upright"]
            else:
                assert card["meaning"] == src["reversed"]

    def test_invalid_spread_rejected(self, s, customer_token):
        r = s.post(f"{API}/tarot/draw", json={"spread": "seven"}, headers=_auth(customer_token))
        # Pydantic Literal -> 422
        assert r.status_code in (400, 422)


# ---------------------------------------------------------------- REGRESSION
class TestRegression:
    def test_consult_no_general_topic(self, s, customer_token):
        r = s.post(f"{API}/oracle/consult",
                   json={"question": "What do the cards say for my new job?", "lang": "en"},
                   headers=_auth(customer_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "general" not in d.get("topics", [])
        assert d.get("primary") != "general"
        assert len(d.get("answer", "")) < 500  # ELI5 short

    def test_illustrate_png(self, s, customer_token):
        r = s.post(f"{API}/oracle/illustrate",
                   json={"text": "Small brave step in soft light.", "lang": "en"},
                   headers=_auth(customer_token), timeout=120)
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/img/") and url.endswith(".png")
        r2 = requests.get(BASE_URL + url, timeout=60)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/png")
        assert len(r2.content) > 10_000

    def test_owner_overview_forbidden_for_customer(self, s, customer_token):
        r = s.get(f"{API}/owner/overview", headers=_auth(customer_token))
        assert r.status_code == 403

    def test_owner_overview_ok_for_owner(self, s, owner_token):
        r = s.get(f"{API}/owner/overview", headers=_auth(owner_token))
        assert r.status_code == 200
