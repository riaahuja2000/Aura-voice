"""Dynamic, backend-only TAROMAYA knowledge index for AURA-VOICE.

This module intentionally has no UI dependencies.  It indexes every bundled
TAROMAYA source snapshot under backend/knowledge/taromaya_sources plus the
structured DB snapshot.  Adding another source snapshot automatically makes it
available to the oracle without a frontend change.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent
KNOWLEDGE_DIR = ROOT / "knowledge"
SOURCE_DIR = KNOWLEDGE_DIR / "taromaya_sources"
SNAPSHOT = KNOWLEDGE_DIR / "taromaya_db_snapshot.json"

_WORD_RE = re.compile(r"[a-zA-Z0-9\u0900-\u097F]+")
_STRING_RE = re.compile(r"(?:\"((?:\\.|[^\"\\]){8,})\"|'((?:\\.|[^'\\]){8,})'|`((?:\\.|[^`\\]){8,})`)", re.S)

_STOP = {
    "the","and","for","with","that","this","from","into","your","you","are","was","were","have","has",
    "what","when","where","which","who","how","can","will","would","should","could","about","please","tell",
    "mera","meri","mere","mujhe","main","mein","ka","ki","ke","ko","hai","kya","kaisa","kaisi","kaise",
    "batao","aur","se","par","ek","ye","woh","aap","mujh","kar","karo","hoga","hogi","hain",
}

# Intent vocabulary deliberately includes every imported TAROMAYA domain.
INTENTS = {
    "western_loshu": {"loshu","lo","shu","grid","arrow","plane","kua","personalyear","personalmonth","personalday"},
    "vedic_numerology": {"vedic","mulank","bhagyank","driver","conductor","birthnumber","destinynumber","planet","property","share","market"},
    "mobile_numerology": {"mobile","phone","number","sim","combo","combination"},
    "vedic_dasha": {"dasha","mahadasha","antardasha","pratyantar","vimshottari","period"},
    "kabbalah": {"kabbalah","kabbalistic","path","sephirot","sephirah"},
    "name_numerology": {"name","chaldean","name-number","namenumber","alphabet"},
    "vastu": {"vastu","direction","zone","entrance","factory","business","plot","remedy","crystal"},
    "tarot": {"tarot","card","cards","arcana","spread","rider","waite","soulmate","booklet"},
    "astrology": {"astrology","kundali","kundli","horoscope","zodiac","lagna","nakshatra","panchang","transit","kp","jaimini","nadi","shadbala","varshaphal","tajika","ashtakavarga"},
    "remedies": {"remedy","remedies","healing","mantra","daan","donation","rudraksha","gem","gemstone","crystal"},
    "dreams": {"dream","dreams","sapna","sapne","symbol"},
    "runes": {"rune","runes"},
    "feng_shui": {"feng","shui","fengshui"},
}


def _words(value: str) -> set[str]:
    return {w for w in _WORD_RE.findall((value or "").lower()) if len(w) > 1 and w not in _STOP}


def _flatten_json(obj, path: str = "") -> Iterable[tuple[str, str]]:
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{path}.{k}" if path else str(k)
            yield from _flatten_json(v, p)
    elif isinstance(obj, list):
        if obj and all(not isinstance(x, (dict, list)) for x in obj):
            yield path, ", ".join(str(x) for x in obj)
        else:
            for i, v in enumerate(obj):
                yield from _flatten_json(v, f"{path}[{i}]")
    elif obj is not None:
        yield path, str(obj)


def _source_chunks(path: Path) -> list[str]:
    try:
        raw = path.read_text("utf-8", errors="ignore")
    except Exception:
        return []
    if path.suffix.lower() == ".json":
        try:
            data = json.loads(raw)
            out = []
            for key, value in _flatten_json(data):
                if value.strip():
                    out.append(f"{key}: {value}")
            return out
        except Exception:
            pass

    # Preserve full local context so formula/rule code remains understandable to
    # the voice LLM, while keeping chunks small enough for relevance ranking.
    lines = [ln.rstrip() for ln in raw.splitlines()]
    chunks: list[str] = []
    buf: list[str] = []
    size = 0
    for ln in lines:
        if not ln.strip():
            if buf and size >= 350:
                chunks.append("\n".join(buf))
                buf, size = [], 0
            continue
        buf.append(ln)
        size += len(ln) + 1
        if size >= 1800:
            chunks.append("\n".join(buf))
            buf, size = [], 0
    if buf:
        chunks.append("\n".join(buf))

    # Also index exact human-language string literals. This greatly improves
    # direct, non-LLM consultation while retaining the raw formula chunks above.
    literals = []
    for m in _STRING_RE.finditer(raw):
        s = next((g for g in m.groups() if g), "")
        s = bytes(s, "utf-8").decode("unicode_escape", errors="ignore") if "\\" in s and "\u" not in s else s
        s = re.sub(r"\s+", " ", s).strip()
        if len(s) >= 18 and not s.startswith(("@/", "./", "../", "http://", "https://")):
            literals.append(s)
    return chunks + literals


@lru_cache(maxsize=1)
def records() -> list[dict]:
    files: list[Path] = []
    if SNAPSHOT.exists():
        files.append(SNAPSHOT)
    if SOURCE_DIR.exists():
        files.extend(sorted(p for p in SOURCE_DIR.rglob("*") if p.is_file() and p.suffix.lower() in {".txt", ".json", ".md"}))

    out: list[dict] = []
    for path in files:
        rel = str(path.relative_to(KNOWLEDGE_DIR))
        low = rel.lower()
        module = "taromaya"
        for name, terms in INTENTS.items():
            if any(term.replace("-", "_") in low.replace("-", "_") for term in terms if len(term) >= 4):
                module = name
                break
        for i, text in enumerate(_source_chunks(path)):
            tokens = _words(text)
            if not tokens:
                continue
            out.append({"source": rel, "module": module, "chunk": i, "text": text, "tokens": tokens})
    return out


def detect_intents(question: str) -> set[str]:
    q = _words(question)
    found = set()
    for name, terms in INTENTS.items():
        if q & terms:
            found.add(name)
    return found


def search(question: str, topics=None, limit: int = 6) -> list[dict]:
    q_words = _words(question)
    if not q_words:
        return []
    intents = detect_intents(question)
    for topic in topics or []:
        t = str(topic).strip().lower().replace(" ", "_")
        if t:
            intents.add(t)

    ranked = []
    q_low = question.strip().lower()
    for rec in records():
        overlap = q_words & rec["tokens"]
        if not overlap:
            continue
        score = len(overlap) * 12
        # Domain match is more important than a generic lexical coincidence.
        if rec["module"] in intents:
            score += 26
        src_low = rec["source"].lower()
        for intent in intents:
            if intent.replace("_", "-") in src_low or intent.replace("_", "") in src_low.replace("-", "").replace("_", ""):
                score += 12
        text_low = rec["text"].lower()
        if q_low and q_low in text_low:
            score += 45
        # Prefer explanatory prose/table rows over import/type boilerplate.
        if any(k in text_low for k in ("meaning", "advice", "result", "recommendation", "remedy", "interpret", "rule", "planet", "card", "number")):
            score += 4
        if text_low.startswith(("import ", "export type ", "type ", "interface ")):
            score -= 16
        if score >= 12:
            ranked.append((score, rec))

    ranked.sort(key=lambda x: x[0], reverse=True)
    seen = set()
    results = []
    for score, rec in ranked:
        key = (rec["source"], rec["text"][:180])
        if key in seen:
            continue
        seen.add(key)
        item = {k: v for k, v in rec.items() if k != "tokens"}
        item["score"] = score
        results.append(item)
        if len(results) >= max(1, min(limit, 12)):
            break
    return results


def context(question: str, topics=None, limit: int = 6, max_chars: int = 9000) -> str:
    hits = search(question, topics=topics, limit=limit)
    if not hits:
        return ""
    parts = []
    used = 0
    for h in hits:
        block = f"SOURCE: {h['source']} | DOMAIN: {h['module']}\n{h['text'].strip()}"
        if used + len(block) > max_chars:
            block = block[: max(0, max_chars - used)]
        if not block:
            break
        parts.append(block)
        used += len(block)
        if used >= max_chars:
            break
    return "\n\n---\n\n".join(parts)


def best_plain_answer(question: str, topics=None, max_chars: int = 1400) -> tuple[int, str, str]:
    """Return best human-readable literal/JSON row for the non-voice consult path."""
    for hit in search(question, topics=topics, limit=12):
        text = re.sub(r"\s+", " ", hit["text"]).strip()
        # Skip chunks that are visibly implementation code. String-literal and
        # flattened JSON records naturally pass this filter.
        code_marks = sum(text.count(x) for x in ("=>", "export const", "function ", "import ", "return {", "type "))
        if code_marks >= 2:
            continue
        if len(text) >= 20:
            return hit["score"], text[:max_chars], hit["source"]
    return 0, "", ""


def status() -> dict:
    rs = records()
    files = sorted({r["source"] for r in rs})
    modules: dict[str, int] = {}
    for r in rs:
        modules[r["module"]] = modules.get(r["module"], 0) + 1
    return {
        "backend_only": True,
        "dynamic_index": True,
        "source_files": len(files),
        "indexed_chunks": len(rs),
        "modules": modules,
        "files": files,
    }
