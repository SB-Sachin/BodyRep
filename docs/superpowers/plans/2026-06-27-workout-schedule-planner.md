# Workout Schedule Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BodyRep's fixed-weekday scheduling with a rolling queue that drives the whole app, shows a forward-looking plan, and pushes workouts back when a day is missed.

**Architecture:** A new pure engine module (`scheduleQueue.js`) converts each program's weekday `schedule` into a 7-slot cycle and resolves the current/forward plan by walking from a single persisted anchor date, applying the shift-back rule from `history`. Home, Session, and a new `/plan` screen all read this resolver. The store gains one field (`scheduleAnchorDate`) and `computeStreak` consults the cycle for rest days.

**Tech Stack:** React 18, Vite, Zustand, IndexedDB (`idb`). No test runner exists — verification is Node sanity-checks for pure logic + `npm run build` + browser preview.

## Global Constraints

- No test runner / linter / typecheck in repo — do **not** add one. Verify pure logic with a temporary Node script in the scratchpad (never commit it); verify everything else with `npm run build` (must be green) and browser preview.
- Keep `src/engine/` functions **pure and immutable** (clone, don't mutate). Only `useStore.js` calls `set`/persists.
- Day indexing is `0=Mon..6=Sun`; convert JS `getDay()` (0=Sun) with `(jsDay + 6) % 7`.
- Brand accent color is the `accent` token; the four skill trees keep their own `push`/`pull`/`legs`/`core` colors. Never raw hex. Use component classes (`.card`, `.pill`, `.btn-ghost`) and `Icon.jsx` (no emoji as UI icons).
- Repo auto-deploys to Vercel on push to `main`. Run `npm run build` green before any push.
- Scratchpad dir for temp files: `/private/tmp/claude-502/-Users-sachinsbeniwal-Downloads-CODING-PROJECTS-BodyRep/27f83b28-949a-409b-9d8f-d2c2f0033688/scratchpad`

---

### Task 1: Pure rolling-queue engine — `scheduleQueue.js`

**Files:**
- Create: `src/engine/scheduleQueue.js`
- Sanity-check (temp, not committed): `<scratchpad>/sched-check.mjs`

**Interfaces:**
- Consumes: `REST_BY_GOAL` from `src/engine/workoutEngine.js`; `dateKey`, `parseKey` from `src/utils/dates.js`; program objects from `src/data/programs.js` (`schedule[]` with `{day,label,dayType,goal,focus}`, `setsPerExercise`, `exercisesPerSession`).
- Produces:
  - `buildCycle(program) -> slot[]` (length 7). Slot = `{ rest:false, label, dayType, goal, focus }` or `{ rest:true }`.
  - `slotSummary(slot, program) -> { isRest:true, label } | { isRest:false, label, dayType, goal, focus, exercises, sets, repBand, restSeconds }`.
  - `resolveSchedule({ program, anchorDate, history, today, daysAhead }) -> { todayIndex, missedDates:string[], days:[{ date, offset, slot, summary, completed }] }` (`days[0]` = today).
  - `slotForDate({ program, anchorDate, history, date }) -> slot`.
  - `relativeDayLabel(offset, date) -> string`.

- [ ] **Step 1: Create the module**

Create `src/engine/scheduleQueue.js`:

```js
// Pure rolling-queue scheduler. Converts a program's weekday schedule into a
// 7-slot cycle and resolves the forward-looking plan, applying the shift-back
// rule when scheduled workouts are missed. No React, no persistence.

import { dateKey, parseKey } from '../utils/dates.js'
import { REST_BY_GOAL } from './workoutEngine.js'

const CYCLE_LEN = 7

// Goal-based guidance rep bands for per-day summaries. Real per-exercise ranges
// vary (e.g. 12-20, 8-12); these are shown with a "varies per exercise" note.
const REP_BAND = { hypertrophy: '8–15 reps', strength: '5–8 reps' }

// Build the 7-slot cycle (weekday order 0=Mon..6=Sun) from a program. A weekday
// with a scheduled session becomes a workout slot; gaps become rest slots.
export function buildCycle(program) {
  const cycle = []
  for (let day = 0; day < CYCLE_LEN; day++) {
    const entry = program.schedule.find((s) => s.day === day)
    cycle.push(
      entry
        ? { rest: false, label: entry.label, dayType: entry.dayType, goal: entry.goal, focus: entry.focus }
        : { rest: true }
    )
  }
  return cycle
}

// Per-day summary for display.
export function slotSummary(slot, program) {
  if (slot.rest) return { isRest: true, label: 'Rest day' }
  const sets = slot.goal === 'strength' ? 3 : program.setsPerExercise
  return {
    isRest: false,
    label: slot.label,
    dayType: slot.dayType,
    goal: slot.goal,
    focus: slot.focus,
    exercises: program.exercisesPerSession,
    sets,
    repBand: REP_BAND[slot.goal] || REP_BAND.hypertrophy,
    restSeconds: REST_BY_GOAL[slot.goal] ?? REST_BY_GOAL.hypertrophy,
  }
}

// Walk the cycle from anchorDate up to (not including) `today`, applying the
// shift-back rule. Returns the resolved index at `today` and the past calendar
// dates where a scheduled workout was missed (each is one day of pushback).
function walkToToday({ cycle, anchorDate, completedDates, today }) {
  let index = 0
  const missedDates = []
  const cur = parseKey(anchorDate)
  const end = parseKey(today)
  let guard = 0
  while (cur < end && guard < 400) {
    const key = dateKey(cur)
    const slot = cycle[index % cycle.length]
    if (slot.rest) {
      index++ // rest always consumed — can't be "missed"
    } else if (completedDates.has(key)) {
      index++ // workout done — advance
    } else {
      missedDates.push(key) // workout missed — index stays, rolls forward
    }
    cur.setDate(cur.getDate() + 1)
    guard++
  }
  return { index, missedDates }
}

// Resolve the current position + forward plan. `days[0]` is today.
export function resolveSchedule({ program, anchorDate, history = [], today = dateKey(), daysAhead = 7 }) {
  const cycle = buildCycle(program)
  const anchor = anchorDate || history[0]?.date || today
  const completedDates = new Set(history.map((h) => h.date))
  const { index, missedDates } = walkToToday({ cycle, anchorDate: anchor, completedDates, today })

  const days = []
  const base = parseKey(today)
  for (let offset = 0; offset < daysAhead; offset++) {
    const d = new Date(base)
    d.setDate(d.getDate() + offset)
    const key = dateKey(d)
    const slot = cycle[(index + offset) % cycle.length]
    days.push({
      date: key,
      offset,
      slot,
      summary: slotSummary(slot, program),
      completed: !slot.rest && completedDates.has(key),
    })
  }
  return { todayIndex: index, missedDates, days }
}

// The resolved slot for a single date (used by streak logic to ask "rest day?").
export function slotForDate({ program, anchorDate, history = [], date }) {
  const cycle = buildCycle(program)
  const anchor = anchorDate || history[0]?.date || date
  const completedDates = new Set(history.map((h) => h.date))
  const { index } = walkToToday({ cycle, anchorDate: anchor, completedDates, today: date })
  return cycle[index % cycle.length]
}

// Friendly label for a forward offset.
export function relativeDayLabel(offset, date) {
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Tomorrow'
  if (offset === 2) return 'Day after tomorrow'
  return parseKey(date).toLocaleDateString(undefined, { weekday: 'long' })
}
```

- [ ] **Step 2: Write the sanity-check script**

Create `<scratchpad>/sched-check.mjs` (adjust the relative import path to the repo `src/`):

```js
import { PROGRAMS } from '../<repo>/src/data/programs.js' // use absolute path to src/data/programs.js
import { resolveSchedule } from '../<repo>/src/engine/scheduleQueue.js'

const program = PROGRAMS.C // 6-day PPL -> [Push,Pull,Legs,Push,Pull,Legs,rest]
const anchorDate = '2026-06-22' // a Monday

// Case A: nothing completed, today = anchor. days[0] should be Push.
let r = resolveSchedule({ program, anchorDate, history: [], today: '2026-06-22' })
console.log('A today label:', r.days[0].slot.label, '| missed:', r.missedDates.length)

// Case B: missed Monday (no history), today = Tuesday. Push should roll to today.
r = resolveSchedule({ program, anchorDate, history: [], today: '2026-06-23' })
console.log('B today label:', r.days[0].slot.label, '| missed:', r.missedDates) // expect Push, ['2026-06-22']

// Case C: completed Monday's Push, today = Tuesday. Today should be Pull.
r = resolveSchedule({ program, anchorDate, history: [{ date: '2026-06-22' }], today: '2026-06-23' })
console.log('C today label:', r.days[0].slot.label, '| missed:', r.missedDates.length) // expect Pull, 0
```

- [ ] **Step 3: Run the sanity check**

Run from the scratchpad (use real absolute paths to `src/`):
`node <scratchpad>/sched-check.mjs`

Expected output:
```
A today label: Push | missed: 0
B today label: Push | missed: [ '2026-06-22' ]
C today label: Pull | missed: 0
```
If any line disagrees, fix `scheduleQueue.js` and re-run before continuing.

- [ ] **Step 4: Confirm build is green**

Run: `npm run build`
Expected: build completes, no errors (the new module imports cleanly).

- [ ] **Step 5: Commit**

```bash
git add src/engine/scheduleQueue.js
git commit -m "Add rolling-queue schedule engine

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Store integration — anchor + streak

**Files:**
- Modify: `src/store/useStore.js`

**Interfaces:**
- Consumes: `slotForDate` from `src/engine/scheduleQueue.js`; `PROGRAMS` from `src/data/programs.js` (already imports `programForDays`).
- Produces: persisted `scheduleAnchorDate` field; `computeStreak(history, plannedRestDays, scheduleCtx?)` where `scheduleCtx = { program, anchorDate }`.

- [ ] **Step 1: Add imports and the new state field**

In `src/store/useStore.js`, extend the programs import (line 5) and add the engine import beneath it:

```js
import { programForDays, PROGRAMS } from '../data/programs.js'
import { slotForDate } from '../engine/scheduleQueue.js'
```

In `blank` (after `lastWorkoutDate: null,` ~line 30) add:

```js
  scheduleAnchorDate: null, // date mapping to cycle index 0 (rolling queue origin)
```

- [ ] **Step 2: Set the anchor at onboarding**

In `completeOnboarding`, add `scheduleAnchorDate` to the `set({...})` call:

```js
    set({
      onboarded: true,
      profile: fullProfile,
      progress,
      scheduleAnchorDate: dateKey(),
      weightLog: profile.weight ? [{ date: dateKey(), weight: profile.weight }] : [],
    })
```

- [ ] **Step 3: Re-anchor on program change**

Replace the body of `updateProfile` with:

```js
  updateProfile(patch) {
    const profile = { ...get().profile, ...patch }
    let extra = {}
    if (patch.daysPerWeek) {
      const program = programForDays(patch.daysPerWeek)
      if (program.id !== get().profile.programId) extra.scheduleAnchorDate = dateKey()
      profile.programId = program.id
      profile.programSets = program.setsPerExercise
    }
    set({ profile, ...extra })
    scheduleSave(get)
  },
```

- [ ] **Step 4: Make computeStreak cycle-aware**

Replace the entire `computeStreak` function (lines ~264-282) with:

```js
// Current streak = consecutive days (counting back from today) that were either
// a workout day or a rest day, until the first miss. When a scheduleCtx
// ({ program, anchorDate }) is given, "rest day" comes from the rolling cycle;
// otherwise it falls back to the weekday-based plannedRestDays set.
export function computeStreak(history, plannedRestDays = [], scheduleCtx = null) {
  const workoutDays = new Set(history.map((h) => h.date))
  const restWeekdays = new Set(plannedRestDays)
  const isRestDay = (key, weekday) => {
    if (scheduleCtx?.program) {
      return slotForDate({
        program: scheduleCtx.program,
        anchorDate: scheduleCtx.anchorDate,
        history,
        date: key,
      }).rest
    }
    return restWeekdays.has(weekday)
  }
  let streak = 0
  const d = new Date()
  if (!workoutDays.has(dateKey(d))) {
    const weekday = (d.getDay() + 6) % 7
    if (!isRestDay(dateKey(d), weekday)) d.setDate(d.getDate() - 1)
  }
  for (let i = 0; i < 400; i++) {
    const key = dateKey(d)
    const weekday = (d.getDay() + 6) % 7
    if (workoutDays.has(key) || isRestDay(key, weekday)) {
      if (workoutDays.has(key)) streak += 1
      d.setDate(d.getDate() - 1)
    } else break
  }
  return streak
}
```

- [ ] **Step 5: Pass schedule context where badges check the streak**

In `_checkBadges`, replace the streak line (~197):

```js
    const program = PROGRAMS[s.profile.programId] || PROGRAMS.A
    const streak = computeStreak(s.history, s.plannedRestDays, { program, anchorDate: s.scheduleAnchorDate })
```

- [ ] **Step 6: Build and commit**

Run: `npm run build` → expect green.

```bash
git add src/store/useStore.js
git commit -m "Persist schedule anchor + make streak cycle-aware

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Home screen reads the queue + "Up next" strip

**Files:**
- Modify: `src/screens/Home.jsx`

**Interfaces:**
- Consumes: `resolveSchedule`, `relativeDayLabel` from `src/engine/scheduleQueue.js`; `scheduleAnchorDate` from the store; cycle-aware `computeStreak`.
- Produces: no new exports (screen only).

- [ ] **Step 1: Swap imports**

In `src/screens/Home.jsx`, change the programs import (line 3) and add the engine import:

```js
import { PROGRAMS } from '../data/programs.js'
import { resolveSchedule, relativeDayLabel } from '../engine/scheduleQueue.js'
```

(`sessionForToday` is no longer used here.)

- [ ] **Step 2: Replace the "today" derivation**

Replace lines ~18-24 (`const program ...` through `const streak ...`) with:

```js
  const program = PROGRAMS[profile.programId] || PROGRAMS.A
  const anchorDate = useStore((s) => s.scheduleAnchorDate)
  const schedule = resolveSchedule({ program, anchorDate, history })
  const todaySlot = schedule.days[0]?.slot
  const isRestToday = !!todaySlot?.rest
  const today = todaySlot && !todaySlot.rest ? todaySlot : null
  const doneToday = history.some((h) => h.date === dateKey())

  const streak = computeStreak(history, plannedRestDays, { program, anchorDate })
```

- [ ] **Step 3: Update the card conditionals to use isRestToday**

Change the workout-card guard (was `today && !doneToday && !isPlannedRest`) to:

```jsx
      {today && !doneToday && (
```

Change the rest-card guard (was `!doneToday && (isPlannedRest || !today)`) to:

```jsx
      {!doneToday && isRestToday && (
```

- [ ] **Step 4: Add the "Up next" strip after the today/rest/done cards**

Immediately before the `<div className="grid grid-cols-2 gap-3">` block, insert:

```jsx
      <UpNext days={schedule.days.slice(1, 4)} onOpen={() => nav('/plan')} />
```

- [ ] **Step 5: Add the UpNext component**

At the bottom of the file (before `function Ring`), add:

```jsx
function UpNext({ days, onOpen }) {
  return (
    <div className="card mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Up next</h3>
        <button className="text-xs font-semibold text-accent" onClick={onOpen}>Full schedule →</button>
      </div>
      <ul className="space-y-1.5">
        {days.map((d) => (
          <li key={d.date} className="flex items-center justify-between text-sm">
            <span className="text-slate-400">{relativeDayLabel(d.offset, d.date)}</span>
            <span className={d.summary.isRest ? 'text-slate-500' : 'font-semibold text-slate-200'}>
              {d.summary.isRest ? 'Rest' : d.summary.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 6: Build and preview**

Run: `npm run build` → expect green.
Preview: start the dev server, load Home. Verify the today card matches the cycle, the "Up next" strip lists the next 3 days with correct relative labels, and "Full schedule →" is present (route added in Task 5; clicking it 404-redirects to Home until then, which is fine).

- [ ] **Step 7: Commit**

```bash
git add src/screens/Home.jsx
git commit -m "Home reads rolling queue + adds Up Next strip

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Session screen derives day type from the queue

**Files:**
- Modify: `src/screens/Session.jsx`

**Interfaces:**
- Consumes: `resolveSchedule` from `src/engine/scheduleQueue.js`; `scheduleAnchorDate` and `history` from the store.
- Produces: none (screen only).

- [ ] **Step 1: Swap imports**

Change the programs import (line 4) and add the engine import:

```js
import { PROGRAMS } from '../data/programs.js'
import { resolveSchedule } from '../engine/scheduleQueue.js'
```

(`sessionForToday` no longer used here.)

- [ ] **Step 2: Derive today from the queue**

Replace `const today = sessionForToday(program)` (line ~23) with:

```js
  const anchorDate = useStore((s) => s.scheduleAnchorDate)
  const history = useStore((s) => s.history)
  const todaySlot = resolveSchedule({ program, anchorDate, history }).days[0]?.slot
  const today = todaySlot && !todaySlot.rest ? todaySlot : null
```

The existing `start()` already falls back to `'full-push'`/`'hypertrophy'` when `today` is null, so a rest-day "Train anyway" still generates a bonus session. No other changes needed in `start()`.

- [ ] **Step 3: Build and preview**

Run: `npm run build` → expect green.
Preview: from Home, tap "Start workout" on a workout day → Setup shows the right day type and starting generates a session. On a rest day, "Train anyway" still opens Setup and generates a bonus session (no crash from a null `today`).

- [ ] **Step 4: Commit**

```bash
git add src/screens/Session.jsx
git commit -m "Session derives day type from rolling queue

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Dedicated `/plan` screen + route

**Files:**
- Create: `src/screens/Plan.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `resolveSchedule`, `relativeDayLabel` from `src/engine/scheduleQueue.js`; store `profile`, `history`, `scheduleAnchorDate`; `PROGRAMS`; `Icon.jsx`.
- Produces: default-exported `Plan` component; `/plan` route.

- [ ] **Step 1: Create the Plan screen**

Create `src/screens/Plan.jsx`:

```jsx
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { PROGRAMS } from '../data/programs.js'
import { resolveSchedule, relativeDayLabel } from '../engine/scheduleQueue.js'
import Icon from '../components/Icon.jsx'

export default function Plan() {
  const nav = useNavigate()
  const profile = useStore((s) => s.profile)
  const history = useStore((s) => s.history)
  const anchorDate = useStore((s) => s.scheduleAnchorDate)

  const program = PROGRAMS[profile.programId] || PROGRAMS.A
  const { days, missedDates } = resolveSchedule({ program, anchorDate, history, daysAhead: 7 })

  return (
    <div className="screen animate-fade-up pt-8">
      <header className="mb-5 flex items-center gap-3">
        <button className="btn-ghost px-2 py-2" aria-label="Back" onClick={() => nav('/')}>
          <Icon name="chevron-left" size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your schedule</h1>
          <div className="text-sm text-slate-400">{program.name}</div>
        </div>
      </header>

      {missedDates.length > 0 && (
        <div className="card mb-4 border border-accent/30 bg-accent/10">
          <div className="flex items-center gap-2 text-sm text-accent">
            <Icon name="alert" size={18} />
            <span>
              Missed {missedDates.length} {missedDates.length === 1 ? 'day' : 'days'} — schedule pushed back by{' '}
              {missedDates.length} {missedDates.length === 1 ? 'day' : 'days'}.
            </span>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {days.map((d) => (
          <li key={d.date} className="card">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-400">
                {relativeDayLabel(d.offset, d.date)}
              </span>
              {!d.summary.isRest && (
                <span className={`pill ${d.summary.goal === 'strength' ? 'bg-gold/20 text-gold' : 'bg-accent/20 text-accent'}`}>
                  {d.summary.goal}
                </span>
              )}
            </div>
            {d.summary.isRest ? (
              <div className="flex items-center gap-2 text-slate-300">
                <Icon name="rest" size={18} />
                <span className="font-semibold">Rest day</span>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold">{d.summary.label}</h2>
                <p className="text-sm text-slate-400">{d.summary.focus}</p>
                <div className="mt-2 text-sm text-slate-300">
                  {d.summary.exercises} exercises · {d.summary.sets} sets · {d.summary.repBand} · {d.summary.restSeconds}s rest
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-center text-xs text-slate-500">
        Rep ranges vary per exercise — exact targets are set during the session.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verify the icon names exist**

Run: `grep -nE "chevron-left|'alert'|\"alert\"|'rest'|chevronLeft" src/components/Icon.jsx`
Expected: `rest` exists (used on Home). If `chevron-left` or `alert` are absent, use names that DO exist in `Icon.jsx` (e.g. reuse `rest`/`flame`/`check` patterns) or add the missing icon following the existing inline-SVG, stroke-based, `currentColor` convention in `Icon.jsx`. Do not introduce emoji.

- [ ] **Step 3: Wire the route**

In `src/App.jsx`, add the import near the other screen imports:

```js
import Plan from './screens/Plan.jsx'
```

Add the route inside `<Routes>` after the Home route:

```jsx
        <Route path="/plan" element={<Plan />} />
```

- [ ] **Step 4: Build and preview**

Run: `npm run build` → expect green.
Preview: from Home tap "Full schedule →" → `/plan` renders 7 day-cards with date label, type, `N exercises · S sets · rep band · rest`, rest days marked, back button returns Home. To confirm the missed-day note: in the preview console, complete-or-skip a day so `missedDates` is non-empty (or temporarily set an older `scheduleAnchorDate` via the app), and confirm the banner appears.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Plan.jsx src/App.jsx src/components/Icon.jsx
git commit -m "Add /plan schedule screen with shift-back note

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Full verification + deploy

**Files:** none (verification + push).

- [ ] **Step 1: Final build**

Run: `npm run build`
Expected: green.

- [ ] **Step 2: End-to-end preview pass**

Start preview and confirm:
- Home today card == `/plan` `days[0]`.
- Completing today's workout advances the plan (today card flips to "complete", `/plan` `days[0]` becomes the next slot tomorrow).
- A rest slot renders as Rest on both Home and `/plan` and does not break the streak (streak chip unchanged across a rest day).
- Changing days/week in Settings re-anchors the cycle to today (the new program's first slot shows as today).

- [ ] **Step 3: Push to deploy**

```bash
git push origin main
```
Expected: push succeeds; Vercel auto-deploys.

---

## Self-Review

- **Spec coverage:** cycle + anchor (Task 1), shift-back rule (Task 1), `scheduleQueue.js` API incl. `slotForDate`/`relativeDayLabel` (Task 1), store `scheduleAnchorDate` + onboarding + re-anchor + migration fallback (Task 2), cycle-aware `computeStreak` + callers (Task 2), Home today-card + Up-next + link (Task 3), Session day-type (Task 4), `/plan` screen + route + missed-day note + rep footnote (Task 5), verification incl. program-change re-anchor (Task 6). All spec sections mapped.
- **Migration fallback:** `resolveSchedule`/`slotForDate` default `anchorDate` to `history[0]?.date || today`, so existing users with `scheduleAnchorDate === null` resolve sensibly with no migration step (spec §Store changes).
- **Type consistency:** `resolveSchedule` returns `{ todayIndex, missedDates, days:[{date,offset,slot,summary,completed}] }` and every consumer (Home, Session, Plan) reads `days[].slot`/`days[].summary`/`missedDates` exactly as produced. `slotSummary` uses `isRest`/`restSeconds` (distinct from slot's internal `rest` boolean) and Plan/Home read those names. `computeStreak(history, plannedRestDays, scheduleCtx)` signature matches both callers.
- **Placeholder scan:** no TBD/TODO; the only `<scratchpad>`/`<repo>` tokens are explicit path placeholders the implementer fills with real absolute paths for the throwaway sanity script (never committed). Icon-name existence is verified in Task 5 Step 2 rather than assumed.
