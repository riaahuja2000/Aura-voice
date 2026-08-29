# AURA-VOICE — Vercel Deployment Guide

This project is configured for a single-origin Vercel deployment where the
Expo web build is served as static files and the FastAPI backend runs as a
Python serverless function at `/api/*`.

## Prerequisites

1. A **MongoDB Atlas** cluster (free tier is fine). Serverless MongoDB is
   friendlier to Vercel's cold-start model than a self-hosted mongod.
2. Your **Emergent Universal LLM key** (Profile → Manage plan → Universal Key).
3. A GitHub repository connected to your Emergent workspace.

## One-time setup

1. In your Emergent chat, click the **"Save to GitHub"** button at the bottom
   of the chat input to push this code to your repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Vercel will auto-detect `vercel.json`. Leave build / output settings on the
   defaults from `vercel.json`.
4. Under **Environment Variables**, add every variable from `.env.example` that
   does not have a value. In particular:
   - `MONGO_URL` — your Atlas connection string
   - `DB_NAME` — e.g. `aura_voice`
   - `JWT_SECRET` — a long random string
   - `EMERGENT_LLM_KEY` — your universal key
   - `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`
   - `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD`, `SEED_CUSTOMER_NAME`
   - **Leave `EXPO_PUBLIC_BACKEND_URL` empty** — the frontend will call the
     same origin at `/api` and Vercel will route to the Python function.
5. Click **Deploy**.

## What gets deployed

| Route                    | Handler                                       |
| ------------------------ | --------------------------------------------- |
| `/api/*`                 | `api/index.py` → wraps `backend/server.py`   |
| `/*.{js,css,png,…}`     | Static files from `frontend/dist`             |
| everything else (`/*`)   | `frontend/dist/index.html` (SPA fallback)     |

## Local production build

```bash
cd frontend
yarn install
npx expo export --platform web --output-dir dist
```

The built site lands in `frontend/dist`.

## Important limitations to know

1. **Voice input on the web** uses the browser's Web Speech API. It works on
   Chrome / Edge / Safari with microphone permission; some browsers (older
   Firefox) do not support it.
2. **MongoDB pooling on serverless**: motor opens a new connection per cold
   start. If your traffic is high enough that this becomes a problem, upgrade
   to Atlas Serverless or use a proxy like `mongodb.com/serverless`.
3. **File uploads (owner branding)** work but stay under Vercel's 4.5MB
   request-body limit for serverless functions.
4. For iOS/Android native apps, do NOT use this deployment — use Expo EAS or
   the Emergent Publish flow for store builds.

## Rolling back

Use Vercel's built-in deploy history to revert to any previous deployment.
