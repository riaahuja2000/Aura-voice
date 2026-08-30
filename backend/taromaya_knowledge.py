"""Dynamic backend-only TAROMAYA knowledge index for AURA-VOICE.

Local exact snapshots are the durable source. Public deployed TAROMAYA assets are
an additive live source so newly published knowledge can become searchable
without changing the Aura Voice interface.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

import taromaya_remote

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

INTENTS = {
    "western_loshu": {"loshu","lo","shu","grid","arrow","plane","kua","personalyear","personalmonth","personalday"},
    "vedic_numerology": {"vedic","mulank","bhagyank","driver","conductor","birthnumber","destinynumber","planet","property","share","market"},
    "mobile_numerology": {"mobile","phone","number","sim","combo","combination"},
    "vedic_dasha": {"dasha","mahadasha","antardasha","pratyantar","vimshottari","period"},
    "kabbalah": {"kabbalah","kabbalistic","path","sephirot","sephirah"},
    "name_numerology": {"name","chaldean","name-number","namenumber","alphabet"},
    "vastu": {"vastu","direction","zone","entrance","factory","business","plot","remedy","crystal","brahma"},
    "tarot": {"tarot","card","cards","arcana","spread","rider","waite","soulmate","booklet","upright","reversed"},
    "astrology": {"astrology","kundali","kundli","horoscope","zodiac","lagna","nakshatra","panchang","transit","kp","jaimini","nadi","shadbala","varshaphal","tajika","ashtakavarga","sarvatobhadra","sudarshana","parashara","lalkitab"},
    "remedies": {"remedy","remedies","healing","mantra","daan","donation","rudraksha","gem","gemstone","crystal"},
    "dreams": {"dream","dreams","sapna","sapne","symbol"},
    "runes": {"rune","runes"},
    "pendulum": {"pendulum","dowsing"},
    "feng_shui": {"feng","shui","fengshui"},
    "signature": {"signature","sign","handwriting"},
    "lunar": {"moon","lunar","phase","tithi","choghadiya","rahu","kaal"},
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
            return [f"{key}: {value}" for key, value in _flatten_json(data) if value.strip()]
        except Exception:
            pass

    lines = [ln.rstrip() for ln in raw.splitlines()]
    chunks: list[str] = []
    buf: list[str] = []
    size = 0
    for ln in lines:
        if not ln.strip():
            if buf and size >= 350:
                chunks.append("\n".join(buf)); buf, size = [], 0
            continue
        buf.append(ln); size += len(ln) + 1
        if size >= 1800:
            chunks.append("\n".join(buf)); buf, size = [], 0
    if buf:
        chunks.append("\n".join(buf))

    literals = []
    for m in _STRING_RE.finditer(raw):
        s = next((g for g in m.groups() if g), "")
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
                module = name; break
        for i, text in enumerate(_source_chunks(path)):
            tokens = _words(text)
            if tokens:
                out.append({"source": rel, "module": module, "chunk": i, "text": text, "tokens": tokens, "live": False})
    return out


def detect_intents(question: str) -> set[str]:
    q = _words(question)
    return {name for name, terms in INTENTS.items() if q & terms}


def _local_search(question: str, topics=None, limit: int = 12) -> list[dict]:
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
        if rec["module"] in intents:
            score += 26
        src_low = rec["source"].lower()
        for intent in intents:
            if intent.replace("_", "-") in src_low or intent.replace("_", "") in src_low.replace("-", "").replace("_", ""):
                score += 12
        text_low = rec["text"].lower()
        if q_low and q_low in text_low:
            score += 45
        if any(k in text_low for k in ("meaning", "advice", "result", "recommendation", "remedy", "interpret", "rule", "planet", "card", "number", "formula", "calculate")):
            score += 4
        if text_low.startswith(("import ", "export type ", "type ", "interface ")):
            score -= 16
        if score >= 12:
            ranked.append((score, rec))
    ranked.sort(key=lambda x: x[0], reverse=True)
    results, seen = [], set()
    for score, rec in ranked:
        key = (rec["source"], rec["text"][:180])
        if key in seen:
            continue
        seen.add(key)
        item = {k: v for k, v in rec.items() if k != "tokens"}; item["score"] = score
        results.append(item)
        if len(results) >= limit:
            break
    return results


def search(question: str, topics=None, limit: int = 6) -> list[dict]:
    local_hits = _local_search(question, topics=topics, limit=12)
    live_hits = []
    try:
        for hit in taromaya_remote.search(question, limit=8):
            live_hits.append({
                "source": f"live:{hit['source_app']}",
                "module": "taromaya_live",
                "chunk": 0,
                "text": hit["text"],
                "score": hit["score"] + 2,
                "live": True,
            })
    except Exception:
        pass
    merged = local_hits + live_hits
    merged.sort(key=lambda r: r.get("score", 0), reverse=True)
    out, seen = [], set()
    for rec in merged:
        key = re.sub(r"\s+", " ", rec["text"]).strip().lower()[:260]
        if key in seen:
            continue
        seen.add(key); out.append(rec)
        if len(out) >= max(1, min(limit, 12)):
            break
    return out


def context(question: str, topics=None, limit: int = 8, max_chars: int = 12000) -> str:
    hits = search(question, topics=topics, limit=limit)
    if not hits:
        return ""
    parts, used = [], 0
    for h in hits:
        block = f"SOURCE: {h['source']} | DOMAIN: {h['module']}\n{h['text'].strip()}"
        if used + len(block) > max_chars:
            block = block[: max(0, max_chars - used)]
        if not block:
            break
        parts.append(block); used += len(block)
        if used >= max_chars:
            break
    return "\n\n---\n\n".join(parts)


def best_plain_answer(question: str, topics=None, max_chars: int = 1400) -> tuple[int, str, str]:
    for hit in search(question, topics=topics, limit=12):
        text = re.sub(r"\s+", " ", hit["text"]).strip()
        code_marks = sum(text.count(x) for x in ("=>", "export const", "function ", "import ", "return {", "type "))
        if code_marks >= 2:
            continue
        if len(text) >= 20:
            return hit["score"], text[:max_chars], hit["source"]
    return 0, "", ""


def refresh_live(force: bool = False) -> dict:
    return taromaya_remote.refresh(force=force)


def status() -> dict:
    rs = records()
    files = sorted({r["source"] for r in rs})
    modules: dict[str, int] = {}
    for r in rs:
        modules[r["module"]] = modules.get(r["module"], 0) + 1
    try:
        live = taromaya_remote.status()
    except Exception as exc:
        live = {"enabled": False, "error": type(exc).__name__}
    return {
        "backend_only": True,
        "dynamic_index": True,
        "source_files": len(files),
        "indexed_chunks": len(rs),
        "modules": modules,
        "files": files,
        "live_sync": live,
        "interface_modified": False,
    }
