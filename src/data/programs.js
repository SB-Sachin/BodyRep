// Weekly program structures (PRD section "Weekly Program Structures").
// dayType drives which skill trees the engine pulls from.
// hypertrophy vs strength is assigned per session; full-body days default to hypertrophy.

export const PROGRAMS = {
  A: {
    id: 'A',
    name: '3-Day Full Body',
    level: 'Beginner',
    daysPerWeek: 3,
    note: 'Three full-body sessions. ~9-12 sets per muscle per week — meets the minimum effective volume.',
    setsPerExercise: 3,
    exercisesPerSession: 4,
    // day index 0=Mon ... 6=Sun
    schedule: [
      { day: 0, label: 'Full Body A', focus: 'Push emphasis', dayType: 'full-push', goal: 'hypertrophy' },
      { day: 2, label: 'Full Body B', focus: 'Pull emphasis', dayType: 'full-pull', goal: 'hypertrophy' },
      { day: 4, label: 'Full Body C', focus: 'Legs + Core', dayType: 'full-legs', goal: 'hypertrophy' },
    ],
  },
  B: {
    id: 'B',
    name: '4-Day Upper / Lower',
    level: 'Intermediate',
    daysPerWeek: 4,
    note: 'Trains each muscle twice weekly at ~16 sets — the optimal range and best frequency/recovery balance.',
    setsPerExercise: 4,
    exercisesPerSession: 4,
    schedule: [
      { day: 0, label: 'Upper Body', focus: 'Push + Pull', dayType: 'upper', goal: 'hypertrophy' },
      { day: 1, label: 'Lower Body', focus: 'Squat + Hinge', dayType: 'lower', goal: 'hypertrophy' },
      { day: 3, label: 'Upper Body', focus: 'Push + Pull', dayType: 'upper', goal: 'strength' },
      { day: 4, label: 'Lower Body', focus: 'Squat + Hinge', dayType: 'lower', goal: 'strength' },
    ],
  },
  C: {
    id: 'C',
    name: '6-Day Push / Pull / Legs',
    level: 'Advanced',
    daysPerWeek: 6,
    note: 'Highest frequency at ~16-20 sets per muscle. Requires strong recovery habits (sleep, food, rest).',
    setsPerExercise: 4,
    exercisesPerSession: 4,
    schedule: [
      { day: 0, label: 'Push', focus: 'Chest, Shoulders, Triceps', dayType: 'push', goal: 'hypertrophy' },
      { day: 1, label: 'Pull', focus: 'Back, Biceps', dayType: 'pull', goal: 'hypertrophy' },
      { day: 2, label: 'Legs', focus: 'Quads, Hamstrings, Glutes', dayType: 'legs', goal: 'hypertrophy' },
      { day: 3, label: 'Push', focus: 'Chest, Shoulders, Triceps', dayType: 'push', goal: 'strength' },
      { day: 4, label: 'Pull', focus: 'Back, Biceps', dayType: 'pull', goal: 'strength' },
      { day: 5, label: 'Legs', focus: 'Quads, Hamstrings, Glutes', dayType: 'legs', goal: 'hypertrophy' },
    ],
  },
}

// Map training days/week chosen at onboarding to a program.
export function programForDays(days) {
  if (days >= 6) return PROGRAMS.C
  if (days >= 4) return PROGRAMS.B
  return PROGRAMS.A
}

// Which skill trees a given dayType draws from, in priority order.
// "full-*" days hit one primary tree heavily plus core; PPL/UL days are focused.
export const DAY_TYPE_TREES = {
  'full-push': ['push', 'core', 'legs'],
  'full-pull': ['pull', 'core', 'legs'],
  'full-legs': ['legs', 'core', 'pull'],
  upper: ['push', 'pull', 'core'],
  lower: ['legs', 'legs', 'core'],
  push: ['push', 'push', 'core'],
  pull: ['pull', 'pull', 'core'],
  legs: ['legs', 'legs', 'core'],
}

// Return today's scheduled session entry for a program, or null on a rest day.
export function sessionForToday(program, date = new Date()) {
  // JS getDay(): 0=Sun..6=Sat. Convert to our 0=Mon..6=Sun.
  const jsDay = date.getDay()
  const ourDay = (jsDay + 6) % 7
  return program.schedule.find((s) => s.day === ourDay) || null
}
