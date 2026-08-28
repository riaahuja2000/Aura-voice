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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("velora")

# ---------------------------------------------------------------- config / db
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "velora-dev-secret-change-me")
JWT_ALG = "HS256"
TOKEN_DAYS = 30

OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "riaahuja2000@gmail.com").strip().lower()
OWNER_PASSWORD = os.environ.get("OWNER_PASSWORD", "rioelixir")
OWNER_NAME = os.environ.get("OWNER_NAME", "Ria Ahuja")
SEED_CUSTOMER_EMAIL = os.environ.get("SEED_CUSTOMER_EMAIL", "taromaya@gmail.com").strip().lower()
SEED_CUSTOMER_PASSWORD = os.environ.get("SEED_CUSTOMER_PASSWORD", "123456789")
SEED_CUSTOMER_NAME = os.environ.get("SEED_CUSTOMER_NAME", "Maya")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_SLUG = "velora-occult-voice"

DEFAULT_SETTINGS = {
    "_id": "app",
    "app_name": "VELORA",
    "tagline": "Ask · Receive · Apply · Move",
    "subtitle": "Occult sciences. Real life. Real results.",
    "logo_url": "",
    "background_url": "",
    "voice": "shimmer",
    "speed": 0.95,
    "updated_at": None,
}

app = FastAPI(title="VELORA API")
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
    if not user or payload.get("tv") != user.get("token_version", 0):
        raise HTTPException(401, "Session expired")
    if not user.get("active", True):
        raise HTTPException(403, "Your account has been deactivated. Contact the keeper.")
    return user


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "owner":
        raise HTTPException(403, "Owner access required")
    return user


