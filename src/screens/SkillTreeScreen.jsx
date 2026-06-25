import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { SKILL_TREES, TREE_KEYS, describeThreshold } from '../data/skillTrees.js'
import { getExercise } from '../data/exercises.js'
import ExerciseDemo from '../components/ExerciseDemo.jsx'

export default function SkillTreeScreen() {
  const progress = useStore((s) => s.progress)
  const [tab, setTab] = useState('push')
  const [detail, setDetail] = useState(null)

  const tree = SKILL_TREES[tab]
  const treeState = progress.trees?.[tab] || { level: 1, activeId: null }

  return (
    <div className="screen pt-8">
      <h1 className="mb-1 text-2xl font-extrabold">Skill Trees</h1>
      <p className="mb-4 text-sm text-slate-400">Earn the next variation by hitting its threshold on 2 sessions in a row.</p>

      <div className="mb-5 flex gap-2">
        {TREE_KEYS.map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize ${tab === k ? 'text-ink' : 'bg-white/5 text-slate-300'}`}
            style={tab === k ? { background: SKILL_TREES[k].color } : undefined}>
            {SKILL_TREES[k].label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tree.levels.map((lvl) => {
          const unlocked = lvl.level <= treeState.level
          return (
            <div key={lvl.level} className={`card ${unlocked ? '' : 'opacity-50'}`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: tree.color }}>Level {lvl.level} · {lvl.name}</span>
                {!unlocked && <span className="pill bg-white/5 text-slate-500">🔒 Locked</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {lvl.exercises.map((id) => {
                  const ex = getExercise(id)
                  const isActive = treeState.activeId === id
                  const eState = progress.exercises?.[id]
                  return (
                    <button key={id} onClick={() => setDetail(id)}
                      className={`rounded-xl border p-2 text-left text-sm ${isActive ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/5'}`}>
                      <div className="font-semibold leading-tight">{ex.name}</div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                        <span>{'★'.repeat(ex.difficulty)}</span>
                        {isActive && <span className="text-accent">• current</span>}
                      </div>
                      {eState?.bestReps > 0 && <div className="text-[11px] text-slate-500">PR {eState.bestReps}</div>}
                      {eState?.bestSeconds > 0 && <div className="text-[11px] text-slate-500">PR {eState.bestSeconds}s</div>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {detail && <DetailSheet id={detail} progress={progress} onClose={() => setDetail(null)} />}
    </div>
  )
}

function DetailSheet({ id, progress, onClose }) {
  const ex = getExercise(id)
  const eState = progress.exercises?.[id]
  const threshold = describeThreshold(id, ex)
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-surface p-5 safe-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <ExerciseDemo exercise={ex} size={96} />
        <h2 className="mt-2 text-center text-xl font-extrabold">{ex.name}</h2>
        <div className="mb-3 text-center text-xs text-slate-400">
          {'★'.repeat(ex.difficulty)} · {ex.muscles.primary.join(', ')}
        </div>
        <p className="mb-3 text-sm text-slate-300">{ex.description}</p>

        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <Stat label="Lifetime reps" value={eState?.totalReps || 0} />
          <Stat label="Best set" value={eState?.bestReps ? `${eState.bestReps} reps` : eState?.bestSeconds ? `${eState.bestSeconds}s` : '—'} />
        </div>

        {threshold && (
          <div className="mb-3 rounded-xl bg-accent/10 p-3 text-xs text-accent">
            <b>To advance:</b> {threshold} {eState?.consecutiveHits ? `(${eState.consecutiveHits}/2 done)` : ''}
          </div>
        )}

        <div className="mb-2 text-sm font-bold text-accent">Form cues</div>
        <ul className="mb-3 space-y-1 text-sm text-slate-300">
          {ex.formCues.map((c, i) => <li key={i}>• {c}</li>)}
        </ul>
        <button className="btn-accent w-full" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  )
}
