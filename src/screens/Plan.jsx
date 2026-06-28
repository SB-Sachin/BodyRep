import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { PROGRAMS } from '../data/programs.js'
import { resolveSchedule, relativeDayLabel } from '../engine/scheduleQueue.js'
import Icon from '../components/Icon.jsx'

export default function Plan() {
  const nav = useNavigate()
  const profile = useStore((s) => s.profile)
  const history = useStore((s) => s.history)
  const anchorDate = useStore((s) => s.scheduleAnchorDate)

  const program = PROGRAMS[profile.programId] || PROGRAMS.A
  const { days, missedDates } = resolveSchedule({ program, anchorDate, history, daysAhead: 7 })

  return (
    <div className="screen animate-fade-up pt-8">
      <header className="mb-5 flex items-center gap-3">
        <button className="btn-ghost px-2 py-2" aria-label="Back" onClick={() => nav('/')}>
          <Icon name="chevronLeft" size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your schedule</h1>
          <div className="text-sm text-slate-400">{program.name}</div>
        </div>
      </header>

      {missedDates.length > 0 && (
        <div className="card mb-4 border border-accent/30 bg-accent/10">
          <div className="flex items-center gap-2 text-sm text-accent">
            <Icon name="flag" size={18} />
            <span>
              Missed {missedDates.length} {missedDates.length === 1 ? 'day' : 'days'} — schedule pushed back by{' '}
              {missedDates.length} {missedDates.length === 1 ? 'day' : 'days'}.
            </span>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {days.map((d) => (
          <li key={d.date} className="card">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-400">
                {relativeDayLabel(d.offset, d.date)}
              </span>
              {!d.summary.isRest && (
                <span className={`pill ${d.summary.goal === 'strength' ? 'bg-gold/20 text-gold' : 'bg-accent/20 text-accent'}`}>
                  {d.summary.goal}
                </span>
              )}
            </div>
            {d.summary.isRest ? (
              <div className="flex items-center gap-2 text-slate-300">
                <Icon name="rest" size={18} />
                <span className="font-semibold">Rest day</span>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold">{d.summary.label}</h2>
                <p className="text-sm text-slate-400">{d.summary.focus}</p>
                <div className="mt-2 text-sm text-slate-300">
                  {d.summary.exercises} exercises · {d.summary.sets} sets · {d.summary.repBand} · {d.summary.restSeconds}s rest
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-center text-xs text-slate-500">
        Rep ranges vary per exercise — exact targets are set during the session.
      </p>
    </div>
  )
}
