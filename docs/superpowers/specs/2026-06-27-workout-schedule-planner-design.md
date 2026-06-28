# Workout Schedule Planner — Design

**Date:** 2026-06-27
**Status:** Approved, ready for implementation plan

## Problem

BodyRep's schedule is a **fixed weekly calendar**: each program pins workouts to
specific weekdays (`programs.js` `schedule[]`), and `sessionForToday()` answers
"what workout is pinned to today's weekday." There is no concept of a forward
plan, and missing a day silently drops that workout.

The user wants a **rolling, forward-looking schedule**: a list of upcoming
workouts with per-day details (type, sets, reps, rest), and — critically — when
a scheduled workout is missed, every later workout shifts forward by a day
("pushed back"), with the adjustment shown explicitly.

## Decisions (locked)

1. **Scheduling model:** rolling queue (shift back), not a fixed weekday calendar.
2. **Scope:** the rolling queue is the **single source of truth** for "today's
   workout" across the whole app (Home, Session, and the new Planner all read it).
3. **Detail level:** per-day summary (type, sets, rep band, rest). No per-exercise
   detail for future days — exact exercises depend on live progress and would be
   speculative.
4. **Placement:** Home keeps today's card + gains an "Up next" strip; a dedicated
   `/plan` screen holds the full forward list. No 6th bottom-nav tab.
5. **Streak handling:** `computeStreak` updated so a day counts as non-breaking
   when the queue's slot for that date was a **rest slot** (consistent with the
   queue driving everything).

## Core concept: cycle + single anchor

Each program is converted to an ordered **7-slot cycle** in weekday order
(0=Mon..6=Sun), derived from existing `programs.js` data — a workout slot where a
session entry exists for that weekday, a rest slot in the gaps. This preserves
each program's work:rest rhythm:

- **Program A** (3-day full body) → `[FB-A, rest, FB-B, rest, FB-C, rest, rest]`
- **Program B** (4-day upper/lower) → `[Upper, Lower, rest, Upper, Lower, rest, rest]`
- **Program C** (6-day PPL) → `[Push, Pull, Legs, Push, Pull, Legs, rest]`

The queue is **derived, not a stored moving pointer.** We persist exactly one new
field, `scheduleAnchorDate` — the calendar date that maps to cycle index 0. The
current position is computed live by walking from the anchor to today.

## The shift-back rule (simulation)

Walking from `scheduleAnchorDate` up to (but not including) today, maintaining an
`index` into the cycle, for each past day:

- **rest slot** → always advance `index` (a rest day cannot be "missed").
- **workout slot, completed** (a `history` record exists for that date) →
  advance `index`.
- **workout slot, not completed** → `index` **stays** → that workout rolls into
  today, and everything after shifts forward by a day.

Today's slot is `cycle[index % cycleLen]` after the walk. Consecutive misses keep
the same index, so the missed workout keeps rolling forward until done — exactly
"push the schedule back." The simulation also collects the recent missed workout
dates so the UI can surface *"Missed 2026-06-24 — schedule pushed back 1 day."*

Notes:
- Bonus workouts on a rest slot (the existing "Train anyway" path) add a `history`
  record but do not change the index beyond the normal rest advance — they are
  extra, they don't consume the next workout.
- Multiple `history` records on one date are deduped by date for the "completed?"
  check.
- The walk is bounded (≤ ~400 iterations, mirroring `computeStreak`).

## Forward projection

From today's resolved `index`, the next N days are simply the cycle laid out day
by day starting at the current slot (future completions are assumed, so the
projection is just the cycle in order). Home shows `days[1..3]`; `/plan` shows the
next 7 days.

## New pure engine module — `src/engine/scheduleQueue.js`

Keeps logic out of React/store, matching the existing `src/engine/` pattern
(pure, immutable, no persistence).

- `buildCycle(program)` → `slot[]` of length 7. Each slot is either a session
  entry `{ label, dayType, goal, focus }` or `{ rest: true }`.
- `resolveSchedule({ program, anchorDate, history, today, daysAhead })` →
  `{ todayIndex, missedDates: string[], days: [{ date, offset, slot, completed }] }`
  where `days[0]` is today. `completed` reflects whether a history record exists
  for past/today dates.
- `slotSummary(slot, program)` → `{ label, dayType, goal, exercises, sets, repBand, rest }`:
  - `exercises` = `program.exercisesPerSession`
  - `sets` = `goal === 'strength' ? 3 : program.setsPerExercise` (mirrors
    `generateSession`)
  - `rest` = `REST_BY_GOAL[goal]` (imported from `workoutEngine.js`)
  - `repBand` = goal-based guidance string (hypertrophy `"8–15 reps"`,
    strength `"5–8 reps"`) — displayed with a "varies per exercise" footnote,
    since real `repRange` values differ per exercise (e.g. 12–20, 8–12).
- `slotForDate({ program, anchorDate, history, date })` → the resolved slot for a
  single date (used by `computeStreak` to ask "was this date a rest slot?").

## Store changes — `src/store/useStore.js`

- Add `scheduleAnchorDate: null` to `blank` (persisted automatically via
  `PERSIST_KEYS`).
- `completeOnboarding` → set `scheduleAnchorDate: dateKey()`.
- `updateProfile` → when `programId` changes, reset `scheduleAnchorDate: dateKey()`
  (the new cycle starts today).
- **Migration for existing users:** when `scheduleAnchorDate` is null, callers
  fall back to `history[0]?.date || dateKey()`. No migration step required.
- `finishSession` is untouched — completion is derived from `history`.
- `computeStreak(history, plannedRestDays, scheduleCtx?)`: when a
  `{ program, anchorDate }` context is provided, a non-workout day counts as
  non-breaking if `slotForDate(...)` is a rest slot (replacing the
  `plannedRestDays` weekday check as the primary rest signal). Keep
  `plannedRestDays` as a fallback for safety / backward compat.

## App integration

- **`Home.jsx`**: replace `sessionForToday(program)` with
  `resolveSchedule(...).days[0].slot`. Today's card renders from that slot
  (workout vs rest). Add a compact **"Up next"** strip from `days[1..3]`
  (workout type + relative-day label) and a "Full schedule →" link to `/plan`.
- **`Session.jsx`**: derive `dayType`/`goal` from the queue's today slot instead
  of `sessionForToday()` (line 23/37). `generateSession` call is otherwise
  unchanged.
- **New `src/screens/Plan.jsx`** + route `/plan` in `App.jsx` (reached from Home,
  not the bottom nav): the forward list of the next 7 days as bullet/cards —
  date, workout type, `exercises × sets`, rep band, rest interval; rest days
  clearly marked. A missed-day shift note appears at the top when `missedDates`
  is non-empty. Read-only. Uses existing component classes (`.card`, `.pill`,
  `.btn-ghost`) and `Icon.jsx`.

## Non-goals (this iteration)

- No reorder / skip-today / manual-shift UI.
- No per-exercise detail for future days.
- No backend / persistence changes beyond the single `scheduleAnchorDate` field.
- `plannedRestDays` Settings UI is left as-is (the field becomes secondary to the
  cycle; not removed).

## Testing / verification

No test runner exists in this repo (`package.json` has only Vite scripts), so
verification is: `npm run build` green, then manual preview checks —
- Home today card matches `/plan` `days[0]`.
- Completing today advances the plan; a simulated missed day shows the shift note
  and rolls the workout forward.
- Rest slots render as rest and don't break the streak.
- Program change (via Settings days/week) re-anchors the cycle to today.
