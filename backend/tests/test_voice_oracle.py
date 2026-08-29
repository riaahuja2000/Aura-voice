"""AURA-VOICE Oracle Brain: voice-first tests for the Living Oracle OS.

Covers:
- Command detection: rescue, forget, delete_history, privacy, save, play, source, challenge
- Context memory in follow-up questions
- One-breath clarification with fresh user (no memory)
- /voice/refine with all six directions
- /voice/refine graceful "no reading" path
- Owner voice-log RBAC + shape
- Regression on /auth/login /auth/register /auth/me /settings /owner/overview
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = BASE_URL + "/api"

OWNER_EMAIL = "riaahuja2000@gmail.com"
OWNER_PW = "rioelixir"
CUSTOMER_EMAIL = "taromaya@gmail.com"
CUSTOMER_PW = "123456789"

# Voice consult calls Claude Sonnet — allow generous time
LLM_TIMEOUT = 60


def auth(t: str):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def owner_token(s):
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def customer_token(s):
    r = s.post(f"{API}/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PW}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def register_fresh(s) -> tuple[str, str, str]:
    """Register a brand-new customer so conversation memory starts empty."""
    email = f"test_voice_{uuid.uuid4().hex[:10]}@example.com"
    pw = "password12345"
    r = s.post(
        f"{API}/auth/register",
        json={"name": "TEST_Voice", "email": email, "password": pw},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    return d["token"], email, d["user"]["id"]


# ---------------------------------------------------------------- regression
class TestRegression:
    def test_root_online(self, s):
        r = s.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert "oracle" in r.json()["message"].lower()

    def test_login_owner(self, s, owner_token):
        r = s.get(f"{API}/auth/me", headers=auth(owner_token), timeout=10)
        assert r.status_code == 200
        me = r.json()
        assert me["email"] == OWNER_EMAIL
        assert me["is_owner"] is True

    def test_login_customer(self, s, customer_token):
        r = s.get(f"{API}/auth/me", headers=auth(customer_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "customer"

    def test_register_new_user(self, s):
        token, email, uid = register_fresh(s)
        r = s.get(f"{API}/auth/me", headers=auth(token), timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == email

    def test_settings_public(self, s):
        r = s.get(f"{API}/settings", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("app_name", "tagline", "subtitle", "voice", "speed"):
            assert k in d

    def test_owner_overview(self, s, owner_token):
        r = s.get(f"{API}/owner/overview", headers=auth(owner_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_sessions", "registered_users", "today", "most_asked", "last7", "members"):
            assert k in d


# ---------------------------------------------------------------- shape validation
def _assert_voice_shape(d: dict):
    for k in ("id", "question", "answer", "lang", "engine", "mode", "action", "created_at"):
        assert k in d, f"Missing field '{k}' in voice response: {d}"
    assert isinstance(d["answer"], str) and d["answer"].strip()
    # spoken prose — no markdown
    for bad in ("**", "##", "```", "* ", "- ", "•", "[", "]"):
        assert bad not in d["answer"], f"Answer contains markdown token {bad!r}: {d['answer'][:200]}"
    assert "_id" not in d


# ---------------------------------------------------------------- routing / engine
class TestVoiceConsultRouting:
    def test_tarot_question_routes_tarot(self, s, customer_token):
        r = s.post(
            f"{API}/voice/consult",
            json={"question": "Please pull a single tarot card for guidance on my week ahead.", "lang": "en"},
            headers=auth(customer_token),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_voice_shape(d)
        # Should route to tarot (or council if truly cross-tradition; but not general)
        assert d["engine"] in ("tarot", "council", "general"), d["engine"]
        # Prefer tarot
        if d["engine"] == "general":
            pytest.fail(f"Tarot-specific question routed to 'general': {d['answer'][:200]}")

    def test_dream_question_routes_dream(self, s, customer_token):
        r = s.post(
            f"{API}/voice/consult",
            json={"question": "I had a vivid dream about flying over a black ocean. What does this dream mean?", "lang": "en"},
            headers=auth(customer_token),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_voice_shape(d)
        assert d["engine"] in ("dream", "council"), d["engine"]

    def test_mindfulness_calm_routes_mindfulness(self, s, customer_token):
        # Not a rescue command phrase — a plain mindfulness question
        r = s.post(
            f"{API}/voice/consult",
            json={"question": "How can I use my breath to feel calmer before an interview?", "lang": "en"},
            headers=auth(customer_token),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_voice_shape(d)
        assert d["engine"] in ("mindfulness", "council"), d["engine"]


# ---------------------------------------------------------------- context memory
class TestContextMemory:
    def test_followup_stays_in_context(self, s):
        # fresh user — clean memory
        token, _email, _uid = register_fresh(s)
        r1 = s.post(
            f"{API}/voice/consult",
            json={
                "question": "My name is Arjun and I love someone at work named Priya, should I tell her?",
                "lang": "en",
            },
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        _assert_voice_shape(d1)

        # Follow-up with pronoun / oblique reference
        r2 = s.post(
            f"{API}/voice/consult",
            json={"question": "What if she says no?", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        _assert_voice_shape(d2)
        # Must NOT ask "who is she" — that would be a clarify, meaning memory failed.
        low = d2["answer"].lower()
        # Contextual references: allow either name mention or emotional/relational vocabulary
        contextual_signals = [
            "priya", "arjun", "she", "her", "rejection", "no", "reject",
            "confess", "confession", "feelings", "love", "work",
            "colleague", "friendship", "boundary", "heart", "answer",
        ]
        hits = sum(1 for w in contextual_signals if w in low)
        # If the oracle asks a clarify question here, memory is broken
        assert d2["mode"] != "clarify", (
            f"Follow-up returned clarify (memory not applied): {d2['answer']}"
        )
        assert hits >= 2, f"Follow-up seems to have lost context. Answer: {d2['answer']}"


# ---------------------------------------------------------------- one-breath clarification
class TestClarification:
    def test_ambiguous_question_triggers_clarify(self, s):
        # brand-new user so memory is empty
        token, _email, _uid = register_fresh(s)
        r = s.post(
            f"{API}/voice/consult",
            json={"question": "When will it happen?", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_voice_shape(d)
        # Should be clarify mode with a short question
        assert d["mode"] == "clarify", f"Expected mode=clarify, got mode={d['mode']}: {d['answer']}"
        assert d["action"] == "clarify"
        # ONE short question, ~15 words max — allow some slack
        word_count = len(d["answer"].split())
        assert word_count <= 30, f"Clarify answer too long ({word_count} words): {d['answer']}"
        assert "?" in d["answer"], "Clarify answer should contain a question mark"


# ---------------------------------------------------------------- spoken commands
class TestVoiceCommands:
    """Exact-phrase command detection. Uses fresh user so state is isolated."""

    def test_rescue_command(self, s):
        token, _email, _uid = register_fresh(s)
        r = s.post(
            f"{API}/voice/consult",
            json={"question": "Calm me now", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_voice_shape(d)
        assert d["action"] == "rescue"
        assert d["engine"] == "mindfulness"
        assert d["mode"] == "rescue"
        # Deterministic grounding script — check for breathing keywords
        low = d["answer"].lower()
        assert "breathe" in low or "breath" in low
        assert "safe" in low

    def test_save_and_play_flow(self, s):
        token, _email, _uid = register_fresh(s)

        # (1) real reading first
        r1 = s.post(
            f"{API}/voice/consult",
            json={"question": "Give me tarot guidance for my career this month.", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r1.status_code == 200, r1.text
        reading = r1.json()
        _assert_voice_shape(reading)
        original_answer = reading["answer"]

        # (2) save this moment
        r2 = s.post(
            f"{API}/voice/consult",
            json={"question": "save this moment", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        _assert_voice_shape(d2)
        assert d2["action"] == "saved"

        # (3) play my guidance -> should return the saved answer
        r3 = s.post(
            f"{API}/voice/consult",
            json={"question": "play my guidance", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r3.status_code == 200, r3.text
        d3 = r3.json()
        _assert_voice_shape(d3)
        assert d3["action"] == "bookmark"
        # The bookmark answer must equal the original saved reading
        assert d3["answer"] == original_answer

    def test_save_without_reading_returns_graceful(self, s):
        token, _email, _uid = register_fresh(s)
        r = s.post(
            f"{API}/voice/consult",
            json={"question": "save this moment", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_voice_shape(d)
        assert d["action"] == "none"
        assert "no reading" in d["answer"].lower() or "ask" in d["answer"].lower()

    def test_source_command(self, s):
        token, _email, _uid = register_fresh(s)
        # need a SUBSTANTIVE reading first (not a clarify)
        r0 = s.post(
            f"{API}/voice/consult",
            json={"question": "Pull a single tarot card for guidance on my work this week.", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r0.status_code == 200 and r0.json().get("mode") in ("answer", "council"), (
            f"Base reading not substantive: {r0.json()}"
        )
        r = s.post(
            f"{API}/voice/consult",
            json={"question": "where did this answer come from", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_voice_shape(d)
        # Refine flow returns mode=refine:source
        assert d["mode"] == "refine:source", f"Expected refine:source, got {d['mode']}"
        assert d["action"] == "answer"

    def test_challenge_command(self, s):
        token, _email, _uid = register_fresh(s)
        s.post(
            f"{API}/voice/consult",
            json={"question": "Pull a tarot card about my new project.", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        r = s.post(
            f"{API}/voice/consult",
            json={"question": "challenge this answer", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_voice_shape(d)
        assert d["mode"] == "refine:challenge", f"Expected refine:challenge, got {d['mode']}"

    def test_forget_command(self, s):
        token, _email, _uid = register_fresh(s)
        # seed a turn first
        s.post(
            f"{API}/voice/consult",
            json={"question": "My name is Zara, what tarot card describes me?", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        r = s.post(
            f"{API}/voice/consult",
            json={"question": "forget this conversation", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        _assert_voice_shape(d)
        assert d["action"] == "forgotten"
        assert d["mode"] == "system"

    def test_delete_history_command_clears_bookmarks(self, s, owner_token):
        # fresh user with a reading, save it, then delete
        token, email, uid = register_fresh(s)

        r1 = s.post(
            f"{API}/voice/consult",
            json={"question": "Give me a short mindfulness reading for tonight.", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r1.status_code == 200

        # save it
        r2 = s.post(
            f"{API}/voice/consult",
            json={"question": "save this moment", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r2.status_code == 200 and r2.json()["action"] == "saved"

        # verify voice-log sees this user's bookmark before deletion
        vlog_before = s.get(f"{API}/owner/voice-log", headers=auth(owner_token), timeout=15)
        assert vlog_before.status_code == 200
        rows_before = [r for r in vlog_before.json().get("readings", []) if r.get("user_id") == uid]
        assert rows_before, "Fresh user's voice readings not present in owner voice-log"

        # delete
        r3 = s.post(
            f"{API}/voice/consult",
            json={"question": "delete my voice history", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r3.status_code == 200, r3.text
        d3 = r3.json()
        _assert_voice_shape(d3)
        assert d3["action"] == "deleted"

        # After deletion: play my guidance should say "no bookmark"
        r4 = s.post(
            f"{API}/voice/consult",
            json={"question": "play my guidance", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r4.status_code == 200
        d4 = r4.json()
        _assert_voice_shape(d4)
        assert d4["action"] == "none", f"Expected action=none after delete, got: {d4}"

        # Voice-log should no longer show this user's rows
        vlog_after = s.get(f"{API}/owner/voice-log", headers=auth(owner_token), timeout=15)
        assert vlog_after.status_code == 200
        rows_after = [
            r for r in vlog_after.json().get("readings", [])
            if r.get("user_id") == uid and r.get("substantive")
        ]
        assert rows_after == [], f"Voice readings still present after delete: {rows_after}"


# ---------------------------------------------------------------- /voice/refine
class TestVoiceRefine:
    DIRECTIONS = ["deeper", "shorter", "practical", "alternative", "challenge", "source"]

    def test_refine_all_directions_after_reading(self, s):
        token, _email, _uid = register_fresh(s)
        # create a base reading
        r0 = s.post(
            f"{API}/voice/consult",
            json={"question": "Give me a short tarot reading about clarity in my current job.", "lang": "en"},
            headers=auth(token),
            timeout=LLM_TIMEOUT,
        )
        assert r0.status_code == 200, r0.text

        for direction in self.DIRECTIONS:
            r = s.post(
                f"{API}/voice/refine",
                json={"direction": direction, "lang": "en"},
                headers=auth(token),
                timeout=LLM_TIMEOUT,
            )
            assert r.status_code == 200, f"{direction} → {r.status_code} {r.text}"
            d = r.json()
            _assert_voice_shape(d)
            assert d["mode"] == f"refine:{direction}", f"{direction}: expected mode=refine:{direction}, got {d['mode']}"

    def test_refine_without_reading_graceful(self, s):
        token, _email, _uid = register_fresh(s)
        r = s.post(
            f"{API}/voice/refine",
            json={"direction": "deeper", "lang": "en"},
            headers=auth(token),
            timeout=30,
        )
        # Must be graceful 200 with action=none (NOT 4xx/5xx)
        assert r.status_code == 200, f"Expected graceful 200, got {r.status_code}: {r.text}"
        d = r.json()
        _assert_voice_shape(d)
        assert d["action"] == "none", f"Expected action=none, got {d['action']}"
        low = d["answer"].lower()
        assert "no reading" in low or "ask" in low or "orb" in low


# ---------------------------------------------------------------- /owner/voice-log
class TestOwnerVoiceLog:
    def test_customer_forbidden(self, s, customer_token):
        r = s.get(f"{API}/owner/voice-log", headers=auth(customer_token), timeout=15)
        assert r.status_code == 403

    def test_unauth_forbidden(self, s):
        r = s.get(f"{API}/owner/voice-log", timeout=15)
        assert r.status_code == 401

    def test_owner_shape(self, s, owner_token):
        r = s.get(f"{API}/owner/voice-log", headers=auth(owner_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("readings", "failed", "engines", "total", "bookmarks"):
            assert k in d, f"Missing key {k}"
        assert isinstance(d["readings"], list)
        assert isinstance(d["failed"], list)
        assert isinstance(d["engines"], list)
        assert isinstance(d["total"], int)
        assert isinstance(d["bookmarks"], int)
        # readings items should carry email + engine + mode
        if d["readings"]:
            r0 = d["readings"][0]
            for k in ("email", "engine", "mode", "question", "answer"):
                assert k in r0, f"Reading missing field {k}: {r0}"
            assert "_id" not in r0
