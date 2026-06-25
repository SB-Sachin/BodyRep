import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import BottomNav from './components/BottomNav.jsx'
import Onboarding from './screens/Onboarding.jsx'
import Home from './screens/Home.jsx'
import Session from './screens/Session.jsx'
import Progress from './screens/Progress.jsx'
import SkillTreeScreen from './screens/SkillTreeScreen.jsx'
import Settings from './screens/Settings.jsx'
import Chat from './screens/Chat.jsx'

export default function App() {
  const hydrated = useStore((s) => s.hydrated)
  const onboarded = useStore((s) => s.onboarded)
  const hydrate = useStore((s) => s.hydrate)

  useEffect(() => { hydrate() }, [hydrate])

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <div className="animate-pulse text-2xl font-bold tracking-tight">BodyRep</div>
      </div>
    )
  }

  if (!onboarded) return <Onboarding />

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/session" element={<Session />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/skills" element={<SkillTreeScreen />} />
        <Route path="/coach" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  )
}
