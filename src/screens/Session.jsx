import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { PROGRAMS, sessionForToday } from '../data/programs.js'
import { generateSession } from '../engine/workoutEngine.js'
import { getExercise } from '../data/exercises.js'
import { EQUIPMENT_OPTIONS } from '../data/gamification.js'
import ExerciseDemo from '../components/ExerciseDemo.jsx'
import Icon from '../components/Icon.jsx'
import Complete from './Complete.jsx'

export default function Session() {
  const nav = useNavigate()
  const profile = useStore((s) => s.profile)
  const progress = useStore((s) => s.progress)
  const updateProfile = useStore((s) => s.updateProfile)

  const program = PROGRAMS[profile.programId] || PROGRAMS.A
  const today = sessionForToday(program)

  const [phase, setPhase] = useState('setup') // setup | play | complete
  const [equipment, setEquipment] = useState(profile.equipment || ['none'])
  const [length, setLength] = useState(profile.sessionLength || 30)
  const [conditioning, setConditioning] = useState(!!profile.conditioning)
  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState(null)

  const start = () => {
    updateProfile({ equipment, sessionLength: length, conditioning })
    const dayType = today?.dayType || 'full-push'
    const goal = today?.goal || 'hypertrophy'
    const s = generateSession({ progress, profile: { ...profile, programSets: program.setsPerExercise }, equipment, sessionLength: length, dayType, goal, conditioning })
    s.exercises = s.exercises.map((e) => ({ ...e, results: [] }))
    setSession(s)
    setPhase('play')
  }

  if (phase === 'setup') {
    return (
      <Setup
        today={today}
        equipment={equipment} setEquipment={setEquipment}
        length={length} setLength={setLength}
        conditioning={conditioning} setConditioning={setConditioning}
        onStart={start} onCancel={() => nav('/')}
      />
    )
  }

  if (phase === 'complete') return <Complete session={session} summary={summary} />

  return (
    <Player
      session={session}
      onAbort={() => nav('/')}
      onFinish={(filled) => {
        const result = useStore.getState().finishSession(filled)
        setSession(filled)
        setSummary(result)
        setPhase('complete')
      }}
    />
  )
}

function Setup({ today, equipment, setEquipment, length, setLength, conditioning, setConditioning, onStart, onCancel }) {
  const toggle = (id) => {
    const has = equipment.includes(id)
    let next = has ? equipment.filter((e) => e !== id) : [...equipment, id]
    if (next.length === 0) next = ['none']
    setEquipment(next)
  }
  return (
    <div className="screen animate-fade-up pt-10">
      <h1 className="mb-1 text-2xl font-extrabold">{today?.label || 'Bonus Workout'}</h1>
      <p className="mb-6 text-sm text-slate-400">{today?.focus || 'Full-body session'} · adjust today’s setup below.</p>

      <h3 className="mb-2 text-sm font-semibold text-slate-300">Equipment available now</h3>
      <div className="mb-6 grid grid-cols-2 gap-2">
        {EQUIPMENT_OPTIONS.map((e) => (
          <button key={e.id} onClick={() => toggle(e.id)}
            className={`rounded-xl border p-3 text-left text-sm ${equipment.includes(e.id) ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/5'}`}>
            {e.icon} {e.label}
          </button>
        ))}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-slate-300">Session length</h3>
      <div className="mb-6 flex gap-2">
        {[15, 30, 45].map((m) => (
          <button key={m} onClick={() => setLength(m)}
            className={`flex-1 rounded-xl border p-3 text-sm font-semibold ${length === m ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 bg-white/5'}`}>
            {m} min
          </button>
        ))}
      </div>

      <label className="mb-8 flex items-center justify-between card">
        <div>
          <div className="font-semibold">Conditioning mode</div>
          <div className="text-xs text-slate-400">Shorter 60s rests for a faster session</div>
        </div>
        <input type="checkbox" checked={conditioning} onChange={(e) => setConditioning(e.target.checked)} className="h-5 w-5 accent-accent" />
      </label>

      <div className="flex gap-3">
        <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn-accent flex-[2]" onClick={onStart}>Begin</button>
      </div>
    </div>
  )
}

