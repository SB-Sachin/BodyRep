import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar,
} from 'recharts'
import { useStore, longestStreak } from '../store/useStore.js'
import { BADGES } from '../data/gamification.js'
import { getExercise } from '../data/exercises.js'
import { lastNDays, weekKey, dateKey } from '../utils/dates.js'

export default function Progress() {
  const profile = useStore((s) => s.profile)
  const weightLog = useStore((s) => s.weightLog)
  const history = useStore((s) => s.history)
  const progress = useStore((s) => s.progress)
  const badges = useStore((s) => s.badges)

  const weightData = weightLog.map((w) => ({ date: w.date.slice(5), weight: w.weight }))
  const weightDelta = weightLog.length >= 2 ? (weightLog.at(-1).weight - weightLog[0].weight).toFixed(1) : 0

  const weekly = useMemo(() => {
    const map = {}
    for (const h of history) {
      const wk = weekKey(new Date(h.date))
      map[wk] = (map[wk] || 0) + 1
    }
    const weeks = []
    const d = new Date()
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(d); ref.setDate(ref.getDate() - i * 7)
      const wk = weekKey(ref)
      weeks.push({ week: wk.slice(5), workouts: map[wk] || 0 })
    }
    return weeks
  }, [history])

  const bench = ['standard-pushup', 'pullup', 'chinup', 'parallel-bar-dip', 'bulgarian-split-squat']
    .map((id) => ({ ex: getExercise(id), best: progress.exercises?.[id]?.bestReps || 0 }))
    .filter((b) => b.best > 0)

  const totalReps = Object.values(progress.exercises || {}).reduce((a, e) => a + (e.totalReps || 0), 0)
  const longest = longestStreak(history)

  return (
    <div className="screen animate-fade-up pt-8">
      <h1 className="mb-4 text-2xl font-extrabold">Progress</h1>

      <div className="card mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">Body weight</h2>
          {weightLog.length >= 2 && (
            <span className={`pill ${weightDelta >= 0 ? 'bg-success/20 text-success' : 'bg-white/10 text-slate-300'}`}>
              {weightDelta >= 0 ? '+' : ''}{weightDelta} lbs
            </span>
          )}
        </div>
        {weightData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={weightData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis domain={['dataMin - 3', 'dataMax + 3']} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }} />
              {profile.targetWeight && <ReferenceLine y={profile.targetWeight} stroke="#fbbf24" strokeDasharray="4 4" />}
              <Line type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400">Log your weight weekly (Settings) to see the trend toward {profile.targetWeight || 'your target'}.</p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Lifetime reps" value={totalReps} />
        <Stat label="Workouts" value={history.length} />
        <Stat label="Longest streak" value={longest} />
      </div>

      <div className="card mb-4">
        <h2 className="mb-2 font-bold">Workouts per week</h2>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weekly} margin={{ top: 5, right: 8, bottom: 0, left: -28 }}>
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
            <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }} />
            <Bar dataKey="workouts" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card mb-4">
        <h2 className="mb-3 font-bold">Activity</h2>
        <StreakGrid history={history} />
      </div>

      {bench.length > 0 && (
        <div className="card mb-4">
          <h2 className="mb-2 font-bold">Strength benchmarks</h2>
          {bench.map((b) => (
            <div key={b.ex.id} className="flex items-center justify-between py-1 text-sm">
              <span className="text-slate-300">{b.ex.name}</span>
              <span className="font-bold text-accent">{b.best} reps</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 font-bold">Badges</h2>
        <div className="grid grid-cols-4 gap-3">
          {BADGES.map((b) => {
            const earned = badges.includes(b.id)
            return (
              <div key={b.id} className={`text-center ${earned ? '' : 'opacity-30 grayscale'}`} title={b.desc}>
                <div className="text-2xl">{b.icon}</div>
                <div className="text-[10px] text-slate-400">{b.name}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="card py-3 text-center">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  )
}

function StreakGrid({ history }) {
  const days = lastNDays(84)
  const set = new Set(history.map((h) => h.date))
  const today = dateKey()
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1">
      {days.map((d) => (
        <div key={d} title={d}
          className={`h-3.5 w-3.5 rounded-sm ${set.has(d) ? 'bg-accent' : 'bg-white/10'} ${d === today ? 'ring-1 ring-white/40' : ''}`} />
      ))}
    </div>
  )
}
