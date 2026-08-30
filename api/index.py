"""Vercel serverless entry for AURA-VOICE.

This module exposes a top-level ASGI callable named ``app`` for Vercel,
reuses the existing FastAPI application from ``backend/server.py``, and serves
the Expo web build from the same function so production has one reliable
origin for both the SPA and /api routes.
"""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

_ROOT = Path(__file__).resolve().parent.parent
_BACKEND = _ROOT / "backend"
_DIST = _ROOT / "frontend" / "dist"

if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from server import app as backend_app  # noqa: E402

# Explicit top-level assignment is required by Vercel's Python runtime.
app = backend_app

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
