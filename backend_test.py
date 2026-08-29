#!/usr/bin/env python3
"""
AURA-VOICE Backend Regression Test Suite
Tests all backend endpoints after Vercel deployment refactoring
"""
import os
import re
import sys
import uuid
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
    BASE_URL = "http://localhost:8001"
    print(f"⚠️  Could not read EXPO_PUBLIC_BACKEND_URL, falling back to {BASE_URL}")

API_BASE = f"{BASE_URL}/api"

# Test credentials from /app/memory/test_credentials.md
CUSTOMER_EMAIL = "taromaya@gmail.com"
CUSTOMER_PASSWORD = "123456789"
OWNER_EMAIL = "riaahuja2000@gmail.com"
OWNER_PASSWORD = "rioelixir"

print(f"🔗 Testing against: {API_BASE}\n")
print("=" * 80)
print("VERCEL DEPLOYMENT PREP — REGRESSION TEST")
print("=" * 80)

# Track test results
passed = 0
failed = 0
test_results = []


def test(name: str, fn):
    """Run a test and track results"""
    global passed, failed
    try:
        print(f"\n▶ {name}")
        fn()
        passed += 1
        test_results.append(("PASS", name, ""))
        print(f"  ✅ PASS")
    except AssertionError as e:
        failed += 1
        test_results.append(("FAIL", name, str(e)))
        print(f"  ❌ FAIL: {e}")
    except Exception as e:
        failed += 1
        test_results.append(("FAIL", name, f"Exception: {e}"))
        print(f"  ❌ FAIL (exception): {e}")


# ============================================================================
# BLOCK 1: SANITY CHECKS
# ============================================================================
print("\n" + "=" * 80)
print("BLOCK 1: SANITY CHECKS")
print("=" * 80)


def test_root():
    resp = requests.get(f"{API_BASE}/", timeout=30)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "message" in data, "Root response missing 'message'"
    assert "AURA-VOICE" in data["message"] or "oracle" in data["message"].lower(), f"Unexpected message: {data['message']}"
    print(f"  📝 Message: {data['message']}")


test("1.1: GET /api/ → 200 with oracle message", test_root)


def test_settings():
    resp = requests.get(f"{API_BASE}/settings", timeout=30)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert isinstance(data, dict), f"Settings should be a dict, got {type(data)}"
    assert len(data) > 0, "Settings object is empty"
    print(f"  📝 Settings keys: {list(data.keys())}")


test("1.2: GET /api/settings (no auth) → 200", test_settings)

# ============================================================================
# BLOCK 2: AUTH
# ============================================================================
print("\n" + "=" * 80)
print("BLOCK 2: AUTH")
print("=" * 80)

# Generate a fresh random email for registration
random_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
random_password = "testpass123"
random_name = "Test User"


def test_register():
    resp = requests.post(
        f"{API_BASE}/auth/register",
        json={"email": random_email, "password": random_password, "name": random_name},
        timeout=30
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "token" in data, "Response missing 'token'"
    assert "user" in data, "Response missing 'user'"
    assert data["user"]["email"] == random_email, f"Email mismatch: {data['user']['email']}"
    print(f"  📝 Registered: {random_email}")
    print(f"  🔑 Token: {data['token'][:20]}...")


test("2.1: POST /api/auth/register (fresh email) → 200 with token", test_register)

# Login with customer credentials
customer_token = None


def test_login_customer():
    global customer_token
    resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD},
        timeout=30
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "token" in data, "Response missing 'token'"
    assert "user" in data, "Response missing 'user'"
    customer_token = data["token"]
    assert customer_token, "Token is empty"
    print(f"  📝 Logged in: {CUSTOMER_EMAIL}")
    print(f"  🔑 Token: {customer_token[:20]}...")


test("2.2: POST /api/auth/login (customer creds) → 200 with token", test_login_customer)

if not customer_token:
    print("\n❌ FATAL: Could not obtain customer token. Stopping tests.")
    sys.exit(1)

customer_headers = {"Authorization": f"Bearer {customer_token}"}


def test_login_wrong_password():
    resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": CUSTOMER_EMAIL, "password": "wrongpassword"},
        timeout=30
    )
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
    print(f"  ✓ Correctly rejected with 401")


