# BodyRep Backend: Cloud Persistence + Web Push — Design

**Date:** 2026-06-25
**Status:** Approved (pending spec review)

## Context

BodyRep is a single-user, offline-first PWA (React 18 + Vite) with all data in
IndexedDB and no backend. Two needs now require server infrastructure:

1. **Reliable background timer notifications, including iOS.** The client-only
   approach (Notification Triggers API + `setTimeout`) cannot fire on iOS when
   the app is backgrounded/closed. iOS delivers Web Push only to home-screen-
   installed PWAs (iOS 16.4+) and only via a server-sent push. The user runs an
   iPhone and will install to the home screen.
2. **Data backup/restore.** Clearing the browser or reinstalling currently loses
   everything. A cloud mirror protects against that.

Stack chosen: **Vercel Serverless Functions + Upstash Redis + Upstash QStash**
(all free-tier for one user). Sync model: **backup + restore, last-write-wins**.
Auth: **shared bearer token** (single user, no login — see Security).

## Goals

- Background rest/hold notifications that fire on an installed iOS PWA even when
  closed, plus Android/desktop.
- Automatic cloud backup of the full app state, restored on launch if newer.
- Preserve offline-first behavior: the app must remain fully functional with no
  network and with the backend absent/unconfigured.

## Non-goals

- Multi-user, accounts, or real authentication.
- Relational schema / querying. State is stored as one opaque JSON blob, mirroring
  the existing single-record IndexedDB design.
- Conflict resolution UI. Last-write-wins on the whole blob is acceptable for one
  person.

## Architecture

Offline-first is unchanged: **IndexedDB remains the local source of truth.** The
backend is a thin mirror (state) + a delayed push scheduler.

```
Client (PWA)                         Vercel /api                  Upstash
─────────────                        ───────────                  ───────
store.scheduleSave ──pushState────▶  api/state (PUT) ───────────▶ Redis: bodyrep:state
store.hydrate     ──pullState────▶  api/state (GET) ◀───────────  Redis: bodyrep:state
push subscribe    ──────────────▶   api/push/subscribe ────────▶ Redis: bodyrep:subscription
timer start       ──────────────▶   api/timer/schedule ─┐
                                       returns timerId   ├─QStash publish(delay)─┐
timer skip/stop   ──────────────▶   api/timer/cancel     │  Redis: bodyrep:activeTimer
                                                          ▼                       │
                                     api/push/send ◀──QStash callback (at deadline)┘
                                       reads subscription, web-push ──▶ APNs/FCM ──▶ device
```

## Components

### Client

- **`src/sync/cloud.js`** (new) — `pushState(blob)`, `pullState()`, plus a tiny
  authed `fetch` wrapper. All calls best-effort: on any network/HTTP failure they
  log and resolve (never throw, never block the UI). No-op entirely when the
  backend isn't configured (`VITE_API_TOKEN` / VAPID key absent).
- **`src/push/subscribe.js`** (new) — `ensurePushSubscription()`: after notification
  permission is granted, calls `registration.pushManager.subscribe({ userVisibleOnly:
  true, applicationServerKey: <VITE_VAPID_PUBLIC_KEY> })` and POSTs the subscription
  to `api/push/subscribe`. Idempotent; caches the subscription locally.
- **`src/utils/timers.js`** (modify) — when a subscription exists, schedule via
  `api/timer/schedule` (returns `timerId`, retained for cancel) instead of the
  client `TimestampTrigger`. `cancelNotification` calls `api/timer/cancel`. When no
  subscription/offline, keep the existing client `setTimeout`+`showNotification`
  fallback. Wall-clock display and foreground `buzz()` are unchanged. This removes
  the double-notification risk (server push is the single scheduled alert).
- **`src/store/useStore.js`** (modify) — add `updatedAt` (epoch ms) to persisted
  state, bumped on every `scheduleSave`. `scheduleSave` also calls
  `cloud.pushState` (debounced, fire-and-forget). `hydrate` calls `cloud.pullState`
  after local load and replaces local state only if `remote.updatedAt >
  local.updatedAt`.
- **`src/screens/Session.jsx`** (modify) — after `ensureNotifyPermission()` in
  `start()`, also call `ensurePushSubscription()`.
- **`src/sw.js`** (new) + **`vite.config.js`** (modify) — switch vite-plugin-pwa to
  `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.js'`. The custom
  SW: `precacheAndRoute(self.__WB_MANIFEST)`, preserves the **NetworkOnly** rule for
  `generativelanguage.googleapis.com`, calls `self.skipWaiting()` + `clientsClaim()`
  (preserving `autoUpdate`), and adds `push` (renders `showNotification` from the
  payload) and `notificationclick` (focuses/opens the app) listeners.

