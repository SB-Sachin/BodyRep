// Gamification config: equipment options, user level tiers, badges, XP rules.

export const EQUIPMENT_OPTIONS = [
  { id: 'none', label: 'Floor only', icon: '🤸' },
  { id: 'pullup-bar', label: 'Pull-up bar', icon: '🏗️' },
  { id: 'bands', label: 'Resistance bands', icon: '🎗️' },
  { id: 'dumbbells', label: 'Dumbbells', icon: '🏋️' },
  { id: 'gym', label: 'Full gym', icon: '🏟️' },
]

export const FITNESS_LEVELS = [
  { id: 'beginner', label: 'Beginner', desc: 'New to training' },
  { id: 'some', label: 'Some experience', desc: 'Trained on and off' },
  { id: 'active', label: 'Active', desc: 'Train regularly' },
]

// User progression tiers, unlocked by total XP.
export const USER_TIERS = [
  { name: 'Recruit', minXp: 0 },
  { name: 'Athlete', minXp: 500 },
  { name: 'Warrior', minXp: 2000 },
  { name: 'Elite', minXp: 5000 },
  { name: 'Apex', minXp: 12000 },
]

export function tierForXp(xp) {
  let tier = USER_TIERS[0]
  for (const t of USER_TIERS) if (xp >= t.minXp) tier = t
  return tier
}

export function nextTier(xp) {
  return USER_TIERS.find((t) => t.minXp > xp) || null
}

// XP awarded for finishing a session: base + per completed set.
export const XP_PER_SESSION = 50
export const XP_PER_SET = 5
export const WEEKLY_XP_GOAL_PER_DAY = 75 // multiplied by training days/week

// Badge definitions.
export const BADGES = [
  { id: 'first-workout', name: 'First Rep', icon: '🌱', desc: 'Complete your first workout.' },
  { id: 'first-pullup', name: 'Lift Off', icon: '🚀', desc: 'Reach the Pull-Up in the Pull tree.' },
  { id: 'first-pistol', name: 'Sharpshooter', icon: '🎯', desc: 'Reach the Pistol Squat.' },
  { id: 'streak-7', name: 'Week Warrior', icon: '🔥', desc: 'Hit a 7-day streak.' },
  { id: 'streak-30', name: 'Unbroken', icon: '⚡', desc: 'Hit a 30-day streak.' },
  { id: 'volume-1000', name: 'Grinder', icon: '💯', desc: '1,000 lifetime reps.' },
  { id: 'level-5', name: 'Maxed Out', icon: '👑', desc: 'Take any skill to Level 5.' },
  { id: 'first-handstand', name: 'Upside Down', icon: '🤸', desc: 'Reach the Wall Handstand Push-Up.' },
]
