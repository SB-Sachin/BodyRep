# BodyRep

A personal, gamified bodyweight strength trainer built as an installable PWA. Adaptive workouts, four skill trees (Push / Pull / Legs / Core), Duolingo-style progression, offline support, and optional AI coaching. Built from `bodyrep-prd-v1.2.md` and `workout-research.md`.

## Tech stack

- React 18 + Vite
- Tailwind CSS
- Zustand (state) + IndexedDB via `idb` (offline storage)
- Recharts (progress charts)
- `vite-plugin-pwa` (service worker, manifest, offline)
- Google Gemini (free tier) for AI coaching

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Enabling AI coaching (optional)

The app works fully without AI — coaching notes, the chat coach, and weekly summaries are the only features that need it.

1. Get a **free** Google Gemini API key: https://aistudio.google.com/app/apikey
2. Copy `.env.example` to `.env` and paste your key:
   ```
   VITE_GEMINI_API_KEY=your_key_here
   ```
3. Restart `npm run dev` (or rebuild). Settings → AI will show **Connected**.

AI calls are capped at **5/day** client-side to stay within the free tier, and weekly summaries are cached. All AI guidance is framed around muscle gain and a caloric surplus — never fat loss.

## Deploy (free)

Either host works on the free tier. Build command `npm run build`, output dir `dist`.

- **Vercel:** import the repo → framework preset **Vite** → add `VITE_GEMINI_API_KEY` under Environment Variables → deploy.
- **Netlify:** new site from repo → build command `npm run build`, publish dir `dist` → add the env var under Site settings → Environment.

## Install on iPhone (no App Store / Developer account)

1. Open the deployed URL in **Safari**.
2. Tap the **Share** button → **Add to Home Screen**.
3. Launch from the home-screen icon for full-screen, app-like, offline use.

## How it works

- **Onboarding** collects age, body stats, equipment, training days, and a quick push-up / pull-up baseline that places you at the correct skill-tree level.
- **Workout engine** (`src/engine/workoutEngine.js`) generates each session from your current skill levels, the day's focus, your goal (hypertrophy/strength), session length, and the equipment you select that day — auto-substituting exercises when equipment changes.
- **Progression** (`src/engine/progression.js`) advances you to a harder variation after you hit the rep/time threshold on **2 consecutive sessions**, and applies skill decay if you miss 2+ days.
- **Data** lives only on your device (IndexedDB). Use **Settings → Export JSON** to back it up.

## Project structure

```
src/
  data/        exercises, skill trees, programs, gamification config
  engine/      workout generation + progression rules
  store/       Zustand store, persistence, streak/XP/badge logic
  db/          IndexedDB wrapper + JSON export/import
  ai/          Gemini client (context building, 5 use cases)
  screens/     Onboarding, Home, Session, Complete, SkillTree, Progress, Chat, Settings
  components/  BottomNav, ExerciseDemo
```

## Notes & limits (V1)

- No backend — single device. Cloud sync (Supabase) is a V2 candidate.
- Workouts run fully offline; AI features need a connection.
- The exercise database is bodyweight-focused. Heavy advanced leg training has a natural bodyweight ceiling (flagged in the research); dumbbell/gym expansion is a V2 candidate.
- Out of scope for V1 (per PRD): social features, video demos, nutrition tracking, Apple Health integration.
