import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { askQuestion, weeklySummary, aiConfigured } from '../ai/gemini.js'
import { weekKey } from '../utils/dates.js'

const SUGGESTIONS = [
  'How do I get my first pull-up?',
  'Is my volume enough to grow?',
  'What should I eat to gain weight?',
]

export default function Chat() {
  const callsLeft = useStore((s) => s.aiCallsLeft())
  const ai = useStore((s) => s.ai)
  const progress = useStore((s) => s.progress)
  const history = useStore((s) => s.history)

  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q) return
    const store = useStore.getState()
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text: q }])
    if (!store.canCallAi()) {
      setMsgs((m) => [...m, { role: 'ai', text: 'You’ve hit today’s 5-message AI limit (free-tier safe). Try again tomorrow.' }])
      return
    }
    setBusy(true)
    const res = await askQuestion(store, q)
    if (res.ok) store.recordAiCall()
    setMsgs((m) => [...m, { role: 'ai', text: res.text }])
    setBusy(false)
  }

  const getSummary = async () => {
    const store = useStore.getState()
    if (ai.weeklySummary?.week === weekKey()) {
      setMsgs((m) => [...m, { role: 'ai', text: ai.weeklySummary.text }])
      return
    }
    if (!store.canCallAi()) { setMsgs((m) => [...m, { role: 'ai', text: 'Daily AI limit reached.' }]); return }
    setBusy(true)
    const stats = `Workouts this week: ${history.filter((h) => weekKey(new Date(h.date)) === weekKey()).length}. Lifetime reps: ${Object.values(progress.exercises || {}).reduce((a, e) => a + (e.totalReps || 0), 0)}.`
    const res = await weeklySummary(store, stats)
    if (res.ok) { store.recordAiCall(); store.cacheWeeklySummary(res.text) }
    setMsgs((m) => [...m, { role: 'ai', text: res.text }])
    setBusy(false)
  }

  return (
    <div className="screen flex min-h-screen flex-col pt-8">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Coach</h1>
        <span className="pill bg-white/5 text-slate-400">{callsLeft} left today</span>
      </div>

      {!aiConfigured() && (
        <div className="card mb-3 text-sm text-slate-300">
          AI coaching is off. Add a free Gemini API key in <b>Settings → AI</b> to enable chat, coaching notes, and weekly summaries.
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <button className="pill bg-accent/15 text-accent disabled:opacity-40" onClick={getSummary} disabled={!aiConfigured()}>📊 Weekly summary</button>
        <button className="pill bg-accent/15 text-accent disabled:opacity-40" onClick={() => send('Give me an alternate workout for today.')} disabled={!aiConfigured()}>🔀 New variation</button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {msgs.length === 0 && aiConfigured() && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Ask me anything about your training:</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="block w-full rounded-xl bg-white/5 p-3 text-left text-sm" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'ml-auto bg-accent text-ink' : 'bg-surface text-slate-200'}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="max-w-[85%] rounded-2xl bg-surface px-4 py-2.5 text-sm text-slate-400">Thinking…</div>}
      </div>

      <div className="sticky bottom-20 flex gap-2 bg-ink/95 py-2">
        <input className="flex-1 rounded-xl bg-white/6 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
          placeholder={aiConfigured() ? 'Ask your coach…' : 'Add an API key in Settings'} disabled={!aiConfigured()}
          value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn-accent" onClick={() => send()} disabled={busy || !aiConfigured()}>Send</button>
      </div>
    </div>
  )
}
