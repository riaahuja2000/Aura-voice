# VELORA — Occult Voice App

A premium, voice-first occult app. Ask a question by voice or text and receive a short,
easy-to-understand answer drawn from a private knowledge base (occult sciences A–Z, aura,
and mindfulness), spoken aloud. Includes a numerology engine and a full 78-card tarot engine.

- **Frontend:** Expo (React Native) + expo-router
- **Backend:** FastAPI + MongoDB (motor)
- **Zero paid AI at runtime:** speech-to-text and text-to-speech run **on the device** (free).
  Answers come from a local knowledge engine. No OpenAI/Gemini calls.
- **Optional:** object storage is used only for owner-uploaded logo/background/knowledge files.
  Without it, those uploads are disabled and everything else works.

---

## 1. Backend (FastAPI + MongoDB)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then edit values
uvicorn server:app --host 0.0.0.0 --port 8001
```

### Backend environment variables (`backend/.env`)
| Variable | Required | Notes |
|---|---|---|
| `MONGO_URL` | yes | e.g. a free MongoDB Atlas connection string |
| `DB_NAME` | yes | any database name, e.g. `velora` |
| `JWT_SECRET` | yes | a long random string (used to sign login tokens) |
| `OWNER_EMAIL` | yes | the single owner account email |
| `OWNER_PASSWORD` | yes | owner initial password (change after first login) |
| `OWNER_NAME` | yes | owner display name |
| `SEED_CUSTOMER_EMAIL` | optional | seeds one demo customer |
| `SEED_CUSTOMER_PASSWORD` | optional | demo customer password |
| `SEED_CUSTOMER_NAME` | optional | demo customer name |
| `EMERGENT_LLM_KEY` | optional | **only** enables owner image/file uploads via object storage; leave unset to disable uploads |
| `INTEGRATION_PROXY_URL` | optional | object-storage base (defaults to Emergent's) |

All API routes are served under `/api`. The server must bind to `0.0.0.0:8001`.

> **Uploads without object storage:** if `EMERGENT_LLM_KEY` is not set, the owner can still
> edit all branding text and add knowledge answers manually; only image/file **uploads**
> return a friendly "not configured" message. To enable uploads off-Emergent, wire your own
> storage (e.g. S3) in `_put_object` / `_get_object` in `backend/server.py`.

---

## 2. Frontend (Expo)

```bash
cd frontend
yarn install
cp .env.example .env        # set EXPO_PUBLIC_BACKEND_URL to your backend URL
npx expo start
```

### Frontend environment variables (`frontend/.env`)
| Variable | Required | Notes |
|---|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | yes | Public base URL of your backend (no trailing `/api`) |

### On-device voice
- **Text-to-speech** uses `expo-speech` (works in Expo Go and builds).
- **Speech-to-text** uses `expo-speech-recognition`, a native module that works in a
  **development or production build** (not in Expo Go / web). Users can always type instead.

### Building the mobile app
Use your own free Expo account:
```bash
npm i -g eas-cli
eas login
eas build -p android    # or: eas build -p ios  (needs an Apple Developer account)
```

---

## 3. Seeded accounts (first run)
- **Owner:** `OWNER_EMAIL` / `OWNER_PASSWORD`
- **Customer (optional):** `SEED_CUSTOMER_EMAIL` / `SEED_CUSTOMER_PASSWORD`

Change these in your `.env` before deploying to production.

## 4. What runs with no external services
Auth (JWT + bcrypt), the knowledge/answer engine, numerology, tarot, readings history,
language switching (EN/Hindi/Hinglish), and on-device voice — all work with just MongoDB.
