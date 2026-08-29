# VELORA — Product Requirements & Build Log

## Original Problem Statement
Premium mobile-first remake of an occult voice oracle (velora-occult-voice.base44.app). Audio-first single primary interaction. Keep the complete knowledge base securely in the backend; every audio answer generated strictly from the stored knowledge pack; never expose the KB to customers. Exactly two roles (one Owner, Customers). Owner controls branding, customers, knowledge/audio settings, translations. Full EN/Hindi/Hinglish translation. Only screens: Home, Owner Dashboard, Customer Dashboard, Account/Profile, Login/Forgot-Password.

## Architecture
- **Frontend**: Expo SDK 54 + expo-router. Fonts: Cormorant Garamond (display) + Satoshi (body). Theme: Glass/Luxe Dark (midnight #050508, gold #D4AF37, crystal-pink #D28CA7). Audio via expo-audio (module-level player). Keyboard via react-native-keyboard-controller. Reanimated voice orb.
- **Backend**: FastAPI + MongoDB (motor). JWT auth (bcrypt, token_version revocation). Oracle engine (`oracle.py`) = topic detection + openings + `knowledge/oracle-pack.json` (153 pre-written answers × EN/HI/HNG). OpenAI TTS (tts-1) via emergentintegrations, cached, served at `/api/tts/{key}.mp3`. Emergent Object Storage for owner branding uploads. Knowledge PDF + oracle-pack stored server-side only.

## Roles & Accounts
- Owner (single, env-seeded, idempotent): riaahuja2000@gmail.com / rioelixir
- Customer (seeded): taromaya@gmail.com / 123456789
- Self-registration creates customers. Owner email reserved.

## User Personas
- Seeker (customer): asks one question, hears spoken guidance, keeps a private journal.
- Keeper (owner): controls branding, voice, members, and views analytics.

## Implemented (2026-06 build 2)
- **Voice input (mic-first)**: Home orb is now tap-to-speak. Tap → record (expo-audio) → tap again → OpenAI Whisper transcribes (EN/HI/auto) → knowledge-base answer → OpenAI TTS spoken. No typing.
- **No generic answers**: engine restricted to occult sciences (A-Z), aura, and mindfulness. Any unmatched/off-topic question is grounded in the aura + mindfulness pool; the generic "general" pack is never surfaced. Added a mindfulness knowledge set (EN/HI/HNG) + keyword detection.
- **Removed the journal/diary**: customer tabs are now Oracle + Account only. Readings still persist server-side for owner analytics but there is no customer diary.

## Implemented (2026-06 build 1)
- Auth: login / register / forgot-password (owner-fulfilled reset requests) / JWT / RBAC.
- Home Oracle: type question → consult → KB answer → OpenAI TTS spoken → glass answer sheet (topics, transcript, replay, ask again).
- Customer Journal: session history with per-reading audio replay.
- Account: display name, instant EN/HI/Hinglish switch (persisted + saved to profile), role badge, sign out.
- Owner Console: metrics (sessions/users/today/topics), 7-day chart, most-asked, member management (activate/deactivate + password reset modal + reset requests), branding (app name/tagline/subtitle, logo + background upload PNG/JPG), voice + speed, save & publish.
- Full app-wide i18n; branding changes reflect app-wide via public /api/settings.
- Brand assets: gold VELORA logo → app icon/splash/auth hero; pink crystal collage → hero backdrop.
- Testing: 23/23 backend pytest green; frontend flows verified.

## Implemented (2026-06 build 3 — "Living Oracle OS")
- **Oracle Brain backend** (`backend/oracle_brain.py` + rewritten `/api/voice/consult`):
  invisible engine router (tarot/astrology/numerology/aura/mindfulness/dream/ritual/crystals/palmistry/runes/iching/kabbalah/fengshui/general),
  Context DNA memory (db.voice_turns, last 12 turns fed to Claude), one-breath clarification (MODE clarify, never twice in a row),
  Oracle Council mode, tradition lock, reality mirror, uncertainty honesty, compassionate contradiction (repeated-question jaccard detection),
  safety boundaries. Structured output: ENGINE/MODE/SPEAK parsed server-side.
- **Spoken commands** (deterministic, multilingual EN/HI/HNG): "calm me now" (instant 30s rescue script, no LLM),
  "save this moment" (db.voice_bookmarks), "play my guidance [about X]", "where did this answer come from" (source trail),
  "challenge this answer", "forget this conversation" (clears voice_turns), "delete my voice history" (wipes readings+turns+bookmarks),
  "don't remember personal details" (users.memory_opt_out).
- **`POST /api/voice/refine`** {direction: deeper|shorter|practical|alternative|challenge|source} — refines last substantive reading.
- **Gesture orb** (home.tsx): hold = push-to-talk · tap = pause/continue (barge-in; Android falls back to stop) ·
  double-tap = replay · swipe ↑ deeper / ↓ shorter / → practical / ← alternative · two-finger tap = whisper mode (soft rate/pitch/volume, moon icon).
- **Accessibility captions** (eye icon, persisted in AsyncStorage, default OFF = voice-only) + first-launch spoken AI disclosure.
- **Owner Voice Oracle Log** (`GET /api/owner/voice-log` + owner.tsx section): transcripts w/ engine+mode badges, engine distribution,
  failed/unclear question log (db.failed_questions), saved-moments count.
- speech.ts: pauseSpeak/resumeSpeak (iOS/web) + whisper option.

## Backlog / Next
- P1: Owner in-console live preview of branding before publish.
- P2: Journal search/filter by topic; export a reading.
- P2: Richer waveform tied to real audio amplitude.
- Cleanup: benign `pointerEvents deprecated` web warning.

## Notes
- Audio is a spoken answer; playback in background/lock-screen requires a native build (not Expo Go).
- Preview DB migrates to production on first deploy; branding uploads persist via object storage.
