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
