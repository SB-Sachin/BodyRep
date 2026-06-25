// IndexedDB persistence via idb. The whole app state lives in one record
// (single-user app, per PRD: "All data lives on the device"). Session history is
// also kept as discrete records so it survives and can be exported as JSON.

import { openDB } from 'idb'

const DB_NAME = 'bodyrep'
const DB_VERSION = 1
const STATE_STORE = 'state'
const SESSION_STORE = 'sessions'
const STATE_KEY = 'app'

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE)
        }
        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          db.createObjectStore(SESSION_STORE, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

export async function loadState() {
  try {
    const db = await getDB()
    return (await db.get(STATE_STORE, STATE_KEY)) || null
  } catch (e) {
    console.warn('loadState failed', e)
    return null
  }
}

export async function saveState(state) {
  try {
    const db = await getDB()
    await db.put(STATE_STORE, state, STATE_KEY)
  } catch (e) {
    console.warn('saveState failed', e)
  }
}

export async function appendSession(session) {
  try {
    const db = await getDB()
    await db.put(SESSION_STORE, session)
  } catch (e) {
    console.warn('appendSession failed', e)
  }
}

export async function allSessions() {
  try {
    const db = await getDB()
    return await db.getAll(SESSION_STORE)
  } catch (e) {
    console.warn('allSessions failed', e)
    return []
  }
}

// JSON export/import so history is never lost if the browser clears storage (PRD data safety).
export async function exportData() {
  const state = await loadState()
  const sessions = await allSessions()
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), state, sessions }, null, 2)
}

export async function importData(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json
  if (parsed.state) await saveState(parsed.state)
  if (Array.isArray(parsed.sessions)) {
    const db = await getDB()
    const tx = db.transaction(SESSION_STORE, 'readwrite')
    for (const s of parsed.sessions) await tx.store.put(s)
    await tx.done
  }
  return parsed
}
