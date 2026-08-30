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

logger = logging.getLogger("aura_voice.vercel")

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