# ---------------------------------------------------------------- models
class RegisterBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def _pw(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ForgotBody(BaseModel):
    email: EmailStr


class ConsultBody(BaseModel):
    question: str
    lang: Literal["en", "hi", "hng"] = "en"


class SpeakBody(BaseModel):
    text: str
    lang: Literal["en", "hi", "hng"] = "en"


class ProfileBody(BaseModel):
    name: Optional[str] = Field(default=None, max_length=60)
    language: Optional[Literal["en", "hi", "hng"]] = None
    voice: Optional[str] = None
    speed: Optional[float] = None


class KnowledgeBody(BaseModel):
    topic: str
    lang: Literal["en", "hi", "hng"]
    text: str = Field(min_length=8)


class SettingsBody(BaseModel):
    app_name: Optional[str] = None
    tagline: Optional[str] = None
    subtitle: Optional[str] = None
    voice: Optional[str] = None
    speed: Optional[float] = None


class ActiveBody(BaseModel):
    active: bool


class ResetBody(BaseModel):
    new_password: str = Field(min_length=8)


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
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await ensure_user(OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME, "owner")
    await ensure_user(SEED_CUSTOMER_EMAIL, SEED_CUSTOMER_PASSWORD, SEED_CUSTOMER_NAME, "customer")
    if not await db.settings.find_one({"_id": "app"}):
        s = dict(DEFAULT_SETTINGS)
        s["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.settings.insert_one(s)
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


def _put_object(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = _init_storage()
    if not key:
        raise RuntimeError("Storage unavailable")
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 503:
        _storage_key = None
        key = _init_storage()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def _get_object(path: str) -> tuple[bytes, str]:
    global _storage_key
    key = _init_storage()
    if not key:
        raise RuntimeError("Storage unavailable")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------- TTS
_tts_cache: dict[str, bytes] = {}


def _tts_key(text: str, voice: str, speed: float) -> str:
    return hashlib.sha256(f"{text}|{voice}|{speed}|tts-1|mp3".encode("utf-8")).hexdigest()


async def _synthesize(text: str, voice: str, speed: float) -> str:
    key = _tts_key(text, voice, speed)
    if key in _tts_cache:
        return key
    from emergentintegrations.llm.openai import OpenAITextToSpeech
    tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
    clean = oracle.clean_for_tts(text)[:4000]
    audio = await tts.generate_speech(text=clean, model="tts-1", voice=voice,
                                      speed=float(speed), response_format="mp3")
    _tts_cache[key] = audio
    if len(_tts_cache) > 200:
        for k in list(_tts_cache.keys())[:50]:
            _tts_cache.pop(k, None)
    return key


async def _transcribe(path: str, lang: str) -> str:
    from emergentintegrations.llm.openai import OpenAISpeechToText
    stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
    kwargs: dict = {"model": "whisper-1", "response_format": "json"}
    if lang == "en":
        kwargs["language"] = "en"
    elif lang == "hi":
        kwargs["language"] = "hi"
    resp = await stt.transcribe(file=Path(path), **kwargs)
    if isinstance(resp, str):
        return resp.strip()
    return (getattr(resp, "text", None) or str(resp)).strip()


# ---------------------------------------------------------------- auth routes
@api.get("/")
async def root():
    return {"message": "VELORA oracle online"}


@api.post("/auth/register")
async def register(body: RegisterBody):
    email = str(body.email).lower()
    if email == OWNER_EMAIL:
        raise HTTPException(409, "This email is reserved.")
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "An account with this email already exists.")
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
    await db.users.insert_one(user)
    return {"token": make_token(user), "user": public_user(user)}


@api.post("/auth/login")
async def login(body: LoginBody):
    email = str(body.email).lower()
    user = await db.users.find_one({"email": email})
    dummy = "$2b$12$" + "x" * 53
    ok = verify_pw(body.password, user["password_hash"] if user else dummy)
    if not user or not ok:
        raise HTTPException(401, "Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(403, "Your account has been deactivated. Contact the keeper.")
    return {"token": make_token(user), "user": public_user(user)}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotBody):
    email = str(body.email).lower()
    user = await db.users.find_one({"email": email})
    if user and user["role"] == "customer":
        await db.reset_requests.update_one(
            {"email": email},
            {"$set": {"email": email, "name": user.get("name", ""), "user_id": user["id"],
                      "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    return {"ok": True, "message": "If an account exists, the keeper has been notified to restore your access."}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api.patch("/me")
async def update_me(body: ProfileBody, user: dict = Depends(get_current_user)):
    updates = {}
    if body.name is not None and body.name.strip():
        updates["name"] = body.name.strip()
    if body.language is not None:
        updates["language"] = body.language
    if body.voice is not None:
        updates["voice"] = body.voice
    if body.speed is not None:
        updates["speed"] = max(0.5, min(2.0, float(body.speed)))
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
        user = await db.users.find_one({"id": user["id"]})
    return public_user(user)


# ---------------------------------------------------------------- oracle
@api.post("/oracle/transcribe")
async def transcribe(file: UploadFile = File(...), lang: str = Form("en"), user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Voice input is unavailable.")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty recording.")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "Recording too long.")
    suffix = Path(file.filename or "q.m4a").suffix.lower()
    if suffix not in {".m4a", ".mp4", ".mp3", ".wav", ".webm", ".mpeg", ".mpga"}:
        suffix = ".m4a"
    fd, tmp = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        with open(tmp, "wb") as f:
            f.write(data)
        text = await _transcribe(tmp, lang)
    except Exception:
        logger.exception("Transcription failed")
        raise HTTPException(502, "Could not hear you clearly. Try again.")
    finally:
        try:
            Path(tmp).unlink(missing_ok=True)
        except Exception:
            pass
    return {"text": text}


@api.post("/oracle/consult")
async def consult(body: ConsultBody, user: dict = Depends(get_current_user)):
    question = (body.question or "").strip()[:800]
    if not question:
        raise HTTPException(400, "Please share your question.")
    topics = oracle.detect_topics(question)
    # merge owner-added answers for the detected topics + language
    extra_by_topic: dict[str, list[str]] = {}
    cursor = db.knowledge_entries.find({"lang": body.lang, "topic": {"$in": topics}, "deleted_at": None})
    async for e in cursor:
        extra_by_topic.setdefault(e["topic"], []).append(e["text"])
    result = oracle.compose_answer(question, body.lang, extra_by_topic)
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


@api.post("/oracle/speak")
async def speak(body: SpeakBody, user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Voice is unavailable.")
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Nothing to speak.")
    settings = await db.settings.find_one({"_id": "app"}) or DEFAULT_SETTINGS
    voice = user.get("voice") or settings.get("voice", "shimmer")
    speed = float(user.get("speed") or settings.get("speed", 0.95))
    try:
        key = await _synthesize(text, voice, speed)
    except Exception:
        logger.exception("TTS failed")
        raise HTTPException(502, "The occult voice faltered. Try again.")
    return {"url": f"/api/tts/{key}.mp3"}


@api.get("/tts/{key}.mp3")
async def get_tts(key: str):
    audio = _tts_cache.get(key)
    if audio is None:
        raise HTTPException(404, "Audio expired. Replay to regenerate.")
    return Response(content=audio, media_type="audio/mpeg",
                    headers={"Cache-Control": "public, max-age=31536000"})


# ---------------------------------------------------------------- image (illustration)
_img_cache: dict[str, bytes] = {}


def _img_key(text: str) -> str:
    return hashlib.sha256(f"img|{text}".encode("utf-8")).hexdigest()


async def _illustrate(text: str) -> str:
    import base64 as _b64
    key = _img_key(text)
    if key in _img_cache:
        return key
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = (
        "Create a single luxurious, symbolic mystical illustration that captures the whole meaning of this "
        "oracle reading so a person can grasp it at a glance. Absolutely no text, letters, or words in the image. "
        "Style: ethereal and painterly, deep midnight indigo and obsidian with regal gold and soft crystal-pink "
        "luminescence, occult and aura motifs (moon phases, constellations, sacred geometry, crystals, gentle "
        "energy light), elegant and high detail, serene and premium. The reading: " + text[:600]
    )
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=uuid.uuid4().hex,
                system_message="You are a master mystical illustrator.")
        .with_model("gemini", "gemini-3.1-flash-image-preview")
        .with_params(modalities=["image", "text"])
    )
    _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    if not images:
        raise RuntimeError("no image")
    data = _b64.b64decode(images[0]["data"])
    _img_cache[key] = data
    if len(_img_cache) > 120:
        for k in list(_img_cache.keys())[:40]:
            _img_cache.pop(k, None)
    return key


@api.post("/oracle/illustrate")
async def illustrate(body: SpeakBody, user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Imagery is unavailable.")
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Nothing to illustrate.")
    try:
        key = await _illustrate(text)
    except Exception:
        logger.exception("Illustration failed")
        raise HTTPException(502, "The vision would not form. Try again.")
    return {"url": f"/api/img/{key}.png"}


@api.get("/img/{key}.png")
async def get_img(key: str):
    data = _img_cache.get(key)
    if data is None:
        raise HTTPException(404, "Image expired.")
    return Response(content=data, media_type="image/png",
                    headers={"Cache-Control": "public, max-age=31536000"})


@api.get("/readings")
async def my_readings(user: dict = Depends(get_current_user)):
    rows = await db.readings.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    for r in rows:
        r.pop("_id", None)
    return rows


# ---------------------------------------------------------------- settings (branding)
@api.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"_id": "app"}) or DEFAULT_SETTINGS
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
async def upload_branding(kind: str = Form(...), file: UploadFile = File(...), owner: dict = Depends(require_owner)):
    if kind not in ("logo", "background"):
        raise HTTPException(400, "Invalid upload kind")
    ct = (file.content_type or "").lower()
    allowed = {"image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg"}
    if ct not in allowed:
        raise HTTPException(400, "Only PNG and JPG/JPEG images are accepted.")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 8MB.")
    ext = allowed[ct]
    path = f"{APP_SLUG}/branding/{kind}-{uuid.uuid4().hex}.{ext}"
    try:
        await run_in_threadpool(_put_object, path, data, ct)
    except Exception:
        logger.exception("Upload failed")
        raise HTTPException(502, "Upload failed. Try again.")
    field = "logo_url" if kind == "logo" else "background_url"
    url = f"/api/media?path={path}"
    await db.settings.update_one({"_id": "app"},
                                 {"$set": {field: url, "updated_at": datetime.now(timezone.utc).isoformat()}},
                                 upsert=True)
    return {"url": url}


@api.get("/media")
async def get_media(path: str):
    if not path.startswith(f"{APP_SLUG}/"):
        raise HTTPException(400, "Bad path")
    try:
        data, ct = await run_in_threadpool(_get_object, path)
    except Exception:
        raise HTTPException(404, "Not found")
    return Response(content=data, media_type=ct, headers={"Cache-Control": "public, max-age=86400"})


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
async def upload_knowledge(file: UploadFile = File(...), owner: dict = Depends(require_owner)):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file.")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "File must be under 25MB.")
    name = file.filename or "knowledge.bin"
    ext = (name.rsplit(".", 1)[-1] if "." in name else "bin").lower()
    ct = file.content_type or "application/octet-stream"
    path = f"{APP_SLUG}/knowledge/{uuid.uuid4().hex}.{ext}"
    try:
        await run_in_threadpool(_put_object, path, data, ct)
    except Exception:
        logger.exception("KB upload failed")
        raise HTTPException(502, "Upload failed. Try again.")
    ingested = 0
    if ext == "json":
        try:
            import json as _json
            parsed = _json.loads(data.decode("utf-8"))
            now = datetime.now(timezone.utc).isoformat()
            bulk = []
            for topic, langs in parsed.items():
                if topic not in oracle.PACK or not isinstance(langs, dict):
                    continue
                for lg, arr in langs.items():
                    if lg not in ("en", "hi", "hng") or not isinstance(arr, list):
                        continue
                    for txt in arr:
                        if isinstance(txt, str) and len(txt.strip()) >= 8:
                            bulk.append({"id": str(uuid.uuid4()), "topic": topic, "lang": lg,
                                         "text": txt.strip(), "deleted_at": None, "created_at": now})
            if bulk:
                await db.knowledge_entries.insert_many(bulk)
                ingested = len(bulk)
        except Exception:
            logger.warning("KB json ingest skipped (not the expected schema)")
    rec = {
        "id": str(uuid.uuid4()),
        "name": name,
        "path": path,
        "content_type": ct,
        "size": len(data),
        "ingested": ingested,
        "deleted_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.kb_files.insert_one(dict(rec))
    rec.pop("_id", None)
    return rec


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
