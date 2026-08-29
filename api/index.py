"""Vercel serverless entry for AURA-VOICE.

Wraps the existing FastAPI app defined in /backend/server.py. Vercel's Python
runtime auto-detects a module-level ASGI callable named `app` and serves it.
All /api/* requests are routed to this handler by /vercel.json.

This file does NOT modify any existing endpoint, business logic or database
access in backend/server.py — it only re-exports the app.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make `backend/` importable regardless of where Vercel starts the process.
_ROOT = Path(__file__).resolve().parent.parent
_BACKEND = _ROOT / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

# Import the FastAPI application unchanged.
from server import app  # noqa: E402,F401  (re-exported for Vercel)

# `app` is now the ASGI callable Vercel serves.
