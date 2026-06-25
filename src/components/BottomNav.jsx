import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/skills', label: 'Skills', icon: '🌳' },
  { to: '/progress', label: 'Progress', icon: '📈' },
  { to: '/coach', label: 'Coach', icon: '🤖' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  // Hide the nav during an active session for a focused experience.
  if (pathname === '/session') return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink/95 backdrop-blur safe-bottom">
      <div className="mx-auto flex max-w-md justify-around px-2 py-2">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[11px] ${
                isActive ? 'text-accent' : 'text-slate-400'
              }`
            }
          >
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
