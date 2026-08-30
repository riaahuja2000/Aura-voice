"""Vercel serverless entry for AURA-VOICE.

This module exposes a top-level ASGI callable named ``app`` for Vercel,
reuses the existing FastAPI application from ``backend/server.py``, and serves
the Expo web build from the same function so production has one reliable
origin for both the SPA and /api routes.
"""
from __future__ import annotations

import inspect
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

_ROOT = Path(__file__).resolve().parent.parent
_BACKEND = _ROOT / "backend"
_DIST = _ROOT / "frontend" / "dist"

if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

import server as backend_server  # noqa: E402
import taromaya_knowledge  # noqa: E402

logger = logging.getLogger("aura_voice.vercel")

# ---------------------------------------------------------------------------
# Backend-only TAROMAYA knowledge injection
# ---------------------------------------------------------------------------
# The existing mobile UI and routes remain untouched.  The voice oracle already
# sends its final prompt through backend_server._oracle_llm, so wrapping that
# one backend function gives every voice question access to the bundled
# TAROMAYA corpus while preserving the existing router, memory and speech flow.
_original_oracle_llm = backend_server._oracle_llm


async def _taromaya_aware_oracle_llm(system_msg: str, user_text: str) -> str:
    ctx = taromaya_knowledge.context(user_text, limit=8, max_chars=12000)
    if ctx:
        user_text = (
            f"{user_text}\n\n"
            "TAROMAYA BACKEND KNOWLEDGE — use this as the primary domain reference when relevant. "
            "Do not mention source code, files, databases or this context to the seeker. "
            "Do not invent a calculation that needs missing birth/name/card inputs; ask one concise "
            "clarifying question instead. Treat occult interpretations as traditional/symbolic, not "
            "guaranteed medical, legal or financial fact.\n\n"
            f"{ctx}"
        )
    return await _original_oracle_llm(system_msg, user_text)


backend_server._oracle_llm = _taromaya_aware_oracle_llm

# The text consultation endpoint falls back through oracle.compose_answer.  Keep
# owner-uploaded Mongo/Neon knowledge first, then use bundled TAROMAYA data,
# then preserve the original built-in oracle as the final fallback.
_original_compose_answer = backend_server.oracle.compose_answer


def _taromaya_aware_compose_answer(question: str, lang: str = "en"):
    topics = backend_server.oracle.detect_topics(question)
    score, answer, source = taromaya_knowledge.best_plain_answer(question, topics=topics)
    if answer and score >= 18:
        return {
            "answer": answer,
            "topics": topics,
            "primary": topics[0] if topics else "General",
            "knowledge_source": "taromaya",
            "source_ref": source,
        }
    return _original_compose_answer(question, lang)


backend_server.oracle.compose_answer = _taromaya_aware_compose_answer

# Prefer a Vercel Marketplace PostgreSQL/Neon database whenever it is present.
# The compatibility layer keeps the existing Mongo-style API routes unchanged.
_database_url = (
    os.getenv("DATABASE_URL")
    or os.getenv("POSTGRES_URL")
    or os.getenv("NEON_DATABASE_URL")
    or ""
).strip()
if _database_url:
    from db_compat import PostgresDocumentClient  # noqa: E402

    _pg_client = PostgresDocumentClient(_database_url)
    backend_server.client = _pg_client
    backend_server.db = _pg_client[(os.getenv("DB_NAME") or "aura_voice").strip()]
    logger.info("Aura Voice persistent store: PostgreSQL/Neon")

backend_app = backend_server.app


async def _sync_managed_account(
    email: str,
    password: str,
    name: str,
    role: str,
    *,
    lifetime_free: bool = False,
) -> None:
    """Keep designated accounts aligned with encrypted Vercel environment values."""
    email = (email or "").strip().lower()
    password = password or ""
    if not email or not password:
        return

    now = datetime.now(timezone.utc).isoformat()
    existing = await backend_server.db.users.find_one({"email": email})

    common = {
        "name": (name or ("Owner" if role == "owner" else "Customer")).strip(),
        "email": email,
        "role": role,
        "active": True,
    }
    if role == "owner":
        common.update({
            "protected_account": True,
            "account_type": "owner",
        })
    if lifetime_free:
        common.update({
            "permanent_free": True,
            "plan": "lifetime_free",
            "billing_required": False,
            "subscription_expires_at": None,
        })

    if existing:
        password_changed = not backend_server.verify_pw(
            password,
            existing.get("password_hash", ""),
        )
        updates = dict(common)
        if password_changed:
            updates["password_hash"] = backend_server.hash_pw(password)
            updates["token_version"] = (existing.get("token_version", 0) or 0) + 1
        await backend_server.db.users.update_one(
            {"email": email},
            {"$set": updates},
        )
        logger.info(
            "Synced managed %s account (password_updated=%s, lifetime_free=%s)",
            role,
            password_changed,
            lifetime_free,
        )
        return

    doc = {
        "id": str(uuid.uuid4()),
        **common,
        "password_hash": backend_server.hash_pw(password),
        "language": "en",
        "token_version": 0,
        "created_at": now,
    }
    await backend_server.db.users.insert_one(doc)
    logger.info(
        "Created managed %s account (lifetime_free=%s)",
        role,
        lifetime_free,
    )


