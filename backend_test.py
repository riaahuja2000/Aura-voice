#!/usr/bin/env python3
"""
Backend API tests for VELORA voice consult endpoint
Tests the new POST /api/voice/consult endpoint with Claude Sonnet 4.6
"""
import os
import re
import sys
import requests
from pathlib import Path

# Read base URL from frontend/.env
env_path = Path("/app/frontend/.env")
BASE_URL = None
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break

if not BASE_URL:
    print("❌ FATAL: Could not read EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env")
    sys.exit(1)

API_BASE = f"{BASE_URL}/api"

# Test credentials from /app/memory/test_credentials.md
CUSTOMER_EMAIL = "taromaya@gmail.com"
CUSTOMER_PASSWORD = "123456789"
OWNER_EMAIL = "riaahuja2000@gmail.com"
OWNER_PASSWORD = "rioelixir"

print(f"🔗 Testing against: {API_BASE}\n")

# Track test results
passed = 0
failed = 0
test_results = []


def test(name: str, fn):
    """Run a test and track results"""
    global passed, failed
    try:
        print(f"▶ {name}")
        fn()
        passed += 1
        test_results.append(("PASS", name, ""))
        print(f"  ✅ PASS\n")
    except AssertionError as e:
        failed += 1
        test_results.append(("FAIL", name, str(e)))
        print(f"  ❌ FAIL: {e}\n")
    except Exception as e:
        failed += 1
        test_results.append(("FAIL", name, f"Exception: {e}"))
        print(f"  ❌ FAIL (exception): {e}\n")


# ============================================================================
# TEST 1: Login with customer credentials
# ============================================================================
token = None


def test_login():
    global token
    resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD},
        timeout=30
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "token" in data, "Response missing 'token'"
    assert "user" in data, "Response missing 'user'"
    token = data["token"]
    assert token, "Token is empty"
    print(f"  🔑 Token obtained: {token[:20]}...")


test("TEST 1: POST /api/auth/login (customer)", test_login)

if not token:
    print("❌ FATAL: Could not obtain auth token. Stopping tests.")
    sys.exit(1)

headers = {"Authorization": f"Bearer {token}"}

# ============================================================================
# TEST 2: Voice consult with in-scope English question
# ============================================================================


