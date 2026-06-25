// Progression logic: baseline placement at onboarding, advancement thresholds,
// and the skill-decay rule. Pure functions operating on a `progress` object.
//
// progress shape:
// {
//   trees: { push:{level, activeId}, pull:{...}, legs:{...}, core:{...} },
//   exercises: { [id]: { unlocked, consecutiveHits, bestReps, bestSeconds, totalReps, weekReps } }
// }

import { getExercise } from '../data/exercises.js'
import { SKILL_TREES, ADVANCEMENT, CONSECUTIVE_SESSIONS } from '../data/skillTrees.js'

function blankExercise() {
  return { unlocked: false, consecutiveHits: 0, bestReps: 0, bestSeconds: 0, totalReps: 0, weekReps: 0 }
}

// Unlock every exercise in a tree up to and including `level`.
function unlockUpToLevel(exercises, treeKey, level) {
  for (const lvl of SKILL_TREES[treeKey].levels) {
    if (lvl.level <= level) {
      for (const id of lvl.exercises) {
        if (!exercises[id]) exercises[id] = blankExercise()
        exercises[id].unlocked = true
      }
    }
  }
}

// Place the user in each tree based on their onboarding baselines.
export function initialProgress(profile) {
  const exercises = {}
  const hasBar = (profile.equipment || []).includes('pullup-bar') || (profile.equipment || []).includes('gym')

  // PUSH — from max push-ups.
  const p = profile.maxPushups ?? 0
  let pushActive = 'incline-pushup', pushLevel = 1
  if (p >= 30) { pushActive = 'archer-pushup'; pushLevel = 4 }
  else if (p >= 15) { pushActive = 'decline-pushup'; pushLevel = 3 }
  else if (p >= 5) { pushActive = 'standard-pushup'; pushLevel = 2 }

  // PULL — from max pull-ups, clamped by equipment.
  const pl = profile.maxPullups ?? 0
  let pullActive = hasBar ? 'scapular-pullup' : 'australian-row'
  let pullLevel = hasBar ? 1 : 2
  if (hasBar) {
    if (pl >= 10) { pullActive = 'wide-grip-pullup'; pullLevel = 4 }
    else if (pl >= 5) { pullActive = 'pullup'; pullLevel = 3 }
    else if (pl >= 1) { pullActive = 'chinup'; pullLevel = 3 }
    else { pullActive = 'australian-row'; pullLevel = 2 }
  }

  // LEGS / CORE — from self-reported fitness level.
  const fl = profile.fitnessLevel || 'beginner'
  const legsMap = { beginner: ['bodyweight-squat', 1], some: ['pause-squat', 2], active: ['bulgarian-split-squat', 3] }
  const coreMap = { beginner: ['plank', 1], some: ['hollow-body-tuck', 2], active: ['hollow-body-hold', 3] }
  const [legsActive, legsLevel] = legsMap[fl] || legsMap.beginner
  const [coreActive, coreLevel] = coreMap[fl] || coreMap.beginner

  unlockUpToLevel(exercises, 'push', pushLevel)
  unlockUpToLevel(exercises, 'pull', pullLevel)
  unlockUpToLevel(exercises, 'legs', legsLevel)
  unlockUpToLevel(exercises, 'core', coreLevel)

  return {
    trees: {
      push: { level: pushLevel, activeId: pushActive },
      pull: { level: pullLevel, activeId: pullActive },
      legs: { level: legsLevel, activeId: legsActive },
      core: { level: coreLevel, activeId: coreActive },
    },
    exercises,
  }
}

// Did a set-array meet the advancement threshold for this exercise?
// results: array of { reps?, seconds? } for each set performed of that exercise.
export function meetsThreshold(exerciseId, results) {
  const ex = getExercise(exerciseId)
  if (!ex || !results || results.length === 0) return false

  if (ex.timeBased?.seconds) {
    const goal = ex.timeBased.seconds[1]
    const enough = results.length >= 3
    return enough && results.every((r) => (r.seconds ?? 0) >= goal)
  }
  const t = ADVANCEMENT[exerciseId]
  if (!t) return false
  const enough = results.length >= t.sets
  return enough && results.every((r) => (r.reps ?? 0) >= t.reps)
}

// Which tree level does an exercise belong to?
export function levelOfExercise(treeKey, exerciseId) {
  const lvl = SKILL_TREES[treeKey].levels.find((l) => l.exercises.includes(exerciseId))
  return lvl ? lvl.level : 1
}

// Apply one exercise's session results to progress (returns a new object).
// Returns { progress, advanced, newExerciseId, leveledUp, treeKey }.
export function applyExerciseResult(progress, treeKey, exerciseId, results) {
  const next = structuredClone(progress)
  if (!next.exercises[exerciseId]) next.exercises[exerciseId] = blankExercise()
  const ex = getExercise(exerciseId)
  const eState = next.exercises[exerciseId]

  // Track volume + PRs.
  let bestRepsThisSession = 0
  let bestSecThisSession = 0
  for (const r of results) {
    if (r.reps) { eState.totalReps += r.reps; eState.weekReps += r.reps; bestRepsThisSession = Math.max(bestRepsThisSession, r.reps) }
    if (r.seconds) bestSecThisSession = Math.max(bestSecThisSession, r.seconds)
  }
  eState.bestReps = Math.max(eState.bestReps, bestRepsThisSession)
  eState.bestSeconds = Math.max(eState.bestSeconds, bestSecThisSession)

  let advanced = false
  let leveledUp = false
  let newExerciseId = null

  // Only the tree's active exercise drives advancement.
  if (next.trees[treeKey] && next.trees[treeKey].activeId === exerciseId) {
    if (meetsThreshold(exerciseId, results)) {
      eState.consecutiveHits += 1
      if (eState.consecutiveHits >= CONSECUTIVE_SESSIONS && ex.harder) {
        const harderId = ex.harder
        if (!next.exercises[harderId]) next.exercises[harderId] = blankExercise()
        next.exercises[harderId].unlocked = true
        next.trees[treeKey].activeId = harderId
        eState.consecutiveHits = 0
        advanced = true
        newExerciseId = harderId
        const newLevel = levelOfExercise(treeKey, harderId)
        if (newLevel > next.trees[treeKey].level) {
          next.trees[treeKey].level = newLevel
          leveledUp = true
        }
      }
    } else {
      eState.consecutiveHits = 0
    }
  }

  return { progress: next, advanced, newExerciseId, leveledUp, treeKey }
}

// Decay: missing 2+ days drops each tree's current level by 1 (floor 1), once.
export function applyDecay(progress, daysSinceLast) {
  if (daysSinceLast < 2) return { progress, decayed: false }
  const next = structuredClone(progress)
  let decayed = false
  for (const key of Object.keys(next.trees)) {
    if (next.trees[key].level > 1) {
      next.trees[key].level -= 1
      decayed = true
    }
    const active = next.trees[key].activeId
    if (next.exercises[active]) next.exercises[active].consecutiveHits = 0
  }
  return { progress: next, decayed }
}

export function resetWeeklyReps(progress) {
  const next = structuredClone(progress)
  for (const id of Object.keys(next.exercises)) next.exercises[id].weekReps = 0
  return next
}
