// Workout engine — generates a session from current skill levels, selected
// equipment, session length, the day type, and the hypertrophy/strength goal.
// Equipment substitution happens here: if the active exercise can't be done with
// today's equipment, the engine swaps in the best available variation.

import { EXERCISES, getExercise } from '../data/exercises.js'
import { DAY_TYPE_TREES } from '../data/programs.js'

// Map of session length (minutes) -> exercise count.
const LENGTH_TO_COUNT = { 15: 3, 30: 4, 45: 5 }

// Rest defaults (seconds) by goal. "conditioning" used when user wants shorter rests.
export const REST_BY_GOAL = { hypertrophy: 90, strength: 180, conditioning: 60 }

function isAvailable(exercise, equipment) {
  // Bodyweight ('none') is always available; otherwise at least one required item must be present.
  if (exercise.equipment.includes('none')) return true
  return exercise.equipment.some((e) => equipment.includes(e))
}

function hardestUnlocked(list) {
  return [...list].sort((a, b) => b.difficulty - a.difficulty)[0]
}

// Pick an exercise for a tree given what's unlocked, available, and already chosen.
function pickForTree(treeKey, { exclude, equipment, progress, preferPattern }) {
  const active = progress.trees[treeKey]?.activeId
  const unlockedIds = new Set(
    Object.entries(progress.exercises).filter(([, s]) => s.unlocked).map(([id]) => id)
  )

  const candidates = EXERCISES.filter(
    (e) =>
      e.category === treeKey &&
      unlockedIds.has(e.id) &&
      isAvailable(e, equipment) &&
      !exclude.has(e.id)
  )

  if (candidates.length === 0) {
    // Fallback: easiest available exercise in the category, ignoring unlock state.
    const fallback = EXERCISES.filter(
      (e) => e.category === treeKey && isAvailable(e, equipment) && !exclude.has(e.id)
    ).sort((a, b) => a.difficulty - b.difficulty)
    return fallback[0]?.id || null
  }

  // 1) The active exercise, if it's a candidate.
  if (active && candidates.some((c) => c.id === active)) {
    if (!preferPattern || getExercise(active).pattern === preferPattern) return active
  }
  // 2) Prefer a requested movement pattern (so a push day gets a press + a vertical press).
  if (preferPattern) {
    const byPattern = candidates.filter((c) => c.pattern === preferPattern)
    if (byPattern.length) return hardestUnlocked(byPattern).id
  }
  // 3) Otherwise the hardest unlocked available variation.
  return hardestUnlocked(candidates).id
}

function repOrTimeTarget(exercise, goal) {
  if (exercise.timeBased?.seconds) {
    return { type: 'time', seconds: exercise.timeBased.seconds[1] }
  }
  const range = exercise.repRange?.[goal] || exercise.repRange?.hypertrophy || [8, 12]
  return { type: 'reps', min: range[0], max: range[1] }
}

// Generate the session. Returns { dayType, goal, rest, exercises: [...] }.
export function generateSession({ progress, profile, equipment, sessionLength = 30, dayType, goal = 'hypertrophy', conditioning = false }) {
  const count = LENGTH_TO_COUNT[sessionLength] || 4
  const treeSlots = [...(DAY_TYPE_TREES[dayType] || ['push', 'core', 'legs'])]

  // Ensure we have at least `count` slots: repeat the primary tree if needed.
  while (treeSlots.length < count) treeSlots.push(treeSlots[0])
  treeSlots.length = count

  const setsPerExercise = goal === 'strength' ? 3 : profile?.programSets || 3
  const rest = conditioning ? REST_BY_GOAL.conditioning : REST_BY_GOAL[goal]

  const chosen = new Set()
  const exercises = []
  const patternsUsedPerTree = {}

  for (const treeKey of treeSlots) {
    patternsUsedPerTree[treeKey] = patternsUsedPerTree[treeKey] || new Set()
    let preferPattern = null
    // On the second appearance of a tree, bias toward a different pattern.
    if (patternsUsedPerTree[treeKey].size > 0) {
      const altPatterns = {
        push: 'vertical-press',
        pull: 'horizontal-pull',
        legs: 'hinge',
        core: 'compression',
      }
      preferPattern = altPatterns[treeKey]
    }
    const id = pickForTree(treeKey, { exclude: chosen, equipment, progress, preferPattern })
    if (!id) continue
    chosen.add(id)
    const ex = getExercise(id)
    patternsUsedPerTree[treeKey].add(ex.pattern)

    exercises.push({
      exerciseId: id,
      treeKey,
      sets: setsPerExercise,
      perSide: !!ex.perSide,
      target: repOrTimeTarget(ex, goal),
      rest,
    })
  }

  return { dayType, goal, conditioning, rest, sessionLength, exercises }
}

// A free-day / "extra workout" fallback when the schedule says rest but the user trains anyway.
export function generateBonusSession(opts) {
  return generateSession({ ...opts, dayType: opts.dayType || 'full-push' })
}