def test_voice_consult_english():
    resp = requests.post(
        f"{API_BASE}/voice/consult",
        headers=headers,
        json={"question": "What does a green aura mean?", "lang": "en"},
        timeout=60
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    
    # Check required fields
    assert "id" in data, "Response missing 'id'"
    assert "user_id" in data, "Response missing 'user_id'"
    assert "question" in data, "Response missing 'question'"
    assert "answer" in data, "Response missing 'answer'"
    assert "lang" in data, "Response missing 'lang'"
    assert "created_at" in data, "Response missing 'created_at'"
    
    # Validate answer quality
    answer = data["answer"]
    assert isinstance(answer, str), f"Answer is not a string: {type(answer)}"
    assert len(answer) >= 60, f"Answer too short ({len(answer)} chars): {answer}"
    
    # Check for markdown characters (should be stripped)
    markdown_chars = ["*", "_", "#", "`"]
    for char in markdown_chars:
        assert char not in answer, f"Answer contains markdown char '{char}': {answer}"
    
    # Check for bullet points
    assert "•" not in answer, f"Answer contains bullet point: {answer}"
    assert "●" not in answer, f"Answer contains bullet point: {answer}"
    
    # Check it reads like natural prose (no list markers)
    assert not re.search(r"^\s*[-•●]\s", answer, re.MULTILINE), f"Answer contains list markers: {answer}"
    
    print(f"  📝 Answer ({len(answer)} chars): {answer[:100]}...")
    print(f"  ✓ No markdown chars, no bullets, natural prose")


test("TEST 2: POST /api/voice/consult (in-scope English)", test_voice_consult_english)

# ============================================================================
# TEST 3: Voice consult with OFF-TOPIC question
# ============================================================================


def test_voice_consult_offtopic():
    resp = requests.post(
        f"{API_BASE}/voice/consult",
        headers=headers,
        json={"question": "How do I fix my car engine?", "lang": "en"},
        timeout=60
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    answer = data["answer"].lower()
    
    # Should contain graceful redirect mentioning occult/mindfulness/aura
    redirect_keywords = ["occult", "mindfulness", "aura", "stars", "seeker"]
    has_redirect = any(kw in answer for kw in redirect_keywords)
    assert has_redirect, f"Off-topic answer should contain redirect keywords. Got: {data['answer']}"
    
    # Should NOT actually explain car repair
    car_keywords = ["engine", "mechanic", "repair", "oil", "spark plug"]
    has_car_advice = any(kw in answer for kw in car_keywords)
    assert not has_car_advice, f"Off-topic answer should NOT explain car repair. Got: {data['answer']}"
    
    print(f"  📝 Redirect answer: {data['answer'][:100]}...")
    print(f"  ✓ Contains redirect, no car repair advice")


test("TEST 3: POST /api/voice/consult (off-topic redirect)", test_voice_consult_offtopic)

# ============================================================================
# TEST 4: Voice consult with Hindi (Devanagari)
# ============================================================================


def test_voice_consult_hindi():
    resp = requests.post(
        f"{API_BASE}/voice/consult",
        headers=headers,
        json={"question": "चंद्र ग्रहण के दौरान ध्यान कैसे करें?", "lang": "hi"},
        timeout=60
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    answer = data["answer"]
    
    # Check for Devanagari characters (Unicode range \u0900-\u097F)
    has_devanagari = any("\u0900" <= char <= "\u097F" for char in answer)
    assert has_devanagari, f"Hindi answer should contain Devanagari characters. Got: {answer}"
    
    print(f"  📝 Hindi answer: {answer[:100]}...")
    print(f"  ✓ Contains Devanagari script")


test("TEST 4: POST /api/voice/consult (Hindi Devanagari)", test_voice_consult_hindi)

# ============================================================================
# TEST 5: Voice consult with Hinglish
# ============================================================================


def test_voice_consult_hinglish():
    resp = requests.post(
        f"{API_BASE}/voice/consult",
        headers=headers,
        json={"question": "Meri aura clean kaise karun?", "lang": "hng"},
        timeout=60
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    answer = data["answer"]
    
    assert isinstance(answer, str), f"Answer is not a string: {type(answer)}"
    assert len(answer) > 0, "Hinglish answer is empty"
    assert len(answer) >= 30, f"Hinglish answer too short ({len(answer)} chars): {answer}"
    
    print(f"  📝 Hinglish answer: {answer[:100]}...")
    print(f"  ✓ Non-empty prose")


test("TEST 5: POST /api/voice/consult (Hinglish)", test_voice_consult_hinglish)

# ============================================================================
# TEST 6: Voice consult WITHOUT Authorization header (should fail 401)
# ============================================================================


def test_voice_consult_no_auth():
    resp = requests.post(
        f"{API_BASE}/voice/consult",
        json={"question": "What is my aura color?", "lang": "en"},
        timeout=30
    )
    assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}: {resp.text}"
    print(f"  ✓ Correctly rejected with 401")


test("TEST 6: POST /api/voice/consult (no auth → 401)", test_voice_consult_no_auth)

# ============================================================================
# TEST 7: Voice consult with empty question (should fail 400 or 422)
# ============================================================================


def test_voice_consult_empty_question():
    resp = requests.post(
        f"{API_BASE}/voice/consult",
        headers=headers,
        json={"question": "", "lang": "en"},
        timeout=30
    )
    assert resp.status_code in [400, 422], f"Expected 400 or 422 for empty question, got {resp.status_code}: {resp.text}"
    print(f"  ✓ Correctly rejected with {resp.status_code}")


test("TEST 7: POST /api/voice/consult (empty question → 400/422)", test_voice_consult_empty_question)

# ============================================================================
# TEST 8: Sanity checks for existing endpoints
# ============================================================================


def test_root_endpoint():
    resp = requests.get(f"{API_BASE}/", timeout=30)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "message" in data, "Root response missing 'message'"
    assert "VELORA" in data["message"] or "oracle" in data["message"].lower(), f"Unexpected message: {data['message']}"
    print(f"  📝 Message: {data['message']}")


test("TEST 8a: GET /api/ (root sanity check)", test_root_endpoint)


def test_auth_me():
    resp = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=30)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "id" in data, "Response missing 'id'"
    assert "email" in data, "Response missing 'email'"
    assert data["email"] == CUSTOMER_EMAIL, f"Email mismatch: {data['email']}"
    print(f"  📝 User: {data.get('name', 'N/A')} ({data['email']})")


test("TEST 8b: GET /api/auth/me (with token)", test_auth_me)


def test_settings_endpoint():
    resp = requests.get(f"{API_BASE}/settings", timeout=30)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert isinstance(data, dict), f"Settings should be a dict, got {type(data)}"
    # Should have some settings fields
    assert len(data) > 0, "Settings object is empty"
    print(f"  📝 Settings keys: {list(data.keys())[:5]}...")


test("TEST 8c: GET /api/settings (no auth)", test_settings_endpoint)

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 80)
print("TEST SUMMARY")
print("=" * 80)
for status, name, reason in test_results:
    symbol = "✅" if status == "PASS" else "❌"
    print(f"{symbol} {status}: {name}")
    if reason:
        print(f"   Reason: {reason}")

print(f"\n📊 Total: {passed + failed} tests | ✅ Passed: {passed} | ❌ Failed: {failed}")

if failed > 0:
    print("\n❌ Some tests failed. See details above.")
    sys.exit(1)
else:
    print("\n✅ All tests passed!")
    sys.exit(0)
