import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore.js'
import { askQuestion, weeklySummary, aiConfigured } from '../ai/gemini.js'
import { weekKey } from '../utils/dates.js'

const SUGGESTIONS = [
  'How do I get my first pull-up?',
  'Is my weekly volume enough to grow?',
  'What should I eat to gain weight?',
  'Why am I stuck on my current level?',
]

// How many prior turns to send as conversation memory (keeps token use bounded).
const MEMORY_TURNS = 12

export default function Chat() {
  const callsLeft = useStore((s) => s.aiCallsLeft())
  const chat = useStore((s) => s.chat)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)

  // Auto-scroll to the newest message / typing indicator.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [chat, busy])

  const send = async (text) => {
    if (busy) return
    const q = (text ?? input).trim()
    if (!q) return

    const store = useStore.getState()
    setInput('')
    store.addChatMessage({ role: 'user', text: q })

    if (!store.canCallAi()) {
      store.addChatMessage({ role: 'ai', error: true, text: 'You’ve used today’s AI messages (free-tier safe). They reset tomorrow.' })
      return
    }

    setBusy(true)
    try {
      // Conversation memory = prior messages (excluding error bubbles and the
      // question we just appended, which askQuestion adds itself).
      const convo = useStore.getState().chat
        .filter((m) => !m.error)
        .slice(-MEMORY_TURNS - 1, -1)
        .map((m) => ({ role: m.role, text: m.text }))
      const res = await askQuestion(store, q, convo)
      if (res.ok) store.recordAiCall()
      store.addChatMessage({ role: 'ai', text: res.text, error: !res.ok })
    } finally {
      setBusy(false)
    }
  }

  const getSummary = async () => {
    if (busy) return
    const store = useStore.getState()
    store.addChatMessage({ role: 'user', text: '📊 Weekly summary' })

    // Serve cached summary for the current week without spending a call.
    if (store.ai.weeklySummary?.week === weekKey()) {
      store.addChatMessage({ role: 'ai', text: store.ai.weeklySummary.text })
      return
    }
    if (!store.canCallAi()) {
      store.addChatMessage({ role: 'ai', error: true, text: 'You’ve used today’s AI messages. They reset tomorrow.' })
      return
    }

    setBusy(true)
    try {
      const weekWorkouts = store.history.filter((h) => weekKey(new Date(h.date)) === weekKey()).length
      const lifetimeReps = Object.values(store.progress.exercises || {}).reduce((a, e) => a + (e.totalReps || 0), 0)
      const stats = `Workouts this week: ${weekWorkouts}. Lifetime reps: ${lifetimeReps}.`
      const res = await weeklySummary(store, stats)
      if (res.ok) { store.recordAiCall(); store.cacheWeeklySummary(res.text) }
      store.addChatMessage({ role: 'ai', text: res.text, error: !res.ok })
    } finally {
      setBusy(false)
    }
  }

  const disabled = !aiConfigured() || busy

  return (
    <div className="screen flex min-h-screen flex-col pt-8">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Coach</h1>
        <div className="flex items-center gap-2">
          {chat.length > 0 && (
            <button className="pill bg-white/5 text-slate-400" onClick={() => useStore.getState().clearChat()}>Clear</button>
          )}
          <span className="pill bg-white/5 text-slate-400">{callsLeft} left today</span>
        </div>
      </div>

      {!aiConfigured() && (
        <div className="card mb-3 text-sm text-slate-300">
          AI coaching is off. Add a free Gemini API key in <b>Settings → AI</b> to enable chat, coaching notes, and weekly summaries.
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <button className="pill bg-accent/15 text-accent disabled:opacity-40" onClick={getSummary} disabled={disabled}>📊 Weekly summary</button>
        <button className="pill bg-accent/15 text-accent disabled:opacity-40" onClick={() => send('Give me an alternate workout for today using my unlocked exercises.')} disabled={disabled}>🔀 New variation</button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-4">
        {chat.length === 0 && aiConfigured() && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">I know your full training history. Ask me anything:</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="block w-full rounded-xl bg-white/5 p-3 text-left text-sm active:bg-white/10" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        {chat.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
              m.role === 'user'
                ? 'ml-auto bg-accent text-ink'
                : m.error
                ? 'bg-red-500/15 text-red-200'
                : 'bg-surface text-slate-200'
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="max-w-[85%] rounded-2xl bg-surface px-4 py-2.5 text-sm text-slate-400">
            <span className="inline-flex gap-1">
              <span className="animate-bounce">•</span>
              <span className="animate-bounce [animation-delay:150ms]">•</span>
              <span className="animate-bounce [animation-delay:300ms]">•</span>
            </span>
          </div>
        )}
      </div>

      <div className="sticky bottom-20 flex gap-2 bg-ink/95 py-2">
        <input
          className="flex-1 rounded-xl bg-white/6 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50"
          placeholder={aiConfigured() ? 'Ask your coach…' : 'Add an API key in Settings'}
          disabled={disabled}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn-accent disabled:opacity-40" onClick={() => send()} disabled={disabled || !input.trim()}>Send</button>
      </div>
    </div>
  )
}