# Keep the original backend startup behavior, but do not let a temporary
# external-service failure make the entire Vercel function fail before the
# frontend can load.
_original_startup_handlers = list(backend_app.router.on_startup)
backend_app.router.on_startup.clear()


@backend_app.on_event("startup")
async def _resilient_vercel_startup():
    for handler in _original_startup_handlers:
        try:
            result = handler()
            if inspect.isawaitable(result):
                await result
        except Exception as exc:
            logger.exception("Aura Voice startup dependency failed: %s", exc)

    # Enforce the designated owner and the permanent free customer after the
    # normal seed step. Passwords remain only in encrypted Vercel variables.
    try:
        await _sync_managed_account(
            os.getenv("OWNER_EMAIL", ""),
            os.getenv("OWNER_PASSWORD", ""),
            os.getenv("OWNER_NAME", "Owner"),
            "owner",
        )
        await _sync_managed_account(
            os.getenv("SEED_CUSTOMER_EMAIL", ""),
            os.getenv("SEED_CUSTOMER_PASSWORD", ""),
            os.getenv("SEED_CUSTOMER_NAME", "Customer"),
            "customer",
            lifetime_free=True,
        )
    except Exception as exc:
        logger.exception("Aura Voice managed-account sync failed: %s", exc)


# Explicit top-level assignment is required by Vercel's Python runtime.
app = backend_app


@app.get("/api/health/db", include_in_schema=False)
async def vercel_db_health():
    """Internal-safe database reachability check without exposing credentials."""
    try:
        await backend_server.client.admin.command("ping")
        return {"database": "ok", "engine": "postgres" if _database_url else "mongodb"}
    except Exception as exc:
        logger.exception("Aura Voice database health check failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"Database unavailable: {type(exc).__name__}")


@app.get("/api/health/blob", include_in_schema=False)
async def vercel_blob_health():
    """Report only whether Vercel Blob prerequisites are present; never expose secrets."""
    return {
        "blob_store_configured": bool((os.getenv("BLOB_STORE_ID") or "").strip()),
        "vercel_oidc_available": bool((os.getenv("VERCEL_OIDC_TOKEN") or "").strip()),
    }


@app.get("/api/health/storage-options", include_in_schema=False)
async def vercel_storage_options():
    """Report presence of common persistent Vercel Marketplace data stores without secrets."""
    return {
        "postgres": bool((os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL") or "").strip()),
        "neon": bool((os.getenv("NEON_DATABASE_URL") or os.getenv("DATABASE_URL") or "").strip()),
        "vercel_kv": bool((os.getenv("KV_REST_API_URL") or os.getenv("KV_URL") or "").strip()),
        "upstash_redis": bool((os.getenv("UPSTASH_REDIS_REST_URL") or os.getenv("UPSTASH_REDIS_REST_TOKEN") or "").strip()),
        "blob": bool((os.getenv("BLOB_STORE_ID") or "").strip()),
    }


@app.get("/api/knowledge/status", include_in_schema=False)
async def taromaya_knowledge_status():
    """Safe runtime proof that the backend-only TAROMAYA corpus is indexed."""
    return taromaya_knowledge.status()


# The Expo export is generated during the Vercel build and bundled into this
# function via vercel.json includeFiles. Existing /api routes were registered
# on backend_app before these frontend routes, so API behavior is unchanged.
if _DIST.exists():
    expo_dir = _DIST / "_expo"
    assets_dir = _DIST / "assets"

    if expo_dir.exists():
        app.mount("/_expo", StaticFiles(directory=str(expo_dir)), name="expo-static")
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="app-assets")

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon():
        return FileResponse(_DIST / "favicon.ico")

    @app.get("/metadata.json", include_in_schema=False)
    async def metadata():
        return FileResponse(_DIST / "metadata.json")

    @app.get("/", include_in_schema=False)
    async def frontend_root():
        return FileResponse(_DIST / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def frontend_spa(full_path: str):
        # Preserve API 404 semantics instead of returning the SPA for bad API URLs.
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")

        candidate = (_DIST / full_path).resolve()
        dist_root = _DIST.resolve()
        if candidate.is_file() and (candidate == dist_root or dist_root in candidate.parents):
            return FileResponse(candidate)

        # Expo Router handles client-side routes after index.html loads.
        return FileResponse(_DIST / "index.html")
