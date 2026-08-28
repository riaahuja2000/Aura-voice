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

## Implemented (2026-06 build 1)
- Auth: login / register / forgot-password (owner-fulfilled reset requests) / JWT / RBAC.
- Home Oracle: type question → consult → KB answer → OpenAI TTS spoken → glass answer sheet (topics, transcript, replay, ask again).
- Customer Journal: session history with per-reading audio replay.
- Account: display name, instant EN/HI/Hinglish switch (persisted + saved to profile), role badge, sign out.
- Owner Console: metrics (sessions/users/today/topics), 7-day chart, most-asked, member management (activate/deactivate + password reset modal + reset requests), branding (app name/tagline/subtitle, logo + background upload PNG/JPG), voice + speed, save & publish.
- Full app-wide i18n; branding changes reflect app-wide via public /api/settings.
- Brand assets: gold VELORA logo → app icon/splash/auth hero; pink crystal collage → hero backdrop.
- Testing: 23/23 backend pytest green; frontend flows verified.

## Backlog / Next
- P1: Owner in-console live preview of branding before publish.
- P2: Journal search/filter by topic; export a reading.
- P2: Richer waveform tied to real audio amplitude.
- Cleanup: benign `pointerEvents deprecated` web warning.

## Notes
- Audio is a spoken answer; playback in background/lock-screen requires a native build (not Expo Go).
- Preview DB migrates to production on first deploy; branding uploads persist via object storage.
