// Small date helpers. All keys are local-date based (YYYY-MM-DD).

export function dateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysBetween(aKey, bKey) {
  const a = parseKey(aKey)
  const b = parseKey(bKey)
  return Math.round((b - a) / 86400000)
}

// ISO-ish week key for weekly aggregates. Monday-based.
export function weekKey(d = new Date()) {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7 // 0 = Monday
  date.setDate(date.getDate() - day)
  return dateKey(date)
}

export function lastNDays(n, end = new Date()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    out.push(dateKey(d))
  }
  return out
}
