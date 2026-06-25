// Lightweight inline SVG icon set (Lucide-style paths) so the app never relies on
// emoji for structural icons. Stroke-based, currentColor, consistent 1.75 width.

const PATHS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  skills: <><path d="M6 3v12" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path d="M18 9c0 6-12 3-12 9" /></>,
  progress: <><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></>,
  coach: <><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  flame: <><path d="M12 2c1 4 5 5 5 9a5 5 0 0 1-10 0c0-1.5.5-2.5 1.5-3.5C9 9 9.5 7 9 5c2 1 2.5 3 3 4 .5-2 0-5 0-7Z" /></>,
  check: <path d="m20 6-11 11-5-5" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  trophy: <><path d="M6 4h12v4a6 6 0 0 1-12 0V4Z" /><path d="M6 6H4a2 2 0 0 0 0 4h2M18 6h2a2 2 0 0 1 0 4h-2" /><path d="M12 14v4M9 21h6M10 18h4" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  dumbbell: <><path d="M6 6v12M3 9v6M18 6v12M21 9v6M6 12h12" /></>,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
  rest: <><path d="M3 12a9 9 0 1 0 9-9 7 7 0 0 1-9 9Z" /></>,
  upload: <><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></>,
}

export default function Icon({ name, size = 22, className = '', strokeWidth = 1.75, ...rest }) {
  const fillIcons = new Set(['flame', 'zap', 'sparkle'])
  const filled = fillIcons.has(name)
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true" focusable="false" {...rest}
    >
      {PATHS[name] || PATHS.dumbbell}
    </svg>
  )
}
