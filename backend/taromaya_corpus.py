"""Backend-only Taromaya corpus retrieval for Aura Voice.

This module indexes semantic knowledge/calculation snapshots copied from the
user-authorized Taromaya Lovable projects. It intentionally does not load
UI/interface files, media, auth/user records, payments, subscriptions, chats,
readings, analytics, audit logs, or secrets.

The corpus is static at deployment time and dynamically retrieved per question.
No network dependency on the source apps is required at runtime.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent
CORPUS_DIR = ROOT / "knowledge" / "taromaya_sources"
SNAPSHOT = ROOT / "knowledge" / "taromaya_db_snapshot.json"

_WORD_RE = re.compile(r"[a-zA-Z0-9\u0900-\u097F]+")
_STOP = {
    "the", "a", "an", "is", "are", "was", "were", "to", "of", "and", "or", "in", "on", "for",
    "with", "my", "me", "i", "what", "how", "can", "will", "would", "please", "tell", "about",
    "mera", "meri", "mere", "mujhe", "main", "mein", "ka", "ki", "ke", "ko", "hai", "hoga",
    "hogi", "honge", "kya", "kaisa", "kaisi", "kaise", "batao", "bataiye", "aur", "se", "par",
}

FAMILIES: dict[str, set[str]] = {
    "tarot": {"tarot", "card", "cards", "arcana", "spread", "rider", "waite", "booklet"},
    "numerology": {"numerology", "number", "numbers", "moolank", "mulank", "bhagyank", "destiny",
                    "driver", "conductor", "loshu", "lo", "shu", "chaldean", "name", "mobile"},
    "kabbalah": {"kabbalah", "kabbalistic", "gematria", "tree", "life", "path"},
    "astrology": {"astrology", "kundali", "kundli", "horoscope", "zodiac", "planet", "graha",
                  "lagna", "nakshatra", "dasha", "transit", "panchang", "muhurat", "tithi"},
    "vastu": {"vastu", "direction", "north", "south", "east", "west", "zone", "entrance", "factory",
              "office", "plot", "brahmasthan", "brahma", "toilet"},
    "runes": {"rune", "runes", "futhark", "fehu", "uruz", "ansuz", "odin", "wyrd"},
    "dreams": {"dream", "dreams", "sapna", "sapne", "nightmare", "symbol", "deceased"},
    "remedies": {"remedy", "remedies", "upay", "upaay", "daan", "mantra", "shabar", "lal", "kitab"},
    "crystals": {"crystal", "crystals", "gemstone", "stone", "stones", "rudraksha", "gem"},
    "relationship": {"love", "relationship", "marriage", "shaadi", "partner", "husband", "wife",
                     "spouse", "commitment", "divorce", "separation", "reconciliation", "ex"},
    "career": {"career", "job", "naukri", "work", "business", "promotion", "interview", "profession"},
    "money": {"money", "paisa", "paise", "finance", "financial", "wealth", "income", "salary", "profit",
              "share", "market", "trading", "investment", "property"},
    "health": {"health", "sehat", "wellbeing", "well-being", "healing", "stress", "sleep", "body"},
    "timing": {"when", "kab", "timing", "time", "date", "month", "year", "period", "soon", "delay"},
}


def _words(value: str) -> set[str]:
    return {w for w in _WORD_RE.findall((value or "").lower()) if len(w) > 1 and w not in _STOP}


def _family_hits(words: set[str]) -> set[str]:
    return {name for name, terms in FAMILIES.items() if words & terms}


def _chunk_text(text: str, source: str, module: str, path: str, chunk_size: int = 1800) -> list[dict]:
    pieces = re.split(r"\n\s*\n|(?=\n(?:export const|const |/\*\*|# |## ))", text)
    out: list[dict] = []
    buf = ""
    for piece in pieces:
        piece = piece.strip()
        if not piece:
            continue
        subs = [piece[i:i + chunk_size] for i in range(0, len(piece), chunk_size)] if len(piece) > chunk_size else [piece]
        for sub in subs:
            if len(buf) + len(sub) + 2 <= chunk_size:
                buf = f"{buf}\n\n{sub}".strip()
            else:
                if buf:
                    out.append({"source": source, "module": module, "path": path, "text": buf})
                buf = sub
    if buf:
        out.append({"source": source, "module": module, "path": path, "text": buf})
    return out


def _source_meta(path: Path) -> tuple[str, str]:
    name = path.name.lower()
    if name.startswith("numerology__"):
        return "taromaya-numerology", name.split("__", 1)[1].rsplit(".", 2)[0].replace("_", " ")
    if name.startswith("tarot__"):
        return "taromaya-tarot", name.split("__", 1)[1].rsplit(".", 2)[0].replace("_", " ")
    return "taromaya", path.stem.replace("_", " ")


@lru_cache(maxsize=1)
def entries() -> tuple[dict, ...]:
    rows: list[dict] = []
    if CORPUS_DIR.exists():
        for path in sorted(CORPUS_DIR.iterdir()):
            if not path.is_file() or path.suffix.lower() not in {".txt", ".md", ".json"}:
                continue
            source, module = _source_meta(path)
            raw = path.read_text("utf-8", errors="ignore")
            if path.suffix.lower() == ".json":
                try:
                    raw = json.dumps(json.loads(raw), ensure_ascii=False, indent=2)
                except Exception:
                    pass
            rows.extend(_chunk_text(raw, source, module, str(path.relative_to(ROOT))))
    if SNAPSHOT.exists():
        try:
            obj = json.loads(SNAPSHOT.read_text("utf-8"))
            for source_name, payload in obj.get("sources", {}).items():
                for section, value in payload.items():
                    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
                    rows.extend(_chunk_text(text, source_name, section, str(SNAPSHOT.relative_to(ROOT))))
        except Exception:
            pass
    for row in rows:
        hay = f"{row['module']} {row['path']} {row['text']}"
        row["_words"] = _words(hay)
        row["_families"] = _family_hits(row["_words"])
    return tuple(rows)


def stats() -> dict:
    es = entries()
    by_source: dict[str, int] = {}
    for e in es:
        by_source[e["source"]] = by_source.get(e["source"], 0) + 1
    return {"chunks": len(es), "sources": by_source}


def retrieve(question: str, *, topics: Iterable[str] | None = None, engine_hint: str | None = None,
             limit: int = 8, max_chars: int = 6500) -> list[dict]:
    q = (question or "").strip()
    if not q:
        return []
    qw = _words(q)
    topic_words = _words(" ".join(str(x) for x in (topics or [])))
    hint_words = _words(engine_hint or "")
    search = qw | topic_words | hint_words
    qfamilies = _family_hits(search)
    ranked: list[tuple[int, dict]] = []
    qlow = q.lower()
    for e in entries():
        ew: set[str] = e["_words"]
        exact = qw & ew
        expanded = search & ew
        if not expanded:
            continue
        score = len(exact) * 14 + len(expanded) * 4
        ef = e["_families"]
        score += len(qfamilies & ef) * 11
        module_low = e["module"].lower()
        for family in qfamilies:
            if family in module_low:
                score += 18
        if engine_hint and engine_hint.lower() in module_low:
            score += 24
        if qlow and qlow in e["text"].lower():
            score += 60
        if qfamilies and not (qfamilies & ef):
            score -= 20
        if score >= 12:
            ranked.append((score, e))
    ranked.sort(key=lambda x: x[0], reverse=True)
    result: list[dict] = []
    used = 0
    seen: set[tuple[str, str]] = set()
    for score, e in ranked:
        signature = (e["path"], e["text"][:120])
        if signature in seen:
            continue
        text = e["text"].strip()
        remaining = max_chars - used
        if remaining <= 120:
            break
        if len(text) > remaining:
            text = text[:remaining]
        result.append({"score": score, "source": e["source"], "module": e["module"], "path": e["path"], "text": text})
        seen.add(signature)
        used += len(text)
        if len(result) >= limit:
            break
    return result


def retrieve_text(question: str, *, topics: Iterable[str] | None = None, engine_hint: str | None = None,
                  limit: int = 8, max_chars: int = 6500) -> str:
    hits = retrieve(question, topics=topics, engine_hint=engine_hint, limit=limit, max_chars=max_chars)
    if not hits:
        return ""
    return "\n\n---\n\n".join(
        f"[{hit['source']} | {hit['module']} | {hit['path']}]\n{hit['text']}" for hit in hits
    )
