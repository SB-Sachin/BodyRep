// Skill trees — four parallel trees (push, pull, legs, core), 5 levels each.
// Each level lists the exercise ids unlocked at that level (from exercises.js / the PRD).

export const SKILL_TREES = {
  push: {
    label: 'Push',
    color: '#f87171',
    levels: [
      { level: 1, name: 'Foundation', exercises: ['incline-pushup', 'knee-pushup'] },
      { level: 2, name: 'Foundation', exercises: ['standard-pushup', 'pike-pushup'] },
      { level: 3, name: 'Intermediate', exercises: ['decline-pushup', 'diamond-pushup', 'parallel-bar-dip'] },
      { level: 4, name: 'Advanced', exercises: ['archer-pushup', 'bw-tricep-extension'] },
      { level: 5, name: 'Elite', exercises: ['one-arm-pushup', 'wall-handstand-pushup'] },
    ],
  },
  pull: {
    label: 'Pull',
    color: '#22d3ee',
    levels: [
      { level: 1, name: 'Foundation', exercises: ['dead-hang', 'scapular-pullup', 'face-pull-band'] },
      { level: 2, name: 'Foundation', exercises: ['australian-row', 'negative-pullup'] },
      { level: 3, name: 'Intermediate', exercises: ['chinup', 'pullup'] },
      { level: 4, name: 'Advanced', exercises: ['wide-grip-pullup', 'lsit-pullup'] },
      { level: 5, name: 'Elite', exercises: ['archer-pullup', 'one-arm-pullup'] },
    ],
  },
  legs: {
    label: 'Legs',
    color: '#34d399',
    levels: [
      { level: 1, name: 'Foundation', exercises: ['bodyweight-squat', 'glute-bridge', 'reverse-lunge'] },
      { level: 2, name: 'Foundation', exercises: ['pause-squat', 'single-leg-glute-bridge', 'wall-sit'] },
      { level: 3, name: 'Intermediate', exercises: ['bulgarian-split-squat', 'jump-squat', 'nordic-curl-assisted'] },
      { level: 4, name: 'Advanced', exercises: ['shrimp-squat', 'nordic-curl', 'single-leg-rdl'] },
      { level: 5, name: 'Elite', exercises: ['pistol-squat'] },
    ],
  },
  core: {
    label: 'Core',
    color: '#fbbf24',
    levels: [
      { level: 1, name: 'Foundation', exercises: ['plank', 'dead-bug'] },
      { level: 2, name: 'Foundation', exercises: ['hollow-body-tuck', 'side-plank'] },
      { level: 3, name: 'Intermediate', exercises: ['hollow-body-hold', 'rkc-plank'] },
      { level: 4, name: 'Advanced', exercises: ['lsit-tuck', 'one-arm-plank'] },
      { level: 5, name: 'Elite', exercises: ['lsit-full'] },
    ],
  },
}

export const TREE_KEYS = ['push', 'pull', 'legs', 'core']

// Advancement thresholds — per exercise, the rep target that must be hit on
// CONSECUTIVE_SESSIONS to graduate to the next variation (from workout-research.md).
export const CONSECUTIVE_SESSIONS = 2

// { sets, reps } means "sets x reps for all sets". perSide handled by the engine.
export const ADVANCEMENT = {
  // push
  'incline-pushup': { sets: 3, reps: 15 },
  'knee-pushup': { sets: 3, reps: 15 },
  'standard-pushup': { sets: 3, reps: 15 },
  'decline-pushup': { sets: 3, reps: 12 },
  'diamond-pushup': { sets: 3, reps: 12 },
  'parallel-bar-dip': { sets: 3, reps: 12 },
  'archer-pushup': { sets: 3, reps: 8 },
  'bw-tricep-extension': { sets: 3, reps: 12 },
  // pull
  'scapular-pullup': { sets: 3, reps: 12 },
  'australian-row': { sets: 3, reps: 12 },
  'negative-pullup': { sets: 5, reps: 1 },
  'chinup': { sets: 3, reps: 8 },
  'pullup': { sets: 3, reps: 10 },
  'wide-grip-pullup': { sets: 3, reps: 8 },
  'archer-pullup': { sets: 3, reps: 5 },
  // legs
  'bodyweight-squat': { sets: 3, reps: 20 },
  'pause-squat': { sets: 3, reps: 12 },
  'reverse-lunge': { sets: 3, reps: 15 },
  'bulgarian-split-squat': { sets: 3, reps: 12 },
  'shrimp-squat': { sets: 3, reps: 8 },
  'single-leg-glute-bridge': { sets: 3, reps: 15 },
  'nordic-curl-assisted': { sets: 3, reps: 6 },
  // core (time-based exercises use the goal seconds as the threshold)
}

// Friendly description of the threshold for the UI.
export function describeThreshold(exerciseId, exercise) {
  if (exercise?.timeBased?.seconds) {
    const goal = exercise.timeBased.seconds[1]
    return `Hold ${goal}s for all sets, 2 sessions in a row`
  }
  const t = ADVANCEMENT[exerciseId]
  if (!t) return null
  const per = exercise?.perSide ? ' per side' : ''
  return `${t.sets}×${t.reps}${per} for 2 sessions in a row`
}
