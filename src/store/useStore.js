import { create } from 'zustand'
import { loadState, saveState, appendSession } from '../db/db.js'
import { dateKey, daysBetween, weekKey } from '../utils/dates.js'
import { initialProgress, applyExerciseResult, applyDecay, resetWeeklyReps } from '../engine/progression.js'
import { programForDays, PROGRAMS } from '../data/programs.js'
import { slotForDate } from '../engine/scheduleQueue.js'
import {
  XP_PER_SESSION, XP_PER_SET, WEEKLY_XP_GOAL_PER_DAY, BADGES, tierForXp,
} from '../data/gamification.js'

const AI_DAILY_CAP = 50

const blank = {
  hydrated: false,
  onboarded: false,
  profile: {
    age: null, height: null, weight: null, targetWeight: null,
    fitnessLevel: 'beginner', equipment: ['none'], daysPerWeek: 3,
    programId: 'A', programSets: 3, sessionLength: 30, conditioning: false,
    maxPushups: 0, maxPullups: 0,
  },
  progress: { trees: {}, exercises: {} },
  history: [],          // [{ id, date, dayType, goal, exercises:[{exerciseId,treeKey,results:[{reps?,seconds?}]}], xp }]
  weightLog: [],        // [{ date, weight }]
  xp: 0,
  weeklyXp: { week: weekKey(), xp: 0 },
  weekStamp: weekKey(),
  badges: [],           // earned badge ids
  plannedRestDays: [],  // weekday indices (0=Mon) the user marks as rest
  streakFreezes: 1,
  lastWorkoutDate: null,
  scheduleAnchorDate: null, // date mapping to cycle index 0 (rolling queue origin)
  decayAppliedFor: null,
  ai: { date: dateKey(), count: 0, weeklySummary: null }, // weeklySummary: {week, text}
  chat: [],             // persisted coach conversation [{ id, role:'user'|'ai', text, ts, error? }]
}

// Persist only the data slice. `blank` is the data shape, so the persisted keys
// are every key in `blank` except `hydrated`. Spreading the whole store instead
// would carry the Zustand action functions, which IndexedDB's structured-clone
// can't serialize — that throws DataCloneError and silently drops every save.
const PERSIST_KEYS = Object.keys(blank).filter((k) => k !== 'hydrated')
function serializable(s) {
  const out = {}
  for (const k of PERSIST_KEYS) out[k] = s[k]
  return out
}

let saveTimer = null
function scheduleSave(get) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveState(serializable(get())), 250)
}

