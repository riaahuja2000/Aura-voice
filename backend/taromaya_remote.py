"""Live backend-only semantic synchronizer for the two TAROMAYA apps.

The synchronizer downloads only public deployed assets, extracts domain knowledge
strings and calculation/rule context, and deliberately discards UI/layout/theme
material.  Nothing is written back to either TAROMAYA project.
"""
from __future__ import annotations

import html as _html
import re
import threading
import time
from urllib.parse import urljoin

import requests

SOURCES = {
    "taromaya_numerology": "https://taromaya-numerology.lovable.app/",
    "taromaya_tarot": "https://taromaya-tarot.lovable.app/",
}

# Terms that identify semantic/calculation knowledge. Keep this deliberately
# broad so all occult back-end traditions in the source apps can be retrieved.
DOMAIN_TERMS = {
    "numerology", "lo shu", "loshu", "vedic", "mulank", "bhagyank", "driver", "conductor",
    "destiny number", "birth number", "name number", "chaldean", "kabbalah", "mobile number",
    "dasha", "mahadasha", "antardasha", "pratyantar", "vimshottari", "planet", "graha",
    "tarot", "arcana", "rider waite", "spread", "booklet", "card meaning", "upright", "reversed",
    "astrology", "kundali", "kundli", "lagna", "nakshatra", "panchang", "tithi", "yoga", "karana",
    "horoscope", "zodiac", "transit", "jaimini", "kp", "parashara", "nadi", "shadbala",
    "ashtakavarga", "sarvatobhadra", "sudarshana", "tajika", "varshaphal", "lalkitab",
    "remedy", "remedies", "mantra", "rudraksha", "gemstone", "crystal", "healing",
    "vastu", "feng shui", "direction", "brahma sthana", "rune", "runes", "pendulum",
    "dream", "dreams", "symbol", "planetary hour", "choghadiya", "rahu kaal",
    "chinese astrology", "moon phase", "lunar", "signature", "prediction", "timing",
}

# Strings dominated by interface / implementation vocabulary are not retained.
UI_TERMS = {
    "className", "onClick", "button", "dialog", "drawer", "sidebar", "tooltip", "placeholder",
    "aria-", "rounded-", "flex ", "grid ", "px-", "py-", "text-", "bg-", "hover:", "focus:",
    "dashboard", "login", "logout", "sign in", "sign up", "password", "subscription", "checkout",
    "razorpay", "billing", "admin panel", "owner panel", "navigation", "route", "component",
    "react", "useState", "useEffect", "jsx", "tsx", "stylesheet", "tailwind", "supabase.auth",
}

_SCRIPT_RE = re.compile(r"<(?:script|link)\b[^>]+(?:src|href)=[\"']([^\"']+)[\"'][^>]*>", re.I)
# Handles normal JS string literals and template literals. The minimum length
# removes tiny implementation tokens while retaining concise rule rows.
_STRING_RE = re.compile(r'(?:"((?:\\.|[^"\\]){18,})"|\'((?:\\.|[^\'\\]){18,})\'|`((?:\\.|[^`\\]){18,})`)', re.S)
_WORD_RE = re.compile(r"[a-zA-Z0-9\u0900-\u097F]+")

_LOCK = threading.Lock()
_CACHE = {"fetched_at": 0.0, "records": [], "errors": {}, "assets": {}}
TTL_SECONDS = 6 * 60 * 60


def _clean(value: str) -> str:
    value = _html.unescape(value or "")
    value = value.replace("\\n", " ").replace("\\t", " ").replace("\\\"", '"').replace("\\'", "'")
    value = re.sub(r"\\u[0-9a-fA-F]{4}", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _is_semantic(value: str) -> bool:
    low = value.lower()
    if len(value) < 18 or len(value) > 5000:
        return False
    if any(term.lower() in low for term in UI_TERMS):
        return False
    domain_hits = sum(1 for term in DOMAIN_TERMS if term in low)
    # A direct domain term is enough for prose. For compact tables, accept a
    # rich occult vocabulary even when the exact module title is omitted.
    if domain_hits:
        return True
    words = set(_WORD_RE.findall(low))
    occult = {
        "sun","moon","mars","mercury","jupiter","venus","saturn","rahu","ketu",
        "north","south","east","west","career","marriage","money","property","health",
        "relationship","wealth","spiritual","birth","destiny","lucky","unlucky","element",
        "major","minor","cups","wands","swords","pentacles","nakshatra","planet",
    }
    return len(words & occult) >= 3


def _extract_asset_records(source: str, asset_url: str, text: str) -> list[dict]:
    out = []
    seen = set()
    for match in _STRING_RE.finditer(text):
        raw = next((g for g in match.groups() if g), "")
        value = _clean(raw)
        if not _is_semantic(value):
            continue
        key = value[:350].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"source_app": source, "asset": asset_url, "text": value})
    return out


