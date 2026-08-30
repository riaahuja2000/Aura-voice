import os
import re
import uuid
import hashlib
import logging
import tempfile
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal

import jwt
import bcrypt
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, field_validator
from dotenv import load_dotenv

import oracle
import oracle_brain
import numerology
import tarot

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("velora")

# ---------------------------------------------------------------- config / db
mongo_url = os.environ["MONGO_URL"]
# Keep serverless cold starts bounded. A temporary Atlas/network issue must not
# prevent Vercel from serving the Aura Voice frontend.
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=10000,
)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
TOKEN_DAYS = 30

OWNER_EMAIL = os.environ["OWNER_EMAIL"].strip().lower()
OWNER_PASSWORD = os.environ["OWNER_PASSWORD"]
OWNER_NAME = os.environ["OWNER_NAME"]

# Optional test/customer seed. No credentials are stored in source control.
SEED_CUSTOMER_EMAIL = os.environ.get("SEED_CUSTOMER_EMAIL", "").strip().lower()
SEED_CUSTOMER_PASSWORD = os.environ.get("SEED_CUSTOMER_PASSWORD", "")
SEED_CUSTOMER_NAME = os.environ.get("SEED_CUSTOMER_NAME", "Customer")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_SLUG = "velora-occult-voice"

DEFAULT_SETTINGS = {
    "_id": "app",
    "app_name": "AURA-VOICE",
    "tagline": "Ask · Receive · Apply · Move",
    "subtitle": "Occult sciences. Real life. Real results.",
    "logo_url": "",
    "background_url": "",
    "voice": "shimmer",
    "speed": 0.95,
    "updated_at": None,
}

app = FastAPI(title="AURA-VOICE API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------- helpers
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8")[:72], bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8")[:72], hashed.encode("utf-8"))
    except Exception:
        return False


def make_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "tv": user.get("token_version", 0),
        "iat": now,
        "exp": now + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u.get("name", ""),
        "email": u["email"],
        "role": u["role"],
        "language": u.get("language", "en"),
        "voice": u.get("voice", ""),
        "speed": u.get("speed", 0),
        "active": u.get("active", True),
        "is_owner": u["role"] == "owner",
        "created_at": u.get("created_at"),
    }


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired session")
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user or not user.get("active", True):
        raise HTTPException(401, "Account unavailable")
    if payload.get("tv", 0) != user.get("token_version", 0):
        raise HTTPException(401, "Session expired")
    return user


def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "owner":
        raise HTTPException(403, "Owner access required")
    return user


