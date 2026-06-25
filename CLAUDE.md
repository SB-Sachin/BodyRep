# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

BodyRep is a single-user, offline-first PWA bodyweight strength trainer (React 18 + Vite). All data lives on-device in IndexedDB — there is no backend. The domain model and rules come from two source documents the app was built from: `bodyrep-prd-v1.2.md` (PRD) and `workout-research.md`. When changing progression thresholds, exercise data, or program structures, treat those documents as the source of truth.

## Commands

```bash
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

There is no test runner, linter, or typecheck configured — `package.json` only has the three Vite scripts above. Don't claim tests pass; there are none.

## Git & deployment workflow

This repo auto-deploys to Vercel on every push to `main`. After making code changes, **always commit and push to `main`** so the change deploys automatically — do not branch for this. Run `npm run build` first to confirm the build is green before pushing (a broken build = a broken deploy).

## AI configuration

AI coaching is optional; the app is fully functional without it. To enable, set `VITE_GEMINI_API_KEY` in `.env`. Optional `VITE_GEMINI_MODEL` overrides the default `gemini-2.5-flash`. Calls are capped at `AI_DAILY_CAP` (50) per day client-side (enforced in the store, not the AI module) to stay in the free tier.

`VITE_` vars are baked in at **build time**, not read at runtime — changing a Gemini env var on Vercel requires a redeploy to take effect.

Two model gotchas baked into `gemini.js`: (1) the model name must be a currently-served one (`gemini-1.5-flash` was retired and 404s — verify with the ListModels endpoint when in doubt); (2) `gemini-2.5-flash` is a thinking model, so `thinkingConfig.thinkingBudget` is set to `0` — otherwise hidden reasoning consumes the entire `maxOutputTokens` budget and the visible reply comes back truncated/empty.

## Architecture

The app is a layered, mostly-pure domain core wrapped by a Zustand store and React screens. Understanding the data flow between these four layers is the key to working here:

**`src/data/`** — Static configuration, no logic. `exercises.js` is the exercise database (each entry has `category`, `pattern`, `difficulty`, `equipment`, `repRange`/`timeBased`, and `easier`/`harder` links forming the progression chain). `skillTrees.js` groups exercises into 4 trees × 5 levels and defines `ADVANCEMENT` thresholds + `CONSECUTIVE_SESSIONS`. `programs.js` defines weekly schedules (A/B/C by days-per-week) and `DAY_TYPE_TREES` (which trees each day type pulls from). `gamification.js` holds XP/badge/tier config.

**`src/engine/`** — Pure functions over a `progress` object; no React, no persistence. This is where the real logic lives:
- `progression.js` — the `progress` shape (`trees[key]={level,activeId}`, `exercises[id]={unlocked,consecutiveHits,bestReps,...}`), baseline placement at onboarding (`initialProgress`), advancement (`applyExerciseResult` — only the tree's **active** exercise advances, and only after meeting threshold on 2 consecutive sessions), and skill `applyDecay` (missing 2+ days drops each tree level by 1). Functions return new objects via `structuredClone`.
- `workoutEngine.js` — `generateSession` builds a session from current progress + selected equipment + day type + goal. Equipment substitution happens here: if the active exercise isn't doable with today's equipment, it swaps in the hardest available unlocked variation.

**`src/store/useStore.js`** — The single Zustand store and the only stateful layer. It orchestrates the engine, owns XP/streak/badge logic, and persists. Key points:
- The entire app state is one serializable object persisted as a single IndexedDB record (debounced via `scheduleSave`, 250ms). `hydrated` is the only non-persisted field.
- `hydrate()` runs `_maintenance()`: weekly XP/rep reset, skill decay for missed days, and daily AI-counter reset. This is where time-based rules fire — not on a timer.
- `finishSession()` is the main write path: applies each exercise result through the engine, computes XP, appends history, checks badges, returns a summary for the Complete screen.
- Streak logic (`computeStreak`) counts planned rest days as non-breaking.

**`src/db/db.js`** — `idb` wrapper. Two object stores: `state` (single record, key `app`) and `sessions` (per-session records, also kept discretely so they survive and power JSON export/import). `exportData`/`importData` are the user's only backup mechanism.

**`src/ai/gemini.js`** — Stateless Gemini client. Builds an athlete-context block from store state and exposes 5 use cases (coaching notes, form advice, weekly summary, ask, workout variation). Rate limiting/caching is the store's job, not this module's. **All AI output is framed for muscle gain + caloric surplus — never fat loss/cutting/deficits** (a hard PRD constraint baked into `SYSTEM_BASE`).

**`src/screens/` + `src/App.jsx`** — `App.jsx` gates on `hydrated` then `onboarded`; unboarded users see `Onboarding`, otherwise react-router routes to Home/Session/Progress/SkillTree/Coach/Settings with a persistent `BottomNav`.

## Design system

Athletic/gamified dark theme. Tokens live in `tailwind.config.js`: brand color is `accent` (energetic orange `#f97316`) — use it for CTAs/active states, never a raw hex. The four skill trees keep their own semantic colors (`push`/`pull`/`legs`/`core`) defined both in the Tailwind palette and in `skillTrees.js`; don't repaint those with the brand color. Headings use Barlow Condensed (`font-display`, applied to `h1/h2/h3` in `index.css` base), body uses Barlow. Reusable component classes (`.btn`/`.btn-accent`/`.btn-ghost`/`.btn-danger`, `.card`, `.input`, `.choice`, `.seg`, `.pill`) are defined in `src/index.css` — prefer them over ad-hoc utility soup. **Never use emoji as structural/UI icons** — use `src/components/Icon.jsx` (inline SVG, stroke-based, `currentColor`). Emoji that come from data (badge/equipment `icon` fields) are content and stay for now. `index.css` honors `prefers-reduced-motion`; keep transitions 150–300ms.

## Conventions

- Keep engine/progression functions pure and immutable (clone, don't mutate); the store is the only place that calls `set` and persists.
- Time-based exercises (planks, holds, etc.) use `timeBased.seconds` and are gated on seconds, not reps, throughout the engine and advancement logic. Per-side exercises set `perSide`.
- Day indexing is 0=Monday..6=Sunday internally; convert from JS `getDay()` (0=Sun) with `(jsDay + 6) % 7`.
- PWA: `vite-plugin-pwa` with `autoUpdate`. Gemini requests are forced `NetworkOnly` in the service worker so AI calls never hit the offline cache.