def refresh(force: bool = False, timeout: float = 7.0) -> dict:
    now = time.time()
    if not force and _CACHE["records"] and now - _CACHE["fetched_at"] < TTL_SECONDS:
        return status()

    with _LOCK:
        now = time.time()
        if not force and _CACHE["records"] and now - _CACHE["fetched_at"] < TTL_SECONDS:
            return status()

        records = []
        errors = {}
        assets_count = {}
        headers = {"User-Agent": "AURA-VOICE-Taromaya-Knowledge-Sync/1.0"}

        for source, base in SOURCES.items():
            try:
                page = requests.get(base, headers=headers, timeout=timeout)
                page.raise_for_status()
                urls = []
                for ref in _SCRIPT_RE.findall(page.text):
                    absolute = urljoin(base, ref)
                    if absolute.startswith(base) and any(x in absolute for x in (".js", ".mjs", ".json")):
                        urls.append(absolute)
                # Modern Vite/React apps usually have one main module plus a few
                # lazy chunks. Deduping keeps serverless work bounded.
                urls = list(dict.fromkeys(urls))[:80]
                count = 0
                for url in urls:
                    try:
                        res = requests.get(url, headers=headers, timeout=timeout)
                        res.raise_for_status()
                        if len(res.content) > 12 * 1024 * 1024:
                            continue
                        extracted = _extract_asset_records(source, url, res.text)
                        records.extend(extracted)
                        count += 1
                    except Exception:
                        continue
                assets_count[source] = count
                if count == 0:
                    errors[source] = "No readable deployed JS/JSON assets found"
            except Exception as exc:
                errors[source] = f"{type(exc).__name__}: {str(exc)[:160]}"

        # Cross-asset dedupe while preserving source provenance.
        deduped = []
        seen = set()
        for rec in records:
            key = rec["text"].lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(rec)

        if deduped:
            _CACHE["records"] = deduped
            _CACHE["fetched_at"] = time.time()
        _CACHE["errors"] = errors
        _CACHE["assets"] = assets_count
        return status()


def _words(value: str) -> set[str]:
    return {w for w in _WORD_RE.findall((value or "").lower()) if len(w) > 1}


def search(question: str, limit: int = 6) -> list[dict]:
    # Live sync is additive. If a source is temporarily unavailable, the last
    # good cache remains and Aura Voice still has its bundled exact snapshots.
    try:
        refresh(force=False)
    except Exception:
        pass

    q = _words(question)
    if not q:
        return []
    qlow = question.strip().lower()
    ranked = []
    for rec in _CACHE["records"]:
        text = rec["text"]
        twords = _words(text)
        overlap = q & twords
        if not overlap:
            continue
        score = len(overlap) * 11
        if qlow and qlow in text.lower():
            score += 45
        # Questions containing a known domain name should strongly prefer rows
        # from that same domain.
        for term in DOMAIN_TERMS:
            if term in qlow and term in text.lower():
                score += 16
        ranked.append((score, rec))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [{**rec, "score": score} for score, rec in ranked[: max(1, min(limit, 12))]]


def status() -> dict:
    return {
        "enabled": True,
        "backend_only": True,
        "source_apps": list(SOURCES.values()),
        "semantic_records": len(_CACHE["records"]),
        "last_refresh_epoch": _CACHE["fetched_at"] or None,
        "assets_read": dict(_CACHE["assets"]),
        "errors": dict(_CACHE["errors"]),
        "ttl_seconds": TTL_SECONDS,
        "ui_data_retained": False,
    }
