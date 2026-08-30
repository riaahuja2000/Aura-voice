"""Vercel serverless entry for AURA-VOICE.

This module exposes a top-level ASGI callable named ``app`` for Vercel and
reuses the existing FastAPI application from ``backend/server.py`` unchanged.
"""
from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_BACKEND = _ROOT / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from server import app as backend_app  # noqa: E402

# Explicit assignment is required for Vercel's Python entrypoint detector.
app = backend_app