export const useStore = create((set, get) => ({
  ...blank,

  async hydrate() {
    const saved = await loadState()
    if (saved) {
      set({ ...saved, hydrated: true })
      get()._maintenance()
    } else {
      set({ hydrated: true })
    }
  },

  // Run on hydrate: weekly XP/rep reset + skill decay for missed days.
  _maintenance() {
    const s = get()
    const today = dateKey()
    let patch = {}

    const wk = weekKey()
    if (s.weekStamp !== wk) {
      patch.weekStamp = wk
      patch.weeklyXp = { week: wk, xp: 0 }
      patch.progress = resetWeeklyReps(s.progress)
    }

    if (s.lastWorkoutDate && s.decayAppliedFor !== s.lastWorkoutDate) {
      const gap = daysBetween(s.lastWorkoutDate, today)
      if (gap >= 2) {
        const base = patch.progress || s.progress
        const { progress, decayed } = applyDecay(base, gap)
        if (decayed) {
          patch.progress = progress
          patch.decayAppliedFor = s.lastWorkoutDate
        }
      }
    }

    if (s.ai.date !== today) patch.ai = { ...s.ai, date: today, count: 0 }

    if (Object.keys(patch).length) { set(patch); scheduleSave(get) }
  },

  completeOnboarding(profile) {
    const program = programForDays(profile.daysPerWeek)
    const fullProfile = {
      ...get().profile, ...profile,
      programId: program.id, programSets: program.setsPerExercise,
    }
    const progress = initialProgress(fullProfile)
    set({
      onboarded: true,
      profile: fullProfile,
      progress,
      scheduleAnchorDate: dateKey(),
      weightLog: profile.weight ? [{ date: dateKey(), weight: profile.weight }] : [],
    })
    get()._checkBadges()
    scheduleSave(get)
  },

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

  logWeight(weight) {
    const today = dateKey()
    const log = get().weightLog.filter((w) => w.date !== today)
    log.push({ date: today, weight: Number(weight) })
    log.sort((a, b) => a.date.localeCompare(b.date))
    set({ weightLog: log, profile: { ...get().profile, weight: Number(weight) } })
    scheduleSave(get)
  },

  // Finish a session. `session` carries exercises[].results[].
  finishSession(session) {
    const s = get()
    const today = dateKey()
    let progress = s.progress
    const advancements = []
    const prs = []
    let setsCompleted = 0

    for (const ex of session.exercises) {
      const results = ex.results || []
      setsCompleted += results.length
      const prevBest = s.progress.exercises[ex.exerciseId]?.bestReps || 0
      const prevBestSec = s.progress.exercises[ex.exerciseId]?.bestSeconds || 0
      const r = applyExerciseResult(progress, ex.treeKey, ex.exerciseId, results)
      progress = r.progress
      if (r.advanced) advancements.push({ treeKey: r.treeKey, newExerciseId: r.newExerciseId, leveledUp: r.leveledUp })
      const newBest = progress.exercises[ex.exerciseId]?.bestReps || 0
      const newBestSec = progress.exercises[ex.exerciseId]?.bestSeconds || 0
      if (newBest > prevBest && prevBest > 0) prs.push({ exerciseId: ex.exerciseId, reps: newBest })
      if (newBestSec > prevBestSec && prevBestSec > 0) prs.push({ exerciseId: ex.exerciseId, seconds: newBestSec })
    }

    const xpEarned = XP_PER_SESSION + setsCompleted * XP_PER_SET
    const wk = weekKey()
    const weeklyXp = s.weeklyXp.week === wk
      ? { week: wk, xp: s.weeklyXp.xp + xpEarned }
      : { week: wk, xp: xpEarned }

    const record = {
      id: `${today}-${Date.now()}`,
      date: today,
      dayType: session.dayType,
      goal: session.goal,
      xp: xpEarned,
      exercises: session.exercises.map((e) => ({ exerciseId: e.exerciseId, treeKey: e.treeKey, results: e.results || [] })),
    }
    const history = [...s.history, record]

    set({
      progress,
      history,
      xp: s.xp + xpEarned,
      weeklyXp,
      lastWorkoutDate: today,
      decayAppliedFor: null,
    })
    appendSession(record)
    const newBadges = get()._checkBadges()
    scheduleSave(get)

    return { xpEarned, setsCompleted, advancements, prs, newBadges, record }
  },

  // Returns newly earned badge objects and stores their ids.
  _checkBadges() {
    const s = get()
    const earned = new Set(s.badges)
    const add = []
    const give = (id) => { if (!earned.has(id)) { earned.add(id); add.push(id) } }

    const totalReps = Object.values(s.progress.exercises || {}).reduce((a, e) => a + (e.totalReps || 0), 0)
    const anyL5 = Object.values(s.progress.trees || {}).some((t) => t.level >= 5)
    const unlocked = (id) => s.progress.exercises?.[id]?.unlocked
    const program = PROGRAMS[s.profile.programId] || PROGRAMS.A
    const streak = computeStreak(s.history, s.plannedRestDays, { program, anchorDate: s.scheduleAnchorDate })

    if (s.history.length >= 1) give('first-workout')
    if (unlocked('pullup')) give('first-pullup')
    if (unlocked('pistol-squat')) give('first-pistol')
    if (unlocked('wall-handstand-pushup')) give('first-handstand')
    if (streak >= 7) give('streak-7')
    if (streak >= 30) give('streak-30')
    if (totalReps >= 1000) give('volume-1000')
    if (anyL5) give('level-5')

    if (add.length) { set({ badges: [...earned] }); scheduleSave(get) }
    return add.map((id) => BADGES.find((b) => b.id === id)).filter(Boolean)
  },

  togglePlannedRestDay(weekdayIdx) {
    const cur = new Set(get().plannedRestDays)
    cur.has(weekdayIdx) ? cur.delete(weekdayIdx) : cur.add(weekdayIdx)
    set({ plannedRestDays: [...cur].sort() })
    scheduleSave(get)
  },

  // ---- AI gating ----
  canCallAi() {
    const s = get()
    if (s.ai.date !== dateKey()) return true
    return s.ai.count < AI_DAILY_CAP
  },
  aiCallsLeft() {
    const s = get()
    if (s.ai.date !== dateKey()) return AI_DAILY_CAP
    return Math.max(0, AI_DAILY_CAP - s.ai.count)
  },
  recordAiCall() {
    const s = get()
    const today = dateKey()
    const ai = s.ai.date === today ? { ...s.ai, count: s.ai.count + 1 } : { ...s.ai, date: today, count: 1 }
    set({ ai })
    scheduleSave(get)
  },
  cacheWeeklySummary(text) {
    set({ ai: { ...get().ai, weeklySummary: { week: weekKey(), text } } })
    scheduleSave(get)
  },

  // ---- Coach chat (persisted) ----
  addChatMessage(msg) {
    const m = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), ...msg }
    set({ chat: [...get().chat, m] })
    scheduleSave(get)
    return m
  },
  clearChat() {
    set({ chat: [] })
    scheduleSave(get)
  },

  resetAll() {
    set({ ...blank, hydrated: true })
    saveState(serializable(get()))
  },
}))

// ---- Selectors / helpers (pure, exported for components) ----

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

export function longestStreak(history) {
  const days = [...new Set(history.map((h) => h.date))].sort()
  let best = 0, run = 0, prev = null
  for (const day of days) {
    if (prev && daysBetween(prev, day) === 1) run += 1
    else run = 1
    best = Math.max(best, run)
    prev = day
  }
  return best
}

export function weeklyGoal(profile) {
  return (profile.daysPerWeek || 3) * WEEKLY_XP_GOAL_PER_DAY
}

export { tierForXp }
