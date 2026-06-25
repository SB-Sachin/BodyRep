# Form Instruction Videos — Design

**Date:** 2026-06-25
**Status:** Approved (pending spec review)
**Independent of:** the cloud-persistence + Web Push backend spec (no shared code).

## Context

Each exercise currently has text `formCues` + `mistakes` and an animated SVG
(`ExerciseDemo`), but no real demonstration of the movement. Users want short
form-instruction videos per exercise, shown during a workout and when browsing
exercises. BodyRep is an offline-first PWA with ~44 exercises.

## Decision summary

- **Source:** one curated YouTube video ID per exercise (optional field).
- **Player:** lightweight inline facade — thumbnail + play button; the real
  YouTube iframe loads only on tap (no heavy embed until requested).
- **Placement:** Session exercise card (near Form Cues) **and** the Skill Tree
  `DetailSheet`.
- **No video ID yet → graceful fallback:** a "Watch form demo" button that opens a
  YouTube search for the exercise name. Ships immediately; IDs filled incrementally.
- **No new dependencies, no hosting, no app-size bloat.**

## Non-goals

- Self-hosting or bundling video files.
- Offline video playback (YouTube needs network; degrade gracefully).
- Auto-populating IDs by guessing (wrong IDs embed broken content).

## Components

### Data — `src/data/exercises.js`

Add an **optional** `videoId` (YouTube 11-char ID string) to exercise entries.
Absent on most entries initially; the user fills them in over time. No other
schema change. Optionally a `videoStart` (seconds) later, but out of scope now.

### New component — `src/components/FormVideo.jsx`

Props: `{ exercise }` (uses `exercise.videoId` and `exercise.name`).

Behavior:
- **Has `videoId`:** render a 16:9 facade — background thumbnail
  `https://i.ytimg.com/vi/<id>/hqdefault.jpg` + centered accent play button +
  "Form demo" label. On click, swap the facade for an `<iframe>` pointing at
  `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&rel=0&playsinline=1`.
  `loading="lazy"`, `allow="autoplay; encrypted-media; picture-in-picture"`,
  `allowfullscreen`. State: `playing` (bool), reset when `exercise` changes.
- **No `videoId`:** render a compact `.btn-ghost` "Watch form demo" with a video
  icon that opens
  `https://www.youtube.com/results?search_query=<encoded name + " form">` in a new
  tab (`target="_blank" rel="noopener"`).
- **Styling:** matches the design system (`.card`-adjacent, rounded, accent play
  button, `currentColor` SVG via `Icon`; add a `video`/`play` icon to `Icon.jsx` if
  not present). Honors reduced-motion (no special animation needed).

The facade pattern means: no YouTube network request until the thumbnail
(lightweight) and only a full iframe on explicit tap — fast and battery-friendly.

### Integration points

- **`src/screens/Session.jsx`** (`Player`): render `<FormVideo exercise={meta} />`
  within the non-resting exercise view, near the existing `<FormCues>` block. Keep
  it compact so it doesn't push the rep/hold controls off-screen (e.g. placed with
  the Form Cues card or directly above it).
- **`src/screens/SkillTreeScreen.jsx`** (`DetailSheet`): render
  `<FormVideo exercise={ex} />` alongside the form cues in the bottom sheet.
- **`src/components/Icon.jsx`**: add a `play` (and/or reuse `camera`/add `video`)
  stroke icon if a suitable one isn't already present.

## Data flow

Static only: `getExercise(id).videoId` → `FormVideo` decides facade vs fallback.
No store, network-fetch, or backend involvement.

## Error handling / edge cases

- **Offline:** thumbnail image fails to load → CSS background simply shows the dark
  card with the play button (acceptable); tapping a search-fallback link won't
  resolve offline, which is expected. No crash, no error state needed.
- **Bad/removed video ID:** the YouTube iframe shows YouTube's own "unavailable"
  message — surfaced naturally; the user can fix the ID. (No validation layer.)
- **Reduced data use:** facade avoids loading the player for every exercise.

## Testing / verification

- `npm run build` green.
- In preview: temporarily set a known `videoId` on one exercise →
  - Session card shows the thumbnail facade; tapping loads the inline player.
  - Skill Tree `DetailSheet` shows the same.
  - An exercise without a `videoId` shows the "Watch form demo" search button that
    opens the correct YouTube search.
- Confirm the facade doesn't load any YouTube iframe until tapped (network panel).

## Rollout

Ship with `videoId` unset on all exercises (everything shows the search fallback),
then populate IDs incrementally — no redeploy gating, no env, no new deps.