test("2.3: POST /api/auth/login (wrong password) → 401", test_login_wrong_password)


def test_auth_me_with_token():
    resp = requests.get(f"{API_BASE}/auth/me", headers=customer_headers, timeout=30)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "id" in data, "Response missing 'id'"
    assert "email" in data, "Response missing 'email'"
    assert data["email"] == CUSTOMER_EMAIL, f"Email mismatch: {data['email']}"
    print(f"  📝 User: {data.get('name', 'N/A')} ({data['email']})")


test("2.4: GET /api/auth/me (with valid token) → 200", test_auth_me_with_token)


def test_auth_me_no_token():
    resp = requests.get(f"{API_BASE}/auth/me", timeout=30)
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
    print(f"  ✓ Correctly rejected with 401")


test("2.5: GET /api/auth/me (no token) → 401", test_auth_me_no_token)

# ============================================================================
# BLOCK 3: VOICE ENDPOINT (KEY FEATURE)
# ============================================================================
print("\n" + "=" * 80)
print("BLOCK 3: VOICE ENDPOINT (KEY FEATURE)")
print("=" * 80)


def test_voice_in_scope():
    resp = requests.post(
        f"{API_BASE}/voice/consult",
        headers=customer_headers,
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
    markdown_chars = ["*", "_", "#", "`", ">"]
    for char in markdown_chars:
        assert char not in answer, f"Answer contains markdown char '{char}': {answer}"
    
    # Check for bullet points
    assert "•" not in answer, f"Answer contains bullet point: {answer}"
    assert "●" not in answer, f"Answer contains bullet point: {answer}"
    
    print(f"  📝 Answer ({len(answer)} chars): {answer[:150]}...")
    print(f"  ✓ No markdown chars, no bullets, natural prose")


test("3.1: POST /api/voice/consult (in-scope EN) → 200, ≥60 chars, NO markdown/bullets", test_voice_in_scope)


def test_voice_off_topic():
    resp = requests.post(
        f"{API_BASE}/voice/consult",
        headers=customer_headers,
        json={"question": "How do I fix my car engine?", "lang": "en"},
        timeout=60
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    answer = data["answer"].lower()
    
    # Should contain graceful redirect mentioning occult/mindfulness/aura/sacred sciences/soulful life
    redirect_keywords = ["occult", "mindfulness", "aura", "sacred sciences", "soulful life", "stars", "seeker"]
    has_redirect = any(kw in answer for kw in redirect_keywords)
    assert has_redirect, f"Off-topic answer should contain redirect keywords. Got: {data['answer']}"
    
    print(f"  📝 Redirect answer: {data['answer'][:150]}...")
    print(f"  ✓ Contains redirect phrase (occult/mindfulness/aura/sacred sciences/soulful life)")


test("3.2: POST /api/voice/consult (off-topic) → 200, graceful redirect", test_voice_off_topic)


def test_voice_hindi():
    resp = requests.post(
        f"{API_BASE}/voice/consult",
        headers=customer_headers,
        json={"question": "चंद्र ग्रहण के दौरान ध्यान कैसे करें?", "lang": "hi"},
        timeout=60
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    answer = data["answer"]
    
    # Check for Devanagari characters (Unicode range \u0900-\u097F)
    has_devanagari = any("\u0900" <= char <= "\u097F" for char in answer)
    assert has_devanagari, f"Hindi answer should contain Devanagari characters. Got: {answer}"
    
    print(f"  📝 Hindi answer: {answer[:150]}...")
    print(f"  ✓ Contains Devanagari script (\u0900-\u097F)")


test("3.3: POST /api/voice/consult (Hindi) → 200, Devanagari chars", test_voice_hindi)


def test_voice_no_auth():
    resp = requests.post(
        f"{API_BASE}/voice/consult",
        json={"question": "What is my aura color?", "lang": "en"},
        timeout=30
    )
    assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}: {resp.text}"
    print(f"  ✓ Correctly rejected with 401")


test("3.4: POST /api/voice/consult (NO auth) → 401", test_voice_no_auth)


def test_voice_empty_question():
    resp = requests.post(
        f"{API_BASE}/voice/consult",
        headers=customer_headers,
        json={"question": "", "lang": "en"},
        timeout=30
    )
    assert resp.status_code in [400, 422], f"Expected 400 or 422 for empty question, got {resp.status_code}: {resp.text}"
    print(f"  ✓ Correctly rejected with {resp.status_code}")


test("3.5: POST /api/voice/consult (empty question) → 400/422", test_voice_empty_question)

# ============================================================================
# BLOCK 4: ORACLE (LEGACY)
# ============================================================================
print("\n" + "=" * 80)
print("BLOCK 4: ORACLE (LEGACY)")
print("=" * 80)


def test_oracle_consult():
    resp = requests.post(
        f"{API_BASE}/oracle/consult",
        headers=customer_headers,
        json={"question": "When will I get married?", "lang": "en"},
        timeout=60
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "answer" in data, "Response missing 'answer'"
    assert "topics" in data, "Response missing 'topics'"
    assert isinstance(data["topics"], list), f"Topics should be a list, got {type(data['topics'])}"
    print(f"  📝 Answer: {data['answer'][:100]}...")
    print(f"  📝 Topics: {data['topics']}")


test("4.1: POST /api/oracle/consult → 200 with answer + topics", test_oracle_consult)


def test_oracle_daily():
    resp = requests.get(f"{API_BASE}/oracle/daily?lang=en", headers=customer_headers, timeout=30)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "date" in data, "Response missing 'date'"
    assert "text" in data, "Response missing 'text'"
    assert isinstance(data["text"], str), f"Text should be a string, got {type(data['text'])}"
    assert len(data["text"]) > 0, "Daily reading text is empty"
    print(f"  📝 Date: {data['date']}")
    print(f"  📝 Text: {data['text'][:100]}...")


test("4.2: GET /api/oracle/daily?lang=en → 200 with date + text", test_oracle_daily)


def test_readings():
    resp = requests.get(f"{API_BASE}/readings", headers=customer_headers, timeout=30)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert isinstance(data, list), f"Readings should be a list, got {type(data)}"
    print(f"  📝 Readings count: {len(data)}")


test("4.3: GET /api/readings → 200, array", test_readings)

# ============================================================================
# BLOCK 5: NUMEROLOGY + TAROT ENGINES
# ============================================================================
print("\n" + "=" * 80)
print("BLOCK 5: NUMEROLOGY + TAROT ENGINES")
print("=" * 80)


def test_numerology():
    resp = requests.post(
        f"{API_BASE}/numerology/reading",
        headers=customer_headers,
        json={"full_name": "Ria Ahuja", "dob": "2000-05-15"},
        timeout=30
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    # Check for numerology response structure
    assert "name" in data, "Response missing 'name'"
    assert "dob" in data, "Response missing 'dob'"
    assert "numbers" in data, "Response missing 'numbers'"
    assert "chart" in data, "Response missing 'chart'"
    # Verify numbers dict has expected fields
    numbers = data["numbers"]
    expected_number_fields = ["life_path", "expression", "soul_urge", "personality"]
    for field in expected_number_fields:
        assert field in numbers, f"Numbers missing '{field}'"
    print(f"  📝 Numerology structure: name, dob, numbers, chart")
    print(f"  📝 Numbers: {list(numbers.keys())}")


test("5.1: POST /api/numerology/reading → 200 with numerology fields", test_numerology)


def test_tarot_deck():
    resp = requests.get(f"{API_BASE}/tarot/deck", headers=customer_headers, timeout=30)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "count" in data, "Response missing 'count'"
    assert "cards" in data, "Response missing 'cards'"
    assert data["count"] > 0, f"Deck count should be > 0, got {data['count']}"
    assert isinstance(data["cards"], list), f"Cards should be a list, got {type(data['cards'])}"
    print(f"  📝 Deck count: {data['count']}")
    print(f"  📝 Cards: {len(data['cards'])} cards")


test("5.2: GET /api/tarot/deck → 200 with count and cards", test_tarot_deck)


def test_tarot_draw():
    resp = requests.post(
        f"{API_BASE}/tarot/draw",
        headers=customer_headers,
        json={"spread": "three"},
        timeout=30
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    # Should return some tarot draw result
    assert isinstance(data, dict), f"Draw result should be a dict, got {type(data)}"
    assert len(data) > 0, "Draw result is empty"
    print(f"  📝 Draw result keys: {list(data.keys())}")


test("5.3: POST /api/tarot/draw (spread=three) → 200", test_tarot_draw)

# ============================================================================
# BLOCK 6: OWNER ENDPOINTS
# ============================================================================
print("\n" + "=" * 80)
print("BLOCK 6: OWNER ENDPOINTS")
print("=" * 80)

# Login as owner
owner_token = None


def test_login_owner():
    global owner_token
    resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD},
        timeout=30
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "token" in data, "Response missing 'token'"
    owner_token = data["token"]
    assert owner_token, "Owner token is empty"
    print(f"  📝 Logged in as owner: {OWNER_EMAIL}")
    print(f"  🔑 Token: {owner_token[:20]}...")


test("6.1: POST /api/auth/login (owner) → 200 with token", test_login_owner)

if not owner_token:
    print("\n⚠️  Could not obtain owner token. Skipping owner endpoint tests.")
else:
    owner_headers = {"Authorization": f"Bearer {owner_token}"}


    def test_owner_overview():
        resp = requests.get(f"{API_BASE}/owner/overview", headers=owner_headers, timeout=30)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # Check for expected fields
        expected_fields = ["total_sessions", "registered_users", "members"]
        for field in expected_fields:
            assert field in data, f"Response missing '{field}'"
        print(f"  📝 Total sessions: {data['total_sessions']}")
        print(f"  📝 Registered users: {data['registered_users']}")
        print(f"  📝 Members: {len(data['members'])}")


    test("6.2: GET /api/owner/overview → 200 with stats", test_owner_overview)


    def test_owner_knowledge():
        resp = requests.get(f"{API_BASE}/owner/knowledge", headers=owner_headers, timeout=30)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # Check for expected fields
        expected_fields = ["topics", "base_counts", "custom_counts"]
        for field in expected_fields:
            assert field in data, f"Response missing '{field}'"
        print(f"  📝 Topics: {len(data['topics'])}")
        print(f"  📝 Base counts: {len(data['base_counts'])}")
        print(f"  📝 Custom counts: {len(data['custom_counts'])}")


    test("6.3: GET /api/owner/knowledge → 200 with topics/base_counts/custom_counts", test_owner_knowledge)

# ============================================================================
# BLOCK 7: VERCEL SERVERLESS ENTRY (IMPORT TEST)
# ============================================================================
print("\n" + "=" * 80)
print("BLOCK 7: VERCEL SERVERLESS ENTRY (IMPORT TEST)")
print("=" * 80)


def test_vercel_import():
    import subprocess
    result = subprocess.run(
        ["python3", "-c", "import sys; sys.path.insert(0,'backend'); from api.index import app; print(len(app.routes))"],
        cwd="/app",
        capture_output=True,
        text=True,
        timeout=30
    )
    assert result.returncode == 0, f"Import failed with exit code {result.returncode}. stderr: {result.stderr}"
    output = result.stdout.strip()
    assert output.isdigit(), f"Expected a number, got: {output}"
    route_count = int(output)
    assert route_count > 20, f"Expected > 20 routes, got {route_count}"
    print(f"  📝 Vercel serverless entry loaded successfully")
    print(f"  📝 Route count: {route_count}")


test("7.1: Import /api/index.py → loads app with > 20 routes", test_vercel_import)

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)

# Group by block
blocks = {
    "1": "SANITY",
    "2": "AUTH",
    "3": "VOICE ENDPOINT",
    "4": "ORACLE (LEGACY)",
    "5": "NUMEROLOGY + TAROT",
    "6": "OWNER ENDPOINTS",
    "7": "VERCEL SERVERLESS",
}

for block_num, block_name in blocks.items():
    block_tests = [t for t in test_results if t[1].startswith(f"{block_num}.")]
    if block_tests:
        print(f"\n{block_name}:")
        for status, name, reason in block_tests:
            symbol = "✅" if status == "PASS" else "❌"
            print(f"  {symbol} {name}")
            if reason:
                print(f"     Reason: {reason}")

print(f"\n📊 Total: {passed + failed} tests | ✅ Passed: {passed} | ❌ Failed: {failed}")

if failed > 0:
    print("\n❌ Some tests failed. See details above.")
    sys.exit(1)
else:
    print("\n✅ All regression tests passed! No regressions detected.")
    sys.exit(0)
