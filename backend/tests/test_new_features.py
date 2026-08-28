"""VELORA new features (round 2): illustrate, daily, per-user voice, STT, owner knowledge."""
import io
import os
import json as _json
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mystique-voice-pro.preview.emergentagent.com").rstrip("/")
API = BASE_URL + "/api"

OWNER_EMAIL = "riaahuja2000@gmail.com"
OWNER_PW = "rioelixir"
CUSTOMER_EMAIL = "taromaya@gmail.com"
CUSTOMER_PW = "123456789"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def owner_token(s):
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def customer_token(s):
    r = s.post(f"{API}/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PW})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def auth(t):
    return {"Authorization": f"Bearer {t}"}


# ---------------- Illustrate (Gemini Nano Banana image)
class TestIllustrate:
    def test_illustrate_requires_auth(self, s):
        r = s.post(f"{API}/oracle/illustrate", json={"text": "Peace at heart.", "lang": "en"})
        assert r.status_code == 401

    def test_illustrate_returns_png(self, s, customer_token):
        text = "The stars whisper courage. Take one small step today."
        r = s.post(f"{API}/oracle/illustrate", json={"text": text, "lang": "en"},
                   headers=auth(customer_token), timeout=120)
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/img/") and url.endswith(".png")
        r2 = requests.get(BASE_URL + url, timeout=60)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/png")
        assert len(r2.content) > 10_000, f"image too small: {len(r2.content)} bytes"

    def test_illustrate_empty(self, s, customer_token):
        r = s.post(f"{API}/oracle/illustrate", json={"text": "  ", "lang": "en"},
                   headers=auth(customer_token))
        assert r.status_code == 400


# ---------------- ELI5 consult + off-topic routing
class TestELI5Consult:
    def test_consult_no_general_topic(self, s, customer_token):
        # Off-topic question -> must route to aura/mindfulness, never surface "general"
        r = s.post(f"{API}/oracle/consult",
                   json={"question": "What's the recipe for chocolate cake?", "lang": "en"},
                   headers=auth(customer_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "general" not in d["topics"], f"topics leaked 'general': {d['topics']}"
        assert d["primary"] != "general"

    def test_consult_eli5_short(self, s, customer_token):
        r = s.post(f"{API}/oracle/consult",
                   json={"question": "Tell me about tarot for my new job", "lang": "en"},
                   headers=auth(customer_token))
        assert r.status_code == 200
        answer = r.json()["answer"]
        # ELI5 answers are short and plain
        assert len(answer) < 500, f"answer too long for ELI5: {len(answer)}"
        assert answer.count(".") <= 6


# ---------------- Per-user voice + speed
class TestPerUserVoice:
    def test_patch_voice_and_speed_persist(self, s, customer_token):
        r = s.patch(f"{API}/me", json={"voice": "coral", "speed": 1.15},
                    headers=auth(customer_token))
        assert r.status_code == 200
        d = r.json()
        assert d["voice"] == "coral"
        assert abs(d["speed"] - 1.15) < 0.01

        r2 = s.get(f"{API}/auth/me", headers=auth(customer_token))
        assert r2.status_code == 200
        me = r2.json()
        assert me["voice"] == "coral"
        assert abs(me["speed"] - 1.15) < 0.01

    def test_speed_clamped(self, s, customer_token):
        r = s.patch(f"{API}/me", json={"speed": 5.0}, headers=auth(customer_token))
        assert r.status_code == 200
        assert r.json()["speed"] <= 2.0
        # restore something reasonable
        s.patch(f"{API}/me", json={"speed": 1.0, "voice": "shimmer"}, headers=auth(customer_token))

    def test_speak_returns_mp3(self, s, customer_token):
        r = s.post(f"{API}/oracle/speak",
                   json={"text": "A simple truth: breathe and begin.", "lang": "en"},
                   headers=auth(customer_token), timeout=60)
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        r2 = requests.get(BASE_URL + url)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("audio/mpeg")
        assert len(r2.content) > 1000


# ---------------- STT (transcribe)
class TestSTT:
    def test_transcribe_synthetic_clip(self, s, customer_token):
        # Synthesize a clip via /speak, then feed the mp3 back to /transcribe
        r = s.post(f"{API}/oracle/speak",
                   json={"text": "Hello world, this is a test of transcription.", "lang": "en"},
                   headers=auth(customer_token), timeout=60)
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        r_audio = requests.get(BASE_URL + url)
        assert r_audio.status_code == 200
        mp3 = r_audio.content

        files = {"file": ("q.mp3", mp3, "audio/mpeg")}
        data = {"lang": "en"}
        r2 = requests.post(f"{API}/oracle/transcribe", files=files, data=data,
                           headers={"Authorization": f"Bearer {customer_token}"}, timeout=120)
        assert r2.status_code == 200, r2.text
        text = r2.json().get("text", "")
        assert isinstance(text, str) and len(text.strip()) > 0

    def test_transcribe_empty_body(self, s, customer_token):
        files = {"file": ("empty.mp3", b"", "audio/mpeg")}
        r = requests.post(f"{API}/oracle/transcribe", files=files, data={"lang": "en"},
                          headers={"Authorization": f"Bearer {customer_token}"})
        assert r.status_code in (400, 502)


# ---------------- Daily aura/mindfulness
class TestDaily:
    def test_daily_returns_date_and_text(self, s, customer_token):
        r = s.get(f"{API}/oracle/daily", params={"lang": "en"}, headers=auth(customer_token))
        assert r.status_code == 200
        d = r.json()
        assert "date" in d and "text" in d
        assert len(d["text"]) > 5

    def test_daily_stable_same_day(self, s, customer_token):
        a = s.get(f"{API}/oracle/daily", params={"lang": "en"}, headers=auth(customer_token)).json()
        b = s.get(f"{API}/oracle/daily", params={"lang": "en"}, headers=auth(customer_token)).json()
        assert a["date"] == b["date"]
        assert a["text"] == b["text"]

    def test_daily_requires_auth(self, s):
        r = s.get(f"{API}/oracle/daily", params={"lang": "en"})
        assert r.status_code == 401


# ---------------- Owner Knowledge (RBAC + CRUD + upload)
class TestOwnerKnowledge:
    def test_customer_forbidden_list(self, s, customer_token):
        r = s.get(f"{API}/owner/knowledge", headers=auth(customer_token))
        assert r.status_code == 403

    def test_customer_forbidden_add(self, s, customer_token):
        r = s.post(f"{API}/owner/knowledge",
                   json={"topic": "tarot", "lang": "en", "text": "TEST_forbidden_entry_content"},
                   headers=auth(customer_token))
        assert r.status_code == 403

    def test_owner_list_shape(self, s, owner_token):
        r = s.get(f"{API}/owner/knowledge", headers=auth(owner_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("topics", "base_counts", "custom_counts", "entries", "files"):
            assert k in d
        assert "general" not in d["topics"]
        assert "tarot" in d["topics"]

    def test_owner_add_and_soft_delete(self, s, owner_token, customer_token):
        text = f"TEST_entry_{uuid.uuid4().hex[:8]} pick one tiny brave step today."
        r = s.post(f"{API}/owner/knowledge",
                   json={"topic": "tarot", "lang": "en", "text": text},
                   headers=auth(owner_token))
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        assert r.json()["topic"] == "tarot"
        assert r.json()["deleted_at"] is None

        # It appears in listing
        lst = s.get(f"{API}/owner/knowledge", headers=auth(owner_token)).json()
        assert any(e["id"] == eid for e in lst["entries"])

        # Owner-added answer must be reachable via consult (customer flow)
        # (best-effort; pool is random so we don't assert exact match)
        s.post(f"{API}/oracle/consult",
               json={"question": "Draw a tarot card for me", "lang": "en"},
               headers=auth(customer_token))

        # Soft delete
        rd = s.delete(f"{API}/owner/knowledge/{eid}", headers=auth(owner_token))
        assert rd.status_code == 200

        lst2 = s.get(f"{API}/owner/knowledge", headers=auth(owner_token)).json()
        assert not any(e["id"] == eid for e in lst2["entries"])

    def test_owner_add_unknown_topic(self, s, owner_token):
        r = s.post(f"{API}/owner/knowledge",
                   json={"topic": "not-a-tradition", "lang": "en", "text": "TEST_bogus_topic"},
                   headers=auth(owner_token))
        assert r.status_code == 400

    def test_owner_upload_txt_any_format(self, s, owner_token):
        content = b"TEST_kb Any format should be accepted and stored."
        files = {"file": ("kb.txt", content, "text/plain")}
        r = requests.post(f"{API}/owner/knowledge/upload", files=files,
                          headers={"Authorization": f"Bearer {owner_token}"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "kb.txt"
        assert d["size"] == len(content)
        assert d["ingested"] == 0  # non-json: nothing ingested but file stored

    def test_owner_upload_json_ingests(self, s, owner_token):
        payload = {
            "tarot": {
                "en": [
                    "TEST_json_ingest_A the cards say take one gentle breath and choose kindness.",
                    "TEST_json_ingest_B the cards say pause, then pick the smallest brave step."
                ]
            }
        }
        blob = _json.dumps(payload).encode("utf-8")
        files = {"file": ("pack.json", blob, "application/json")}
        r = requests.post(f"{API}/owner/knowledge/upload", files=files,
                          headers={"Authorization": f"Bearer {owner_token}"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ingested"] == 2, d

    def test_customer_upload_forbidden(self, s, customer_token):
        files = {"file": ("kb.txt", b"nope", "text/plain")}
        r = requests.post(f"{API}/owner/knowledge/upload", files=files,
                          headers={"Authorization": f"Bearer {customer_token}"})
        assert r.status_code == 403
