import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, computeStreak } from '../store/useStore.js'
import { getExercise } from '../data/exercises.js'
import { SKILL_TREES } from '../data/skillTrees.js'
import { coachingNotes, aiConfigured } from '../ai/gemini.js'
import Icon from '../components/Icon.jsx'

export default function Complete({ session, summary }) {
  const nav = useNavigate()
  const history = useStore((s) => s.history)
  const plannedRestDays = useStore((s) => s.plannedRestDays)
  const streak = computeStreak(history, plannedRestDays)

  const [notes, setNotes] = useState(null)
  const [loadingNotes, setLoadingNotes] = useState(false)

  const getCoaching = async () => {
    const store = useStore.getState()
    if (!store.canCallAi()) { setNotes('You’ve used today’s AI messages. Your progress is still tracked.'); return }
    setLoadingNotes(true)
    const res = await coachingNotes(store, session)
    if (res.ok) store.recordAiCall()
    setNotes(res.text)
    setLoadingNotes(false)
  }

  return (
    <div className="screen animate-fade-up pt-12 text-center">
      <div className="mx-auto mb-3 flex h-16 w-16 animate-pop items-center justify-center rounded-full bg-accent text-white shadow-glow">
        <Icon name="check" size={36} strokeWidth={3} />
      </div>
      <h1 className="text-3xl font-extrabold uppercase">Workout complete</h1>
      <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-slate-400">
        {summary.setsCompleted} sets done
        <span className="text-slate-600">·</span>
        <Icon name="flame" size={15} className="text-accent" /> {streak}-day streak
      </p>

      <div className="card my-5 bg-gradient-to-br from-accent/20 to-surface">
        <div className="text-xs uppercase tracking-widest text-accent2">XP earned</div>
        <div className="text-5xl font-extrabold tnum text-white">+{summary.xpEarned}</div>
      </div>

      {summary.advancements.length > 0 && (
        <div className="card mb-4 text-left">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-gold"><Icon name="zap" size={18} /> New unlocks</h3>
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
          <h3 className="mb-2 flex items-center gap-2 font-bold text-success"><Icon name="trophy" size={18} /> New personal records</h3>
          {summary.prs.map((p, i) => (
            <div key={i} className="text-sm">
              {getExercise(p.exerciseId)?.name}: <b>{p.reps ? `${p.reps} reps` : `${p.seconds}s`}</b>
            </div>
          ))}
        </div>
      )}

      {summary.newBadges.length > 0 && (
        <div className="card mb-4 text-left">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-gold"><Icon name="trophy" size={18} /> Badges earned</h3>
          {summary.newBadges.map((b) => (
            <div key={b.id} className="text-sm">{b.icon} <b>{b.name}</b> — {b.desc}</div>
          ))}
        </div>
      )}

      <div className="card mb-6 text-left">
        <h3 className="mb-2 flex items-center gap-2 font-bold"><Icon name="sparkle" size={18} className="text-accent" /> Coach’s notes</h3>
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
