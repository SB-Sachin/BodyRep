// Lightweight category-based SVG illustration with a subtle CSS animation.
// Avoids bundling per-exercise art (out of scope for V1; video is V2) while still
// giving each movement a visual cue keyed to its skill tree.

const COLORS = {
  push: '#f87171',
  pull: '#22d3ee',
  legs: '#34d399',
  core: '#fbbf24',
}

const GLYPH = {
  'horizontal-press': 'M20 60 H80',
  'vertical-press': 'M50 20 V80',
  'vertical-pull': 'M50 20 V70',
  'horizontal-pull': 'M20 50 H80',
  squat: 'M30 70 Q50 30 70 70',
  hinge: 'M25 45 Q50 75 75 45',
  lunge: 'M30 75 L50 40 L70 75',
  'anti-extension': 'M20 55 H80',
  compression: 'M30 55 H70',
}

export default function ExerciseDemo({ exercise, size = 120 }) {
  const color = COLORS[exercise?.category] || '#94a3b8'
  const path = GLYPH[exercise?.pattern] || 'M20 50 H80'
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="mx-auto" role="img" aria-label={`${exercise?.name} illustration`}>
      <circle cx="50" cy="50" r="46" fill={color} opacity="0.08" />
      <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="50" cy="30" r="7" fill={color}>
        <animate attributeName="cy" values="30;34;30" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <path d={path} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round">
        <animate attributeName="stroke-dasharray" values="0 200;200 0" dur="2.2s" repeatCount="indefinite" />
      </path>
      <text x="50" y="94" textAnchor="middle" fontSize="7" fill={color} opacity="0.7" style={{ textTransform: 'capitalize' }}>
        {exercise?.pattern?.replace(/-/g, ' ')}
      </text>
    </svg>
  )
}
