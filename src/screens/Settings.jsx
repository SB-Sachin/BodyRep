import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { PROGRAMS } from '../data/programs.js'
import { EQUIPMENT_OPTIONS } from '../data/gamification.js'
import { aiConfigured } from '../ai/gemini.js'
import { exportData, importData } from '../db/db.js'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Settings() {
  const profile = useStore((s) => s.profile)
  const update = useStore((s) => s.updateProfile)
  const logWeight = useStore((s) => s.logWeight)
  const plannedRestDays = useStore((s) => s.plannedRestDays)
  const togglePlannedRestDay = useStore((s) => s.togglePlannedRestDay)
  const resetAll = useStore((s) => s.resetAll)

  const [w, setW] = useState('')
  const [msg, setMsg] = useState('')

  const program = PROGRAMS[profile.programId] || PROGRAMS.A

  const toggleEquip = (id) => {
    const has = profile.equipment.includes(id)
    let next = has ? profile.equipment.filter((e) => e !== id) : [...profile.equipment, id]
    if (next.length === 0) next = ['none']
    update({ equipment: next })
  }

  const doExport = async () => {
    const json = await exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bodyrep-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        await importData(reader.result)
        setMsg('Import complete — reloading.')
        setTimeout(() => location.reload(), 800)
      } catch {
        setMsg('Could not read that file.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="screen pt-8">
      <h1 className="mb-4 text-2xl font-extrabold">Settings</h1>

      <Section title="Log body weight">
        <div className="flex gap-2">
          <input type="number" inputMode="decimal" placeholder={`Current: ${profile.weight ?? '—'} lbs`}
            className="flex-1 rounded-xl bg-white/6 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
            value={w} onChange={(e) => setW(e.target.value)} />
          <button className="btn-accent" onClick={() => { if (w) { logWeight(w); setW(''); setMsg('Weight logged.') } }}>Log</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Log weekly. Goal: steady gain toward {profile.targetWeight || 'your target'}.</p>
      </Section>

      <Section title="Training schedule">
        <div className="mb-3 flex gap-2">
          {[3, 4, 5, 6].map((d) => (
            <button key={d} onClick={() => update({ daysPerWeek: d })}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${profile.daysPerWeek === d ? 'bg-accent text-ink' : 'bg-white/5 text-slate-300'}`}>
              {d}d
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">Program: <b>{program.name}</b> — {program.note}</p>
      </Section>

      <Section title="Default session length">
        <div className="flex gap-2">
          {[15, 30, 45].map((m) => (
            <button key={m} onClick={() => update({ sessionLength: m })}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${profile.sessionLength === m ? 'bg-accent text-ink' : 'bg-white/5 text-slate-300'}`}>
              {m} min
            </button>
          ))}
        </div>
      </Section>

      <Section title="Default equipment">
        <div className="grid grid-cols-2 gap-2">
          {EQUIPMENT_OPTIONS.map((e) => (
            <button key={e.id} onClick={() => toggleEquip(e.id)}
              className={`rounded-xl border p-2.5 text-left text-sm ${profile.equipment.includes(e.id) ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/5'}`}>
              {e.icon} {e.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Planned rest days">
        <p className="mb-2 text-xs text-slate-400">Marked days won’t break your streak.</p>
        <div className="flex gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <button key={d} onClick={() => togglePlannedRestDay(i)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold ${plannedRestDays.includes(i) ? 'bg-gold text-ink' : 'bg-white/5 text-slate-300'}`}>
              {d}
            </button>
          ))}
        </div>
      </Section>

      <Section title="AI coaching">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Gemini API key</span>
          <span className={`pill ${aiConfigured() ? 'bg-success/20 text-success' : 'bg-white/10 text-slate-400'}`}>
            {aiConfigured() ? 'Connected' : 'Not set'}
          </span>
        </div>
        {!aiConfigured() && (
          <p className="mt-2 text-xs text-slate-400">
            Add <code className="text-accent">VITE_GEMINI_API_KEY</code> to a <code>.env</code> file (local) or your
            Vercel/Netlify environment variables, then rebuild. Get a free key at aistudio.google.com.
          </p>
        )}
      </Section>

      <Section title="Your data">
        <div className="flex gap-2">
          <button className="btn-ghost flex-1 text-sm" onClick={doExport}>Export JSON</button>
          <label className="btn-ghost flex-1 cursor-pointer text-center text-sm">
            Import
            <input type="file" accept="application/json" className="hidden" onChange={doImport} />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-400">All data lives on this device. Export regularly so history is never lost if the browser clears storage.</p>
      </Section>

      {msg && <div className="mb-4 rounded-xl bg-success/15 p-3 text-sm text-success">{msg}</div>}

      <button className="btn w-full bg-danger/20 text-danger" onClick={() => {
        if (confirm('Reset everything? This erases all progress on this device.')) resetAll()
      }}>Reset all data</button>

      <p className="mt-6 text-center text-xs text-slate-600">BodyRep v1.0 · Add to Home Screen for the full app experience.</p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card mb-4">
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </div>
  )
}
