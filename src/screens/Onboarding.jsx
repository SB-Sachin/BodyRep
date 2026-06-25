import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { EQUIPMENT_OPTIONS, FITNESS_LEVELS } from '../data/gamification.js'
import { programForDays } from '../data/programs.js'

const STEPS = ['About you', 'Body', 'Experience', 'Equipment', 'Schedule', 'Baseline']

export default function Onboarding() {
  const complete = useStore((s) => s.completeOnboarding)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    age: 15, height: '', weight: '', targetWeight: '',
    fitnessLevel: 'beginner', equipment: ['none'], daysPerWeek: 3,
    maxPushups: 0, maxPullups: 0,
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const toggleEquip = (id) => {
    const has = form.equipment.includes(id)
    let next = has ? form.equipment.filter((e) => e !== id) : [...form.equipment, id]
    if (next.length === 0) next = ['none']
    set({ equipment: next })
  }

  const last = step === STEPS.length - 1
  const next = () => (last ? finish() : setStep(step + 1))
  const finish = () => complete({
    ...form,
    age: Number(form.age) || null,
    height: form.height || null,
    weight: form.weight ? Number(form.weight) : null,
    targetWeight: form.targetWeight ? Number(form.targetWeight) : null,
    maxPushups: Number(form.maxPushups) || 0,
    maxPullups: Number(form.maxPullups) || 0,
  })

  const program = programForDays(form.daysPerWeek)

  return (
    <div className="screen animate-fade-up pt-10">
      <div className="mb-2 text-4xl font-extrabold uppercase tracking-tight">Body<span className="text-accent">Rep</span></div>
      <p className="mb-6 text-sm text-slate-400">Build visible muscle and real strength with bodyweight training. Let’s set you up.</p>

      <div className="mb-6 flex gap-1.5">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-white/10'}`} />
        ))}
      </div>

      <div className="card min-h-[300px]">
        <h2 className="mb-4 text-lg font-bold">{STEPS[step]}</h2>

        {step === 0 && (
          <Field label="Age">
            <NumberInput value={form.age} onChange={(v) => set({ age: v })} min={10} max={80} />
            <p className="mt-2 text-xs text-slate-400">BodyRep is tuned for teen athletes. Training is safe with good form and appropriate load.</p>
          </Field>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Height">
              <input className="input" placeholder={'e.g. 5\'9" or 175cm'} value={form.height}
                onChange={(e) => set({ height: e.target.value })} />
            </Field>
            <Field label="Current weight (lbs)">
              <NumberInput value={form.weight} onChange={(v) => set({ weight: v })} placeholder="140" />
            </Field>
            <Field label="Target weight (optional)">
              <NumberInput value={form.targetWeight} onChange={(v) => set({ targetWeight: v })} placeholder="160" />
            </Field>
            <p className="text-xs text-slate-400">We track weight over time. Rising weight + rising strength means the plan is working.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            {FITNESS_LEVELS.map((l) => (
              <Choice key={l.id} active={form.fitnessLevel === l.id} onClick={() => set({ fitnessLevel: l.id })}
                title={l.label} subtitle={l.desc} />
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <p className="mb-2 text-xs text-slate-400">Pick everything you have access to. You can change this before any workout.</p>
            {EQUIPMENT_OPTIONS.map((e) => (
              <Choice key={e.id} active={form.equipment.includes(e.id)} onClick={() => toggleEquip(e.id)}
                title={`${e.icon} ${e.label}`} multi />
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2">
            <p className="mb-2 text-xs text-slate-400">How many days per week will you train?</p>
            {[3, 4, 5, 6].map((d) => (
              <Choice key={d} active={form.daysPerWeek === d} onClick={() => set({ daysPerWeek: d })}
                title={`${d} days`} subtitle={programForDays(d).name} />
            ))}
            <div className="mt-3 rounded-xl bg-accent/10 p-3 text-xs text-accent">
              You’ll start on <b>{program.name}</b> — {program.note}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">A quick baseline places you at the right skill level so you don’t start at zero.</p>
            <Field label="Max push-ups in a row">
              <NumberInput value={form.maxPushups} onChange={(v) => set({ maxPushups: v })} placeholder="0" />
            </Field>
            <Field label="Max pull-ups / chin-ups in a row">
              <NumberInput value={form.maxPullups} onChange={(v) => set({ maxPullups: v })} placeholder="0" />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        {step > 0 && <button className="btn-ghost flex-1" onClick={() => setStep(step - 1)}>Back</button>}
        <button className="btn-accent flex-[2]" onClick={next}>{last ? 'Start training' : 'Continue'}</button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      {children}
    </label>
  )
}

function NumberInput({ value, onChange, ...rest }) {
  return (
    <input type="number" inputMode="numeric" className="input" value={value}
      onChange={(e) => onChange(e.target.value)} {...rest} />
  )
}

function Choice({ active, onClick, title, subtitle, multi }) {
  return (
    <button onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
        active ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/5'
      }`}>
      <div>
        <div className="font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
      </div>
      <div className={`h-5 w-5 ${multi ? 'rounded' : 'rounded-full'} border-2 ${active ? 'border-accent bg-accent' : 'border-white/30'}`} />
    </button>
  )
}