# ---------------------------------------------------------------- models
class RegisterBody(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ForgotBody(BaseModel):
    email: EmailStr


class OracleBody(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    lang: Literal["en", "hi", "hng"] = "en"


class NumerologyBody(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    dob: str


class TarotBody(BaseModel):
    spread: str = "three_card"


class SettingsBody(BaseModel):
    app_name: Optional[str] = None
    tagline: Optional[str] = None
    subtitle: Optional[str] = None
    logo_url: Optional[str] = None
    background_url: Optional[str] = None
    voice: Optional[str] = None
    speed: Optional[float] = None


class ActiveBody(BaseModel):
    active: bool


class ResetBody(BaseModel):
    new_password: str = Field(min_length=6, max_length=200)


class KnowledgeBody(BaseModel):
    topic: str
    lang: Literal["en", "hi", "hng"]
    text: str = Field(min_length=1, max_length=20000)


class VoiceConsultBody(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    lang: Literal["en", "hi", "hng"] = "en"


class RefineBody(BaseModel):
    direction: Literal["source", "challenge", "deeper", "simpler", "practical"]
    lang: Literal["en", "hi", "hng"] = "en"


# ---------------------------------------------------------------- auth
@api.post("/auth/register")
async def register(body: RegisterBody):
    email = str(body.email).strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "An account with this email already exists")
    now = datetime.now(timezone.utc).isoformat()
    user = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "email": email,
        "password_hash": hash_pw(body.password),
        "role": "customer",
        "language": "en",
        "active": True,
        "token_version": 0,
        "created_at": now,
    }
    await db.users.insert_one(dict(user))
    return {"token": make_token(user), "user": public_user(user)}


@api.post("/auth/login")
async def login(body: LoginBody):
    email = str(body.email).strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_pw(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(403, "Account disabled")
    return {"token": make_token(user), "user": public_user(user)}


@api.post("/auth/forgot")
async def forgot(body: ForgotBody):
    email = str(body.email).strip().lower()
    user = await db.users.find_one({"email": email})
    if user:
        await db.reset_requests.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "email": email,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---------------------------------------------------------------- seeding
async def ensure_user(email: str, password: str, name: str, role: str):
    existing = await db.users.find_one({"email": email})
    if existing:
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.users.insert_one({
        "id": str(uuid.uuid4()),
        "name": name,
        "email": email,
        "password_hash": hash_pw(password),
        "role": role,
        "language": "en",
        "active": True,
        "token_version": 0,
        "created_at": now,
    })
    logger.info("Seeded %s account: %s", role, email)


@app.on_event("startup")
async def startup():
    # Database initialization is best-effort on serverless cold start. If Atlas
    # is temporarily unreachable, keep the ASGI app alive so the frontend and
    # diagnostic endpoints still load; database-backed requests can recover on
    # later invocations without turning every route into a platform-level 500.
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await ensure_user(OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME, "owner")
        if SEED_CUSTOMER_EMAIL and SEED_CUSTOMER_PASSWORD:
            await ensure_user(SEED_CUSTOMER_EMAIL, SEED_CUSTOMER_PASSWORD, SEED_CUSTOMER_NAME, "customer")
        if not await db.settings.find_one({"_id": "app"}):
            s = dict(DEFAULT_SETTINGS)
            s["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.settings.insert_one(s)
    except Exception as e:
        logger.exception("MongoDB startup initialization failed: %s", e)

    try:
        await run_in_threadpool(_init_storage)
    except Exception as e:
        logger.warning("Object storage init failed (uploads may be unavailable): %s", e)


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------------------------------------------------------------- object storage
_storage_key: Optional[str] = None


def _init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        return None
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _vercel_blob_credentials():
    store_id = (os.getenv("BLOB_STORE_ID") or "").strip()
    rw_token = (os.getenv("BLOB_READ_WRITE_TOKEN") or "").strip()
    oidc = (os.getenv("VERCEL_OIDC_TOKEN") or "").strip()
    return store_id, rw_token, oidc


def _upload_to_vercel_blob(path: str, data: bytes, content_type: str) -> str:
    """Upload using a connected Vercel Blob store.

    Supports either the store read/write token (preferred) or the Vercel OIDC
    token injected into deployments. Returns the public Blob URL.
    """
    store_id, rw_token, oidc = _vercel_blob_credentials()
    if not store_id:
        raise RuntimeError("Blob storage is not configured: missing BLOB_STORE_ID")

    headers = {
        "x-api-version": "7",
        "x-content-type": content_type,
        "x-add-random-suffix": "1",
    }
    if rw_token:
        headers["authorization"] = f"Bearer {rw_token}"
    elif oidc:
        headers["authorization"] = f"Bearer {oidc}"
    else:
        raise RuntimeError("Blob storage is not configured: missing auth token")

    url = f"https://blob.vercel-storage.com/{path}"
    resp = requests.put(url, data=data, headers=headers, timeout=60)
    resp.raise_for_status()
    payload = resp.json()
    public_url = payload.get("url") or payload.get("downloadUrl")
    if not public_url:
        raise RuntimeError("Blob upload returned no URL")
    return public_url


# ---------------------------------------------------------------- oracle knowledge helpers
def _relevant_knowledge_text(question: str, text: str, topics: list[str]) -> tuple[int, str]:
    q = (question or "").strip().lower()
    source = (text or "").strip()
    if not q or not source:
        return 0, ""

    q_terms = {w for w in re.findall(r"[\w'-]{3,}", q, re.UNICODE)}
    if not q_terms:
        q_terms = {q}

    best_score = 0
    best = ""
    for part in re.split(r"\n{2,}|(?<=[.!?])\s+", source):
        candidate = part.strip()
        if len(candidate) < 20:
            continue
        low = candidate.lower()
        score = sum(1 for term in q_terms if term in low)
        score += sum(2 for topic in topics if topic and topic.lower() in low)
        if score > best_score:
            best_score = score
            best = candidate
    return best_score, best


# ---------------------------------------------------------------- oracle
@api.post("/oracle/ask")
async def oracle_ask(body: OracleBody, user: dict = Depends(get_current_user)):
    question = body.question.strip()
    topics = oracle.detect_topics(question)

    # Retrieve exact uploaded/custom knowledge first.
    custom_entries = await db.knowledge_entries.find({
        "deleted_at": None,
        "lang": {"$in": [body.lang, "en", "hi", "hng"]},
    }).sort("created_at", -1).to_list(500)

    best_score = 0
    best_answer = ""
    best_entry = None
    normalized_topics = {str(t).strip().lower() for t in topics}

    for entry in custom_entries:
        entry_text = str(entry.get("text", ""))
        score, candidate = _relevant_knowledge_text(question, entry_text, topics)
        if not candidate:
            continue
        entry_topic = str(entry.get("topic", "")).strip().lower()
        entry_lang = str(entry.get("lang", "")).strip().lower()
        if entry_topic and entry_topic in normalized_topics:
            score += 10
        if entry_lang and entry_lang == body.lang:
            score += 4
        if score > best_score:
            best_score = score
            best_answer = candidate
            best_entry = entry

    if best_answer:
        result = {
            "answer": best_answer,
            "topics": topics,
            "primary": best_entry.get("topic") if best_entry else (topics[0] if topics else "General"),
        }
    else:
        result = oracle.compose_answer(question, body.lang)

    now = datetime.now(timezone.utc).isoformat()
    reading = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "question": question,
        "answer": result["answer"],
        "topics": result["topics"],
        "primary": result["primary"],
        "lang": body.lang,
        "created_at": now,
    }
    await db.readings.insert_one(dict(reading))
    reading.pop("_id", None)
    return reading


@api.get("/oracle/daily")
async def daily(lang: str = "en", user: dict = Depends(get_current_user)):
    if lang not in ("en", "hi", "hng"):
        lang = "en"
    day = datetime.now(timezone.utc).date().isoformat()
    text = oracle.daily_reading(f"{user['id']}:{day}:{lang}", lang)
    return {"date": day, "text": text}


@api.get("/readings")
async def my_readings(user: dict = Depends(get_current_user)):
    rows = await db.readings.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    for r in rows:
        r.pop("_id", None)
    return rows


# ---------------------------------------------------------------- numerology engine
@api.post("/numerology/reading")
async def numerology_reading(body: NumerologyBody, user: dict = Depends(get_current_user)):
    try:
        return numerology.reading(body.full_name, body.dob)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ---------------------------------------------------------------- tarot engine
@api.get("/tarot/deck")
async def tarot_deck(user: dict = Depends(get_current_user)):
    return {"count": len(tarot.DECK), "spreads": list(tarot.SPREADS.keys()), "cards": tarot.DECK}


@api.post("/tarot/draw")
async def tarot_draw(body: TarotBody, user: dict = Depends(get_current_user)):
    return tarot.draw(body.spread)


# ---------------------------------------------------------------- settings (branding)
@api.get("/settings")
async def get_settings():
    try:
        s = await db.settings.find_one({"_id": "app"})
    except Exception as e:
        logger.warning("MongoDB settings read failed; using defaults: %s", e)
        s = None
    s = s or dict(DEFAULT_SETTINGS)
    s.pop("_id", None)
    return s


@api.put("/owner/settings")
async def update_settings(body: SettingsBody, owner: dict = Depends(require_owner)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "speed" in updates:
        updates["speed"] = max(0.5, min(2.0, float(updates["speed"])))
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one({"_id": "app"}, {"$set": updates}, upsert=True)
    s = await db.settings.find_one({"_id": "app"})
    s.pop("_id", None)
    return s


@api.post("/owner/upload")
async def upload_branding(
    kind: str = Form(...),
    file: UploadFile = File(...),
    owner: dict = Depends(require_owner),
):
    if kind not in ("logo", "background"):
        raise HTTPException(400, "Invalid image type.")

    ct = (file.content_type or "").lower()
    allowed = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
    }
    if ct not in allowed:
        raise HTTPException(400, "Only PNG, JPG, JPEG or WEBP images are allowed.")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty image.")
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 8 MB.")

    ext = allowed[ct]
    path = f"{APP_SLUG}/branding/{kind}-{uuid.uuid4().hex}.{ext}"
    await db.media_files.insert_one({
        "id": str(uuid.uuid4()),
        "path": path,
        "kind": kind,
        "content_type": ct,
        "data": data,
        "size": len(data),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    field = "logo_url" if kind == "logo" else "background_url"
    url = f"/api/media?path={path}"
    await db.settings.update_one(
        {"_id": "global"},
        {"$set": {field: url, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"url": url, "kind": kind, "ok": True}


@api.get("/media")
async def get_media(path: str):
    if not path.startswith(f"{APP_SLUG}/branding/"):
        raise HTTPException(400, "Bad path.")
    media = await db.media_files.find_one({"path": path})
    if not media or not media.get("data"):
        raise HTTPException(404, "Not found.")
    return Response(
        content=media["data"],
        media_type=media.get("content_type", "application/octet-stream"),
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ---------------------------------------------------------------- owner console
@api.get("/owner/overview")
async def owner_overview(owner: dict = Depends(require_owner)):
    readings = await db.readings.find().sort("created_at", -1).to_list(500)
    users = await db.users.find().sort("created_at", -1).to_list(500)
    for r in readings:
        r.pop("_id", None)

    topic_counts: dict[str, int] = {}
    for r in readings:
        for t in r.get("topics", []):
            if t == "general":
                continue
            topic_counts[t] = topic_counts.get(t, 0) + 1
    most_asked = sorted(topic_counts.items(), key=lambda x: -x[1])[:8]
    most_asked = [{"name": n, "count": c} for n, c in most_asked]

    today_key = datetime.now(timezone.utc).date().isoformat()

    def day_key(iso: str) -> str:
        try:
            return datetime.fromisoformat(iso.replace("Z", "+00:00")).date().isoformat()
        except Exception:
            return ""

    last7 = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).date()
        key = d.isoformat()
        count = sum(1 for r in readings if day_key(r.get("created_at", "")) == key)
        last7.append({"date": key, "dow": d.weekday(), "count": count})

    members = []
    for u in users:
        rc = sum(1 for r in readings if r["user_id"] == u["id"])
        members.append({
            "id": u["id"], "name": u.get("name", ""), "email": u["email"],
            "role": u["role"], "active": u.get("active", True),
            "is_owner": u["role"] == "owner", "created_at": u.get("created_at"),
            "readings": rc,
        })

    reset_requests = await db.reset_requests.find({"status": "pending"}).sort("created_at", -1).to_list(100)
    for rr in reset_requests:
        rr.pop("_id", None)

    return {
        "total_sessions": len(readings),
        "registered_users": len(users),
        "today": sum(1 for r in readings if day_key(r.get("created_at", "")) == today_key),
        "topics_covered": len(topic_counts),
        "most_asked": most_asked,
        "last7": last7,
        "recent": readings[:15],
        "members": members,
        "reset_requests": reset_requests,
    }


@api.post("/owner/customers/{cid}/active")
async def set_active(cid: str, body: ActiveBody, owner: dict = Depends(require_owner)):
    target = await db.users.find_one({"id": cid})
    if not target:
        raise HTTPException(404, "Customer not found")
    if target["role"] == "owner":
        raise HTTPException(400, "Cannot modify the owner account.")
    await db.users.update_one({"id": cid}, {"$set": {"active": body.active}, "$inc": {"token_version": 1}})
    return {"ok": True, "active": body.active}


@api.post("/owner/customers/{cid}/reset")
async def reset_customer(cid: str, body: ResetBody, owner: dict = Depends(require_owner)):
    target = await db.users.find_one({"id": cid})
    if not target:
        raise HTTPException(404, "Customer not found")
    if target["role"] == "owner":
        raise HTTPException(400, "Cannot reset the owner account here.")
    await db.users.update_one({"id": cid},
                              {"$set": {"password_hash": hash_pw(body.new_password)}, "$inc": {"token_version": 1}})
    await db.reset_requests.update_one({"user_id": cid}, {"$set": {"status": "done"}})
    return {"ok": True}


@api.get("/owner/knowledge")
async def list_knowledge(owner: dict = Depends(require_owner)):
    topics = [tk for tk in oracle.PACK.keys() if tk != "general"]
    base_counts = {tk: sum(len(oracle.PACK[tk].get(l, [])) for l in ("en", "hi", "hng")) for tk in topics}
    entries = await db.knowledge_entries.find({"deleted_at": None}).sort("created_at", -1).to_list(500)
    for e in entries:
        e.pop("_id", None)
    files = await db.kb_files.find({"deleted_at": None}).sort("created_at", -1).to_list(200)
    for f in files:
        f.pop("_id", None)
    custom_counts: dict[str, int] = {}
    for e in entries:
        custom_counts[e["topic"]] = custom_counts.get(e["topic"], 0) + 1
    return {"topics": topics, "base_counts": base_counts, "custom_counts": custom_counts,
            "entries": entries, "files": files}


@api.post("/owner/knowledge")
async def add_knowledge(body: KnowledgeBody, owner: dict = Depends(require_owner)):
    if body.topic not in oracle.PACK:
        raise HTTPException(400, "Unknown tradition.")
    doc = {
        "id": str(uuid.uuid4()),
        "topic": body.topic,
        "lang": body.lang,
        "text": body.text.strip(),
        "deleted_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.knowledge_entries.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api.delete("/owner/knowledge/{eid}")
async def delete_knowledge(eid: str, owner: dict = Depends(require_owner)):
    await db.knowledge_entries.update_one({"id": eid}, {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}


@api.post("/owner/knowledge/upload")
async def upload_knowledge(
    file: UploadFile = File(...),
    owner: dict = Depends(require_owner),
):
    from io import BytesIO
    import json as _json

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file.")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "File must be under 25 MB.")

    name = file.filename or "knowledge.txt"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else "txt"
    ct = file.content_type or "application/octet-stream"
    allowed = {"json", "txt", "md", "csv", "pdf", "docx"}
    if ext not in allowed:
        raise HTTPException(400, "Supported files: JSON, TXT, MD, CSV, PDF and DOCX.")

    now = datetime.now(timezone.utc).isoformat()
    bulk = []
    ingested = 0
    extracted_text = ""

    if ext == "json":
        try:
            parsed = _json.loads(data.decode("utf-8"))
            structured = False
            if isinstance(parsed, dict):
                for topic, langs in parsed.items():
                    if topic in oracle.PACK and isinstance(langs, dict):
                        structured = True
                        for lg, arr in langs.items():
                            if lg not in ("en", "hi", "hng"):
                                continue
                            if isinstance(arr, str):
                                arr = [arr]
                            if not isinstance(arr, list):
                                continue
                            for txt in arr:
                                if isinstance(txt, str) and txt.strip():
                                    bulk.append({
                                        "id": str(uuid.uuid4()), "topic": topic, "lang": lg,
                                        "text": txt.strip(), "deleted_at": None, "created_at": now,
                                    })
            if not structured:
                extracted_text = _json.dumps(parsed, ensure_ascii=False, indent=2)
        except Exception as e:
            raise HTTPException(400, f"Invalid JSON file: {str(e)}")
    elif ext in ("txt", "md", "csv"):
        try:
            extracted_text = data.decode("utf-8")
        except UnicodeDecodeError:
            extracted_text = data.decode("latin-1", errors="ignore")
    elif ext == "pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(data))
            extracted_text = "\n\n".join((page.extract_text() or "") for page in reader.pages if (page.extract_text() or "").strip())
        except Exception as e:
            raise HTTPException(400, f"Could not read PDF: {str(e)}")
    elif ext == "docx":
        try:
            from docx import Document
            document = Document(BytesIO(data))
            extracted_text = "\n".join(p.text for p in document.paragraphs if p.text.strip())
        except Exception as e:
            raise HTTPException(400, f"Could not read DOCX: {str(e)}")

    if extracted_text.strip():
        cleaned = "\n".join(line.strip() for line in extracted_text.splitlines() if line.strip())
        chunks = [cleaned[i:i + 3500] for i in range(0, len(cleaned), 3500) if cleaned[i:i + 3500].strip()]
        filename_topics = [topic for topic in oracle.PACK.keys() if topic.lower() in name.lower()]
        for chunk in chunks:
            detected_topics = [topic for topic in oracle.detect_topics(chunk) if topic in oracle.PACK]
            if not detected_topics:
                detected_topics = filename_topics or ["General"]
            for topic in dict.fromkeys(detected_topics):
                for lg in ("en", "hi", "hng"):
                    bulk.append({
                        "id": str(uuid.uuid4()), "topic": topic, "lang": lg,
                        "text": chunk, "deleted_at": None, "created_at": now,
                    })

    if bulk:
        await db.knowledge_entries.insert_many([dict(item) for item in bulk])
        ingested = len(bulk)
    if ingested == 0:
        raise HTTPException(400, "The file contained no readable knowledge.")

    file_id = str(uuid.uuid4())
    rec = {
        "id": file_id, "name": name, "path": f"mongodb://knowledge/{file_id}",
        "content_type": ct, "size": len(data), "ingested": ingested,
        "deleted_at": None, "created_at": now,
    }
    await db.kb_files.insert_one(dict(rec))
    rec.pop("_id", None)
    return rec


# ---------------------------------------------------------------- voice oracle brain
async def _oracle_llm(system_msg: str, user_text: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"oracle-{uuid.uuid4().hex}",
        system_message=system_msg,
    ).with_model("anthropic", "claude-sonnet-4-6")
    return ((await chat.send_message(UserMessage(text=user_text))) or "").strip()


def _voice_response(user_id: str, question: str, answer: str, lang: str,
                    engine: str, mode: str, action: str) -> dict:
    return {
        "id": str(uuid.uuid4()), "user_id": user_id, "question": question,
        "answer": answer, "lang": lang, "engine": engine, "mode": mode,
        "action": action, "created_at": datetime.now(timezone.utc).isoformat(),
    }


async def _save_reading(reading: dict, substantive: bool):
    doc = dict(reading)
    doc["substantive"] = substantive
    try:
        await db.voice_readings.insert_one(doc)
    except Exception:
        pass


async def _last_substantive_reading(user_id: str) -> Optional[dict]:
    return await db.voice_readings.find_one(
        {"user_id": user_id, "substantive": True}, sort=[("created_at", -1)]
    )


async def _refine_reading(user: dict, direction: str, lang: str) -> dict:
    last = await _last_substantive_reading(user["id"])
    if not last:
        return _voice_response(user["id"], direction, oracle_brain.MSGS["no_reading"][lang],
                               lang, "general", "system", "none")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "Oracle unavailable — server not configured.")
    prompt = (
        f"THE SEEKER'S ORIGINAL QUESTION: {last['question']}\n"
        f"ENGINE USED: {last.get('engine', 'general')}\n"
        f"YOUR PREVIOUS SPOKEN READING: {last['answer']}"
    )
    try:
        raw = await _oracle_llm(oracle_brain.refine_system(lang, direction), prompt)
    except Exception as e:
        logger.exception("Voice refine failed: %s", e)
        raise HTTPException(502, "The oracle is silent. Try again in a moment.")
    answer = oracle_brain.sanitize_speech(raw)
    if not answer:
        raise HTTPException(502, "The oracle returned only silence.")
    reading = _voice_response(user["id"], last["question"], answer, lang,
                              last.get("engine", "general"), f"refine:{direction}", "answer")
    await _save_reading(reading, substantive=True)
    return reading


@api.post("/voice/refine")
async def voice_refine(body: RefineBody, user: dict = Depends(get_current_user)):
    reading = await _refine_reading(user, body.direction, body.lang)
    reading.pop("_id", None)
    return reading


@api.post("/voice/consult")
async def voice_consult(body: VoiceConsultBody, user: dict = Depends(get_current_user)):
    question = body.question.strip()
    if not question:
        raise HTTPException(400, "Empty question.")
    lang = body.lang
    uid = user["id"]

    cmd = oracle_brain.detect_command(question)
    if cmd:
        name, remainder = cmd
        if name == "rescue":
            reading = _voice_response(uid, question, oracle_brain.RESCUE[lang], lang,
                                      "mindfulness", "rescue", "rescue")
            await _save_reading(reading, substantive=False)
            return reading
        if name == "forget":
            await db.voice_turns.delete_many({"user_id": uid})
            return _voice_response(uid, question, oracle_brain.MSGS["forgotten"][lang],
                                   lang, "general", "system", "forgotten")
        if name == "delete_history":
            await db.voice_turns.delete_many({"user_id": uid})
            await db.voice_readings.delete_many({"user_id": uid})
            await db.voice_bookmarks.delete_many({"user_id": uid})
            return _voice_response(uid, question, oracle_brain.MSGS["deleted"][lang],
                                   lang, "general", "system", "deleted")
        if name == "privacy":
            await db.users.update_one({"id": uid}, {"$set": {"memory_opt_out": True}})
            await db.voice_turns.delete_many({"user_id": uid})
            return _voice_response(uid, question, oracle_brain.MSGS["privacy"][lang],
                                   lang, "general", "system", "privacy")
        if name == "save":
            last = await _last_substantive_reading(uid)
            if not last:
                return _voice_response(uid, question, oracle_brain.MSGS["nothing_to_save"][lang],
                                       lang, "general", "system", "none")
            await db.voice_bookmarks.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid,
                "question": last["question"], "answer": last["answer"],
                "lang": last.get("lang", lang),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            return _voice_response(uid, question, oracle_brain.MSGS["saved"][lang],
                                   lang, last.get("engine", "general"), "system", "saved")
        if name == "play":
            marks = await db.voice_bookmarks.find({"user_id": uid}).sort("created_at", -1).to_list(100)
            best, best_score = None, 0
            query = remainder or question
            for m in marks:
                s = oracle_brain.bookmark_score(query, m)
                if s > best_score:
                    best, best_score = m, s
            if not best and marks:
                best = marks[0]
            if not best:
                return _voice_response(uid, question, oracle_brain.MSGS["no_bookmark"][lang],
                                       lang, "general", "system", "none")
            return _voice_response(uid, question, best["answer"], best.get("lang", lang),
                                   "general", "bookmark", "bookmark")
        if name in ("source", "challenge"):
            reading = await _refine_reading(user, name, lang)
            reading.pop("_id", None)
            return reading

    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "Oracle unavailable — server not configured.")

    memory_off = bool(user.get("memory_opt_out"))
    turns: list = []
    if not memory_off:
        turns = await db.voice_turns.find({"user_id": uid}).sort("created_at", -1).to_list(12)
        turns.reverse()

    prev_questions = [t["text"] for t in turns if t.get("role") == "seeker"]
    repeated = oracle_brain.is_repeated_question(question, prev_questions)
    last_was_clarify = bool(turns) and turns[-1].get("role") == "oracle" and turns[-1].get("mode") == "clarify"

    parts = []
    if turns:
        memory = "\n".join(
            f"{'Seeker' if t['role'] == 'seeker' else 'You (oracle)'}: {t['text']}" for t in turns
        )
        parts.append(f"CONVERSATION MEMORY (context DNA — follow-ups stay in this exact context):\n{memory}\n")
    parts.append(f"THE SEEKER NOW SAYS: {question}")

    try:
        raw = await _oracle_llm(oracle_brain.oracle_system(lang, repeated, last_was_clarify), "\n".join(parts))
    except Exception as e:
        logger.exception("Voice consult failed: %s", e)
        raise HTTPException(502, "The oracle is silent. Try again in a moment.")

    engine, mode, answer = oracle_brain.parse_oracle(raw)
    if not answer:
        raise HTTPException(502, "The oracle returned only silence.")

    action = "clarify" if mode == "clarify" else "answer"
    reading = _voice_response(uid, question, answer, lang, engine, mode, action)
    await _save_reading(reading, substantive=(mode in ("answer", "council")))

    if mode in ("clarify", "boundary"):
        try:
            await db.failed_questions.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid, "question": question,
                "lang": lang, "reason": mode,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass

    if not memory_off:
        now = datetime.now(timezone.utc).isoformat()
        try:
            await db.voice_turns.insert_many([
                {"user_id": uid, "role": "seeker", "text": question, "mode": "", "created_at": now},
                {"user_id": uid, "role": "oracle", "text": answer, "mode": mode, "created_at": now},
            ])
            stale = await db.voice_turns.find({"user_id": uid}).sort("created_at", -1).skip(24).to_list(200)
            if stale:
                await db.voice_turns.delete_many({"_id": {"$in": [s["_id"] for s in stale]}})
        except Exception:
            pass
    return reading


# ---------------------------------------------------------------- owner voice console
@api.get("/owner/voice-log")
async def owner_voice_log(owner: dict = Depends(require_owner)):
    rows = await db.voice_readings.find().sort("created_at", -1).to_list(150)
    users = await db.users.find().to_list(500)
    emails = {u["id"]: u.get("email", "") for u in users}
    engine_counts: dict[str, int] = {}
    for r in rows:
        r.pop("_id", None)
        r["email"] = emails.get(r.get("user_id", ""), "")
        if r.get("substantive"):
            e = r.get("engine", "general")
            engine_counts[e] = engine_counts.get(e, 0) + 1
    failed = await db.failed_questions.find().sort("created_at", -1).to_list(50)
    for f in failed:
        f.pop("_id", None)
        f["email"] = emails.get(f.get("user_id", ""), "")
    engines = sorted(engine_counts.items(), key=lambda x: -x[1])
    return {
        "readings": rows[:80], "failed": failed,
        "engines": [{"name": n, "count": c} for n, c in engines],
        "total": len(rows), "bookmarks": await db.voice_bookmarks.count_documents({}),
    }


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