function Player({ session, onFinish, onAbort }) {
  const [exIndex, setExIndex] = useState(0)
  const [data, setData] = useState(() => session.exercises.map(() => []))
  const [resting, setResting] = useState(false)
  const [restLeft, setRestLeft] = useState(0)
  const timerRef = useRef(null)

  const ex = session.exercises[exIndex]
  const meta = getExercise(ex.exerciseId)
  const setsDone = data[exIndex].length
  const isTime = ex.target.type === 'time'
  const defaultVal = isTime ? ex.target.seconds : ex.target.max
  const [val, setVal] = useState(defaultVal)

  useEffect(() => { setVal(defaultVal) }, [exIndex, defaultVal])

  useEffect(() => {
    if (!resting) return
    timerRef.current = setInterval(() => {
      setRestLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); setResting(false); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [resting])

  const logSet = (feedback) => {
    const entry = isTime ? { seconds: Number(val) } : { reps: Number(val) }
    if (feedback) entry.feedback = feedback
    const next = data.map((arr, i) => (i === exIndex ? [...arr, entry] : arr))
    setData(next)
    if (next[exIndex].length < ex.sets) {
      setRestLeft(ex.rest)
      setResting(true)
    }
  }

  const nextExercise = () => {
    if (exIndex < session.exercises.length - 1) {
      setExIndex(exIndex + 1)
      setResting(false)
    } else {
      const filled = { ...session, exercises: session.exercises.map((e, i) => ({ ...e, results: data[i] })) }
      onFinish(filled)
    }
  }

  const allSetsDone = setsDone >= ex.sets
  const progressPct = Math.round(((exIndex + setsDone / ex.sets) / session.exercises.length) * 100)

  return (
    <div className="screen animate-fade-up pt-8">
      <div className="mb-4 flex items-center justify-between">
        <button className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200" onClick={onAbort}><Icon name="x" size={16} /> Quit</button>
        <div className="text-sm font-semibold tnum text-slate-400">Exercise {exIndex + 1} / {session.exercises.length}</div>
      </div>
      <div className="mb-5 h-1.5 w-full rounded-full bg-white/10">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {resting ? (
        <RestTimer left={restLeft} total={ex.rest} onSkip={() => { clearInterval(timerRef.current); setResting(false) }} nextLabel={meta.name} setNum={setsDone + 1} totalSets={ex.sets} />
      ) : (
        <>
          <div className="card mb-4 text-center">
            <ExerciseDemo exercise={meta} />
            <h1 className="mt-2 text-xl font-extrabold">{meta.name}</h1>
            <div className="mt-1 text-sm text-slate-400">
              Set {Math.min(setsDone + 1, ex.sets)} of {ex.sets} ·{' '}
              {isTime ? `${ex.target.seconds}s hold` : `${ex.target.min}-${ex.target.max} reps`}{ex.perSide ? ' / side' : ''}
            </div>
            <p className="mt-3 text-sm text-slate-300">{meta.description}</p>
          </div>

          {!allSetsDone ? (
            <div className="card mb-4">
              <div className="mb-3 text-center text-sm text-slate-400">How many {isTime ? 'seconds' : 'reps'} did you complete?</div>
              <div className="mb-4 flex items-center justify-center gap-4">
                <button aria-label="Decrease" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 active:scale-95" onClick={() => setVal((v) => Math.max(0, Number(v) - 1))}><Icon name="minus" size={20} /></button>
                <input type="number" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)}
                  className="w-24 bg-transparent text-center text-5xl font-extrabold tnum outline-none" />
                <button aria-label="Increase" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 active:scale-95" onClick={() => setVal((v) => Number(v) + 1)}><Icon name="plus" size={20} /></button>
              </div>
              <button className="btn-accent w-full" onClick={() => logSet()}>Log set</button>
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost flex-1 text-xs" onClick={() => logSet('easy')}>Too easy</button>
                <button className="btn-ghost flex-1 text-xs" onClick={() => logSet('hard')}>Too hard</button>
              </div>
            </div>
          ) : (
            <button className="btn-accent mb-4 w-full" onClick={nextExercise}>
              {exIndex < session.exercises.length - 1 ? <>Next exercise <Icon name="arrowRight" size={18} /></> : <>Finish workout <Icon name="flag" size={18} /></>}
            </button>
          )}

          <FormCues meta={meta} />
        </>
      )}
    </div>
  )
}

function RestTimer({ left, total, onSkip, nextLabel, setNum, totalSets }) {
  const pct = total ? (left / total) * 100 : 0
  return (
    <div className="card flex flex-col items-center py-10">
      <div className="text-sm uppercase tracking-wide text-slate-400">Rest</div>
      <div className="my-4 text-6xl font-extrabold tabular-nums">{left}s</div>
      <div className="mb-6 h-1.5 w-40 rounded-full bg-white/10">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mb-4 text-sm text-slate-400">Next: {nextLabel} · set {setNum} of {totalSets}</div>
      <button className="btn-accent w-40" onClick={onSkip}>Skip rest</button>
    </div>
  )
}

function FormCues({ meta }) {
  return (
    <div className="card">
      <h3 className="mb-2 text-sm font-bold text-accent">Form cues</h3>
      <ul className="space-y-1 text-sm text-slate-300">
        {meta.formCues.map((c, i) => <li key={i} className="flex gap-2"><span className="text-accent">•</span>{c}</li>)}
      </ul>
      {meta.mistakes?.length > 0 && (
        <>
          <h3 className="mb-1 mt-3 text-sm font-bold text-danger">Avoid</h3>
          <ul className="space-y-1 text-sm text-slate-400">
            {meta.mistakes.map((c, i) => <li key={i} className="flex gap-2"><span className="mt-0.5 shrink-0 text-danger"><Icon name="x" size={14} strokeWidth={2.5} /></span>{c}</li>)}
          </ul>
        </>
      )}
    </div>
  )
}
