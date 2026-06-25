import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, computeStreak } from '../store/useStore.js'
import { getExercise } from '../data/exercises.js'
import { SKILL_TREES } from '../data/skillTrees.js'
import { coachingNotes, aiConfigured } from '../ai/gemini.js'

export default function Complete({ session, summary }) {
  const nav = useNavigate()
  const history = useStore((s) => s.history)
  const plannedRestDays = useStore((s) => s.plannedRestDays)
  const streak = computeStreak(history, plannedRestDays)

  const [notes, setNotes] = useState(null)
  const [loadingNotes, setLoadingNotes] = useState(false)

  const getCoaching = async () => {
    const store = useStore.getState()
    if (!store.canCallAi()) { setNotes('Daily AI limit reached (5/day). Your progress is still tracked.'); return }
    setLoadingNotes(true)
    const res = await coachingNotes(store, session)
    if (res.ok) store.recordAiCall()
    setNotes(res.text)
    setLoadingNotes(false)
  }

  return (
    <div className="screen pt-12 text-center">
      <div className="text-5xl">🎉</div>
      <h1 className="mt-2 text-2xl font-extrabold">Workout complete!</h1>
      <p className="text-sm text-slate-400">{summary.setsCompleted} sets done · 🔥 {streak}-day streak</p>

      <div className="card my-5">
        <div className="text-xs uppercase tracking-wide text-slate-400">XP earned</div>
        <div className="text-4xl font-extrabold text-accent">+{summary.xpEarned}</div>
      </div>

      {summary.advancements.length > 0 && (
        <div className="card mb-4 text-left">
          <h3 className="mb-2 font-bold text-gold">⬆️ New unlocks</h3>
          {summary.advancements.map((a, i) => {
            const ex = getExercise(a.newExerciseId)
            return (
              <div key={i} className="mb-1 text-sm">
                <span className="font-semibold">{ex?.name}</span>
                <span className="text-slate-400"> · {SKILL_TREES[a.treeKey].label}{a.leveledUp ? ` Level up!` : ''}</span>
              </div>
            )
          })}
        </div>
      )}

      {summary.prs.length > 0 && (
        <div className="card mb-4 text-left">
          <h3 className="mb-2 font-bold text-success">🏆 New personal records</h3>
          {summary.prs.map((p, i) => (
            <div key={i} className="text-sm">
              {getExercise(p.exerciseId)?.name}: <b>{p.reps ? `${p.reps} reps` : `${p.seconds}s`}</b>
            </div>
          ))}
        </div>
      )}

      {summary.newBadges.length > 0 && (
        <div className="card mb-4 text-left">
          <h3 className="mb-2 font-bold text-gold">🎖️ Badges earned</h3>
          {summary.newBadges.map((b) => (
            <div key={b.id} className="text-sm">{b.icon} <b>{b.name}</b> — {b.desc}</div>
          ))}
        </div>
      )}

      <div className="card mb-6 text-left">
        <h3 className="mb-2 font-bold">🤖 Coach’s notes</h3>
        {notes ? (
          <p className="text-sm text-slate-300">{notes}</p>
        ) : aiConfigured() ? (
          <button className="btn-ghost w-full" onClick={getCoaching} disabled={loadingNotes}>
            {loadingNotes ? 'Thinking…' : 'Get coaching feedback'}
          </button>
        ) : (
          <p className="text-sm text-slate-400">Add your Gemini API key in Settings to unlock AI coaching.</p>
        )}
      </div>

      <button className="btn-accent w-full" onClick={() => nav('/')}>Done</button>
    </div>
  )
}
