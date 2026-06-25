// Gemini AI client. All responses are framed for muscle gain and strength — never
// fat loss, cutting, or calorie deficits (PRD). Rate limiting (5/day) and weekly-
// summary caching are enforced in the store; this module only builds context + calls.

import { getExercise } from '../data/exercises.js'
import { TREE_KEYS } from '../data/skillTrees.js'

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

// Build the per-call context block from the store state.
export function buildContext(state) {
  const { profile, progress } = state
  const lines = []
  lines.push(`Athlete: age ${profile.age ?? '?'}, height ${profile.height ?? '?'}, weight ${profile.weight ?? '?'}${profile.targetWeight ? `, target ${profile.targetWeight}` : ''}.`)
  lines.push(`Equipment today: ${(profile.equipment || ['none']).join(', ')}. Goal: muscle gain + functional strength.`)

  const levels = TREE_KEYS.map((k) => {
    const t = progress?.trees?.[k]
    if (!t) return `${k} L1`
    const ex = getExercise(t.activeId)
    return `${k} L${t.level} (${ex?.name || t.activeId})`
  })
  lines.push(`Skill levels: ${levels.join('; ')}.`)

  const wlog = (state.weightLog || []).slice(-4)
  if (wlog.length) {
    lines.push(`Body weight trend: ${wlog.map((w) => `${w.weight}`).join(' → ')}.`)
  }

  const recent = (state.history || []).slice(-7)
  if (recent.length) {
    const summary = recent
      .map((s) => `${s.date}: ${s.exercises.map((e) => getExercise(e.exerciseId)?.name || e.exerciseId).join(', ')}`)
      .join(' | ')
    lines.push(`Recent workouts: ${summary}.`)
  }
  return lines.join('\n')
}

async function call(userPrompt, state, { maxTokens = 256, temperature = 0.7 } = {}) {
  if (!aiConfigured()) {
    return { ok: false, error: 'no-key', text: 'Add your Gemini API key to enable AI coaching (see Settings).' }
  }
  if (!navigator.onLine) {
    return { ok: false, error: 'offline', text: 'AI coaching needs a connection. Your workout still works offline.' }
  }
  const context = buildContext(state)
  try {
    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${SYSTEM_BASE}\n\nAthlete data:\n${context}` }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `http-${res.status}`, text: `AI request failed (${res.status}). ${res.status === 429 ? 'Rate limit reached — try again later.' : ''}`.trim(), detail: body }
    }
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
    return { ok: true, text: text.trim() }
  } catch (e) {
    return { ok: false, error: 'network', text: 'Could not reach the AI service.' }
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
  return call(`Write my weekly summary. Stats: ${stats}. Mention strength milestones and body-weight progress toward muscle gain.`, state, { maxTokens: 300 })
}

export function askQuestion(state, question) {
  return call(question, state)
}

export function workoutVariation(state, dayType) {
  return call(`Suggest an alternate ${dayType} session using only my unlocked exercises and today's equipment. List exercises with sets and reps.`, state, { maxTokens: 300 })
}
