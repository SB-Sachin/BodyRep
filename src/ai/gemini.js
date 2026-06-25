// Gemini AI client. All responses are framed for muscle gain and strength — never
// fat loss, cutting, or calorie deficits (PRD). Rate limiting (5/day) and weekly-
// summary caching are enforced in the store; this module only builds context + calls.

import { getExercise } from '../data/exercises.js'
import { TREE_KEYS, SKILL_TREES, ADVANCEMENT } from '../data/skillTrees.js'
import { tierForXp, BADGES } from '../data/gamification.js'
import { computeStreak, weeklyGoal } from '../store/useStore.js'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export function aiConfigured() {
  return !!API_KEY && API_KEY !== 'your_key_here'
}

const SYSTEM_BASE = `You are BodyRep's strength coach for a teenage athlete whose goal is to GAIN muscle and build functional strength through bodyweight calisthenics.
Rules:
- Always frame advice around muscle gain, strength, and a caloric SURPLUS. Never mention fat loss, cutting, dieting, or calorie deficits.
- Be specific, encouraging, and grounded in the athlete's actual data below.
- Keep every response under 150 words. No markdown headers.
- Emphasize good form and controlled tempo before adding difficulty (teen safety).`

// Build the per-call context block from the store state. Includes the full
// athlete picture so the coach can be specific: setup, every skill tree with its
// next advancement target, gamification state, body-weight trend, and recent logs.
export function buildContext(state) {
  const { profile, progress } = state
  const lines = []

  // Identity & program setup
  lines.push(`Athlete: age ${profile.age ?? '?'}, height ${profile.height ?? '?'}cm, weight ${profile.weight ?? '?'}kg${profile.targetWeight ? ` (target ${profile.targetWeight}kg)` : ''}, self-rated level: ${profile.fitnessLevel || 'beginner'}.`)
  lines.push(`Program: ${profile.daysPerWeek || 3} days/week, ${profile.sessionLength || 30}-min sessions, ${profile.programSets || 3} sets/exercise. Equipment available: ${(profile.equipment || ['none']).join(', ')}.`)
  lines.push('Primary goal: GAIN muscle and build functional strength on a caloric surplus.')

  // Skill trees — current exercise, best, and the next variation to unlock.
  for (const k of TREE_KEYS) {
    const t = progress?.trees?.[k]
    if (!t) continue
    const ex = getExercise(t.activeId)
    const eState = progress.exercises?.[t.activeId] || {}
    let line = `${SKILL_TREES[k].label} L${t.level} — current: ${ex?.name || t.activeId}`
    line += ex?.timeBased?.seconds ? ` (best hold ${eState.bestSeconds || 0}s)` : ` (best ${eState.bestReps || 0} reps)`
    const harder = ex?.harder ? getExercise(ex.harder) : null
    if (harder) {
      const thr = ADVANCEMENT[t.activeId]
      line += `; next unlock: ${harder.name}`
      if (thr) line += ` (needs ${thr.sets}×${thr.reps}, 2 sessions in a row — ${eState.consecutiveHits || 0}/2 done)`
    } else {
      line += '; at the top of this tree'
    }
    lines.push(line)
  }

  // Gamification state
  const tier = tierForXp(state.xp || 0)
  lines.push(`Progress: ${state.xp || 0} XP${tier?.name ? ` (${tier.name})` : ''}; this week ${state.weeklyXp?.xp || 0}/${weeklyGoal(profile)} XP goal; current streak ${computeStreak(state.history || [], state.plannedRestDays || [])} days.`)
  const badges = (state.badges || []).map((id) => BADGES.find((b) => b.id === id)?.name).filter(Boolean)
  if (badges.length) lines.push(`Badges earned: ${badges.join(', ')}.`)

  // Body-weight trend
  const wlog = (state.weightLog || []).slice(-5)
  if (wlog.length) lines.push(`Body weight trend (kg): ${wlog.map((w) => w.weight).join(' → ')}.`)

  // Recent training log (last 7 sessions, with actual reps/holds)
  const recent = (state.history || []).slice(-7)
  if (recent.length) {
    const summary = recent.map((s) => {
      const ex = s.exercises.map((e) => {
        const r = (e.results || []).map((x) => x.reps ?? `${x.seconds}s`).join('/')
        return `${getExercise(e.exerciseId)?.name || e.exerciseId} ${r}`.trim()
      }).join(', ')
      return `${s.date} [${s.dayType}/${s.goal}]: ${ex}`
    }).join(' | ')
    lines.push(`Last ${recent.length} workouts: ${summary}.`)
  } else {
    lines.push('No workouts logged yet — this athlete is just starting.')
  }

  return lines.join('\n')
}

// `turns` is either a single user-prompt string, or a multi-turn array of
// { role: 'user' | 'ai', text } objects (conversation history). Thinking is
// disabled (thinkingBudget: 0) — gemini-2.5-flash otherwise spends the whole
// output budget on hidden reasoning and truncates the actual reply.
async function call(turns, state, { maxTokens = 1024, temperature = 0.7 } = {}) {
  if (!aiConfigured()) {
    return { ok: false, error: 'no-key', text: 'Add your Gemini API key to enable AI coaching (see Settings).' }
  }
  if (!navigator.onLine) {
    return { ok: false, error: 'offline', text: 'AI coaching needs a connection. Your workout still works offline.' }
  }
  const context = buildContext(state)
  const list = typeof turns === 'string' ? [{ role: 'user', text: turns }] : turns
  const contents = list.map((t) => ({
    role: t.role === 'ai' ? 'model' : 'user',
    parts: [{ text: t.text }],
  }))
  try {
    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${SYSTEM_BASE}\n\nAthlete data:\n${context}` }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature, thinkingConfig: { thinkingBudget: 0 } },
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `http-${res.status}`, text: `AI request failed (${res.status}). ${res.status === 429 ? 'Daily rate limit reached — try again later.' : 'Please try again.'}`.trim(), detail: body }
    }
    const data = await res.json()
    const text = (data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '').trim()
    if (!text) {
      return { ok: false, error: 'empty', text: 'The coach didn’t return a reply — try rephrasing, or ask again.' }
    }
    return { ok: true, text }
  } catch (e) {
    return { ok: false, error: 'network', text: 'Could not reach the AI service. Check your connection and try again.' }
  }
}

// ---- The five AI use cases (PRD) ----

export function coachingNotes(state, session) {
  const done = session.exercises
    .map((e) => `${getExercise(e.exerciseId)?.name}: ${e.results?.map((r) => r.reps ?? `${r.seconds}s`).join('/')}`)
    .join('; ')
  return call(`I just finished this workout: ${done}. Give me 2-3 sentences of specific coaching feedback for next time.`, state)
}

export function formAdvice(state, exerciseId, note) {
  const ex = getExercise(exerciseId)
  return call(`I flagged "${ex?.name}" as ${note || 'difficult'}. My current form cues are: ${ex?.formCues.join(' ')}. Give targeted tips for my level.`, state)
}

export function weeklySummary(state, stats) {
  return call(`Write my weekly summary. Stats: ${stats}. Mention strength milestones and body-weight progress toward muscle gain.`, state, { maxTokens: 1024 })
}

// `history` is prior conversation: [{ role: 'user' | 'ai', text }]. Passing it
// gives the coach memory of the chat so follow-up questions stay on-topic.
export function askQuestion(state, question, history = []) {
  return call([...history, { role: 'user', text: question }], state)
}

export function workoutVariation(state, dayType) {
  return call(`Suggest an alternate ${dayType} session using only my unlocked exercises and today's equipment. List exercises with sets and reps.`, state, { maxTokens: 1024 })
}