### Server (`/api`, Vercel functions)

All endpoints (except `push/send`) require `Authorization: Bearer <APP_SHARED_TOKEN>`
and return 401 otherwise.

- **`api/state.js`** — `GET` → `{ blob, updatedAt }` from Redis `bodyrep:state`
  (or `204`/empty if none). `PUT { blob, updatedAt }` → store it.
- **`api/push/subscribe.js`** — `POST <PushSubscription>` → store at Redis
  `bodyrep:subscription`.
- **`api/timer/schedule.js`** — `POST { endTime, title, body }`. Compute
  `delaySeconds = max(0, (endTime - now)/1000)`. Generate `timerId` (uuid), store at
  Redis `bodyrep:activeTimer`. Publish to QStash targeting `api/push/send` with
  `{ timerId, title, body }` and the delay. Return `{ timerId }`.
- **`api/timer/cancel.js`** — `POST { timerId }` → if it matches `bodyrep:activeTimer`,
  delete that key (so `send` will no-op).
- **`api/push/send.js`** — QStash callback. Verify QStash signature
  (`QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY`). If payload `timerId !==`
  Redis `bodyrep:activeTimer`, no-op (cancelled/superseded). Else read
  `bodyrep:subscription` and send via `web-push` with VAPID keys; clear
  `bodyrep:activeTimer`. On `410 Gone`, delete the stale subscription.

### Redis keys (single user, fixed)

- `bodyrep:state` → `{ blob, updatedAt }`
- `bodyrep:subscription` → PushSubscription JSON
- `bodyrep:activeTimer` → current `timerId` string

### Environment variables

Server-only (Vercel env, never `VITE_`): `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`,
`QSTASH_NEXT_SIGNING_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `APP_SHARED_TOKEN`.

Client (`VITE_`, baked into bundle, public): `VITE_VAPID_PUBLIC_KEY`,
`VITE_API_TOKEN` (= the shared bearer). `VITE_` vars are build-time — changing them
on Vercel requires a redeploy (consistent with existing Gemini key behavior).

## Data flow details

- **Save:** state mutation → `scheduleSave` (250ms debounce) writes IndexedDB and
  `PUT api/state`. Failure is swallowed (offline ok).
- **Launch:** `hydrate` loads IndexedDB → `GET api/state` → if remote newer, replace
  in-memory + local state. If offline, use local only.
- **Rest/hold start:** set wall-clock `endTime`, render countdown,
  `POST api/timer/schedule`, keep `timerId`.
- **Rest/hold end (natural):** QStash → `api/push/send` → device push. UI already
  shows 0 via wall-clock.
- **Skip/stop/quit:** `POST api/timer/cancel` with the `timerId`.

## Error handling

- All client → server calls are best-effort and never block or crash the UI.
- Missing backend config → client silently skips cloud calls; app behaves exactly
  as it does today (local-only, client-fallback notifications).
- `push/send` no-ops on missing subscription or mismatched `timerId`; prunes
  subscriptions that return `410`.
- Cancellation race (stop fires as push is sent) is resolved by the `activeTimer`
  match check; worst case is one stray notification, considered acceptable.

## Security

Single user, no login. `APP_SHARED_TOKEN` is shipped in the client bundle as
`VITE_API_TOKEN`, so it is discoverable by anyone inspecting the JS. It gates
casual/bot access to the endpoints, not a determined attacker. Acceptable for a
personal fitness app holding age/weight/workout data. Real authentication is
explicitly out of scope. `api/push/send` is protected instead by QStash signature
verification (not the bearer token, since QStash is the caller).

## Testing / verification

- **Local:** `npm run build` green. Run with backend env unset → confirm app is
  fully functional offline (local-only, no errors). With env set (via `vercel dev`
  or deployed preview) → confirm `state` round-trips (mutate, clear IndexedDB,
  reload, data restored).
- **Push:** on the installed iOS PWA, start a rest timer, lock the phone, confirm a
  notification fires at the deadline; confirm skip cancels it. Repeat on
  Android/desktop Chrome.
- **SW migration:** confirm offline load still works, Gemini calls still bypass
  cache (NetworkOnly), and updates still auto-apply.

## Rollout notes

- New deps: `web-push` (server), `@upstash/redis`, `@upstash/qstash` (server),
  `workbox-precaching`/`workbox-routing`/`workbox-strategies` (SW build).
- Generate VAPID keys once (`web-push generate-vapid-keys`); set all server env vars
  in Vercel; redeploy. The feature is inert until env is configured, so it can ship
  incrementally.
