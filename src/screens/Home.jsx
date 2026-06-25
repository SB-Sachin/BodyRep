import { useNavigate } from 'react-router-dom'
import { useStore, computeStreak, weeklyGoal, tierForXp } from '../store/useStore.js'
import { PROGRAMS, sessionForToday } from '../data/programs.js'
import { nextTier } from '../data/gamification.js'
import { getExercise } from '../data/exercises.js'
import { dateKey } from '../utils/dates.js'
import Icon from '../components/Icon.jsx'

export default function Home() {
  const nav = useNavigate()
  const profile = useStore((s) => s.profile)
  const progress = useStore((s) => s.progress)
  const history = useStore((s) => s.history)
  const plannedRestDays = useStore((s) => s.plannedRestDays)
  const xp = useStore((s) => s.xp)
  const weeklyXp = useStore((s) => s.weeklyXp)

  const program = PROGRAMS[profile.programId] || PROGRAMS.A
  const today = sessionForToday(program)
  const weekdayIdx = (new Date().getDay() + 6) % 7
  const isPlannedRest = plannedRestDays.includes(weekdayIdx)
  const doneToday = history.some((h) => h.date === dateKey())

  const streak = computeStreak(history, plannedRestDays)
  const goal = weeklyGoal(profile)
  const pct = Math.min(100, Math.round((weeklyXp.xp / goal) * 100))
  const tier = tierForXp(xp)
  const nt = nextTier(xp)

  return (
    <div className="screen animate-fade-up pt-8">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          <h1 className="text-2xl font-extrabold tracking-tight">Ready to train?</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5">
          <Icon name="flame" size={18} className={streak > 0 ? 'text-accent' : 'text-slate-500'} />
          <span className="font-bold tnum">{streak}</span>
        </div>
      </header>

      <div className="card mb-4 flex items-center gap-4">
        <Ring pct={pct} />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-accent">{tier.name}</div>
          <div className="text-sm text-slate-300">{weeklyXp.xp} / {goal} XP this week</div>
          {nt && <div className="mt-1 text-xs text-slate-500">{nt.minXp - xp} XP to {nt.name}</div>}
        </div>
      </div>

      {today && !doneToday && !isPlannedRest && (
        <div className="card mb-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-bold">{today.label}</h2>
            <span className={`pill ${today.goal === 'strength' ? 'bg-gold/20 text-gold' : 'bg-accent/20 text-accent'}`}>
              {today.goal}
            </span>
          </div>
          <p className="mb-3 text-sm text-slate-400">{today.focus}</p>
          <PreviewTrees dayType={today.dayType} progress={progress} />
          <button className="btn-accent mt-4 w-full" onClick={() => nav('/session')}>Start workout</button>
        </div>
      )}

      {doneToday && (
        <div className="card mb-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success"><Icon name="check" size={26} strokeWidth={2.5} /></div>
          <h2 className="mt-2 text-lg font-bold">Workout complete</h2>
          <p className="text-sm text-slate-400">Nice work today. Recovery is where the muscle gets built.</p>
          <button className="btn-ghost mt-3 w-full" onClick={() => nav('/session')}>Train again (bonus)</button>
        </div>
      )}

      {!doneToday && (isPlannedRest || !today) && (
        <div className="card mb-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-slate-300"><Icon name="rest" size={26} /></div>
          <h2 className="mt-2 text-lg font-bold">Rest day</h2>
          <p className="text-sm text-slate-400">No session scheduled. Rest days don’t break your streak.</p>
          <button className="btn-ghost mt-3 w-full" onClick={() => nav('/session')}>Train anyway</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button className="card text-left transition active:scale-[0.98]" onClick={() => nav('/skills')}>
          <div className="text-accent"><Icon name="skills" size={24} /></div>
          <div className="mt-2 font-semibold">Skill Trees</div>
          <div className="text-xs text-slate-400">See your unlocks</div>
        </button>
        <button className="card text-left transition active:scale-[0.98]" onClick={() => nav('/progress')}>
          <div className="text-accent"><Icon name="progress" size={24} /></div>
          <div className="mt-2 font-semibold">Progress</div>
          <div className="text-xs text-slate-400">Weight & PRs</div>
        </button>
      </div>
    </div>
  )
}

function PreviewTrees({ dayType, progress }) {
  const trees = { 'full-push': ['push', 'core'], 'full-pull': ['pull', 'core'], 'full-legs': ['legs', 'core'],
    upper: ['push', 'pull'], lower: ['legs'], push: ['push'], pull: ['pull'], legs: ['legs'] }[dayType] || ['push']
  return (
    <div className="flex flex-wrap gap-2">
      {trees.map((t) => {
        const id = progress.trees?.[t]?.activeId
        const ex = id && getExercise(id)
        return <span key={t} className="pill bg-white/5 text-slate-300">{ex ? ex.name : t}</span>
      })}
    </div>
  )
}

function Ring({ pct }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="#f97316" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset .5s ease' }} />
      <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="700" fill="#e2e8f0">{pct}%</text>
    </svg>
  )
}
