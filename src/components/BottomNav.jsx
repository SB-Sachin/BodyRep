import { NavLink, useLocation } from 'react-router-dom'
import Icon from './Icon.jsx'

const TABS = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/skills', label: 'Skills', icon: 'skills' },
  { to: '/progress', label: 'Progress', icon: 'progress' },
  { to: '/coach', label: 'Coach', icon: 'coach' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  // Hide the nav during an active session for a focused experience.
  if (pathname === '/session') return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink/90 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-md justify-around px-2 py-1.5">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            aria-label={t.label}
            className={({ isActive }) =>
              `relative flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-semibold transition-colors ${
                isActive ? 'text-accent' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute top-0 h-1 w-8 rounded-full bg-accent" />}
                <Icon name={t.icon} size={23} strokeWidth={isActive ? 2.2 : 1.75} />
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
