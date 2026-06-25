// Best-effort timer notifications for a backend-less PWA.
//
// Two firing strategies:
//   1. Notification Triggers API (TimestampTrigger) — fires even when the app is
//      backgrounded or fully closed (Chromium/Android). Scheduled via the SW
//      registration, so it survives the page being suspended.
//   2. setTimeout + showNotification fallback — for browsers without triggers
//      (Safari/Firefox). Throttled in the background; fires on resume at the
//      latest. Best-effort only.
//
// The countdown *display* never relies on these — components compute remaining
// time from a wall-clock end timestamp, so the visible number is always correct
// regardless of background throttling. These helpers only handle the buzz/alert.

const hasNotification = typeof window !== 'undefined' && 'Notification' in window
const supportsTriggers = hasNotification && 'TimestampTrigger' in window

const fallbackTimers = new Map() // tag -> setTimeout id

export function notificationsAvailable() {
  return hasNotification
}

// Request permission. Call from a user gesture (e.g. starting the workout).
export async function ensureNotifyPermission() {
  if (!hasNotification) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

async function swReady() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

const ICON = '/icon-192.png'

// Schedule a notification to fire at endTime (epoch ms). `tag` dedupes/replaces
// any pending notification with the same tag.
export async function scheduleNotification({ tag, endTime, title, body }) {
  await cancelNotification(tag)
  if (!hasNotification || Notification.permission !== 'granted') return

  const reg = await swReady()
  const delay = Math.max(0, endTime - Date.now())

  if (reg && supportsTriggers) {
    try {
      await reg.showNotification(title, {
        tag,
        body,
        icon: ICON,
        badge: ICON,
        // eslint-disable-next-line no-undef
        showTrigger: new TimestampTrigger(endTime),
      })
      return
    } catch {
      // fall through to the setTimeout path
    }
  }

  const id = setTimeout(async () => {
    fallbackTimers.delete(tag)
    const r = await swReady()
    const opts = { tag, body, icon: ICON, badge: ICON }
    if (r) {
      r.showNotification(title, opts)
    } else {
      try { new Notification(title, opts) } catch { /* ignore */ }
    }
    try { navigator.vibrate?.(200) } catch { /* ignore */ }
  }, delay)
  fallbackTimers.set(tag, id)
}

// Cancel a pending notification (both the scheduled-trigger and fallback paths).
export async function cancelNotification(tag) {
  const id = fallbackTimers.get(tag)
  if (id) {
    clearTimeout(id)
    fallbackTimers.delete(tag)
  }
  const reg = await swReady()
  if (reg) {
    try {
      const notes = await reg.getNotifications({ tag, includeTriggered: true })
      notes.forEach((n) => n.close())
    } catch {
      /* getNotifications options not supported everywhere — ignore */
    }
  }
}

// Short haptic buzz when a timer ends in the foreground.
export function buzz() {
  try { navigator.vibrate?.([120, 60, 120]) } catch { /* ignore */ }
}
