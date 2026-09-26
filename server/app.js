// The HRMS API, written against the standard Fetch Request/Response so the
// same handler runs as a Netlify Function and as a plain Node server.
//
//   POST /api/auth/login      { username, password } -> { token, user }
//   GET  /api/auth/me         -> { user }
//   GET  /api/state           -> everything the signed-in person may see
//   POST /api/actions         { type, payload } -> { result, state }
//   POST /api/admin/reset     super admin only: restore the seed data
//   GET  /api/health

import { ACCOUNTS, DEMO_PASSWORDS, ROLES, PERMS } from '../src/data/accounts.js'
import { SEED } from '../src/data/seed.js'
import { ACTIONS, COLLECTIONS, applyAction } from '../src/lib/actions.js'
import { hashPassword, verifyPassword, issueToken, readToken } from './auth.js'
import { HttpError, prepare, visibleTo, fanOut, notificationFor } from './rules.js'

const MAX_BODY = 64 * 1024
const MAX_FAILURES = 5
const LOCK_MS = 5 * 60 * 1000

export const DEFAULT_ORIGINS = [
  'https://localhost',          // Capacitor Android
  'capacitor://localhost',      // Capacitor iOS
  'http://localhost:5173',      // vite dev
  'http://localhost:4173',      // vite preview
  'https://flexiloans-hrms-live.netlify.app',
  'https://flexiloans-hrms-demo.netlify.app',
]

const clone = (v) => structuredClone(v)
const keyFor = (collection, username) =>
  COLLECTIONS[collection] === 'shared' ? 'shared/' + collection : 'personal/' + username + '/' + collection

/** The user object the app expects - same shape as accounts.authenticate(). */
function publicUser(record) {
  const role = ROLES[record.role]
  return {
    ...record.profile,
    username: record.username,
    roleKey: record.role,
    role: role.label,
    dashboard: role.dashboard,
    perms: role.perms,
  }
}

export function createApp({ store, secret, allowedOrigins = DEFAULT_ORIGINS }) {
  if (!secret || secret.length < 32) throw new Error('HRMS_TOKEN_SECRET must be at least 32 characters')

  // --- data access --------------------------------------------------------

  async function users() {
    const existing = await store.get('users')
    if (existing) return existing
    const seeded = await Promise.all(ACCOUNTS.map(async (a) => ({
      username: a.username, role: a.role, profile: a.profile, passwordHash: await hashPassword(DEMO_PASSWORDS[a.username]),
    })))
    // Another instance may have seeded first; keep whichever landed.
    return store.update('users', (cur) => cur || seeded)
  }

  const read = async (collection, username) =>
    (await store.get(keyFor(collection, username))) ?? clone(SEED[collection])

  async function stateFor(actor) {
    const names = Object.keys(COLLECTIONS)
    const values = await Promise.all(names.map((c) => read(c, actor.username)))
    return Object.fromEntries(names.map((c, i) => [c, visibleTo(actor, c, values[i])]))
  }

  async function pushNotification(username, n) {
    await store.update(keyFor('notifications', username),
      (cur) => [notificationFor(n), ...(cur ?? clone(SEED.notifications))].slice(0, 100))
  }

  // --- request plumbing --------------------------------------------------

  function cors(req) {
    const origin = req.headers.get('origin')
    const h = { Vary: 'Origin' }
    if (origin && allowedOrigins.includes(origin)) {
      h['Access-Control-Allow-Origin'] = origin
      h['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
      h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
      h['Access-Control-Max-Age'] = '600'
    }
    return h
  }

  const json = (req, status, body) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) },
  })

  async function body(req) {
    const text = await req.text()
    if (text.length > MAX_BODY) throw new HttpError(413, 'Request body too large')
    try { return text ? JSON.parse(text) : {} } catch { throw new HttpError(400, 'Body must be JSON') }
  }

  async function actorFrom(req) {
    const auth = req.headers.get('authorization') || ''
    const username = readToken(auth.replace(/^Bearer\s+/i, ''), secret)
    const record = username && (await users()).find((u) => u.username === username)
    if (!record) throw new HttpError(401, 'Your session has expired. Please sign in again.')
    return publicUser(record)
  }

  // --- routes ------------------------------------------------------------

  async function login(req) {
    const { username, password } = await body(req)
    const name = String(username || '').trim().toLowerCase()
    const lockKey = 'lock/' + name
    const lock = (await store.get(lockKey)) || { failures: 0, until: 0 }
    if (lock.until > Date.now()) throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.')

    const record = (await users()).find((u) => u.username === name)
    const ok = record && (await verifyPassword(password, record.passwordHash))
    if (!ok) {
      const failures = lock.failures + 1
      await store.set(lockKey, failures >= MAX_FAILURES ? { failures: 0, until: Date.now() + LOCK_MS } : { failures, until: 0 })
      throw new HttpError(401, 'That username and password do not match an account.')
    }
    if (lock.failures) await store.set(lockKey, { failures: 0, until: 0 })
    return { token: issueToken(record.username, secret), user: publicUser(record) }
  }

  async function act(req) {
    const actor = await actorFrom(req)
    const { type, payload } = await body(req)
    const spec = ACTIONS[type]
    if (!spec) throw new HttpError(400, 'Unknown action ' + type)
    if (!actor.perms.includes(spec.perm)) throw new HttpError(403, 'Your role cannot do that.')

    let result
    let clean
    let before
    await store.update(keyFor(spec.collection, actor.username), (cur) => {
      before = cur ?? clone(SEED[spec.collection])
      // Validate against the freshest copy, inside the atomic update.
      clean = prepare(type, payload, actor, before)
      const out = applyAction(before, { type, payload: clean })
      result = out.result
      return out.value
    })

    const everyone = (await users()).map(publicUser)
    for (const { to, notification } of fanOut(type, clean, actor, before)) {
      await Promise.all(everyone.filter(to).map((u) => pushNotification(u.username, notification)))
    }

    return { result, state: await stateFor(actor) }
  }

  async function reset(req) {
    const actor = await actorFrom(req)
    if (!actor.perms.includes(PERMS.ADMIN_SYSTEM)) throw new HttpError(403, 'Only a super admin can reset data.')
    const everyone = await users()
    const shared = Object.keys(COLLECTIONS).filter((c) => COLLECTIONS[c] === 'shared')
    const personal = Object.keys(COLLECTIONS).filter((c) => COLLECTIONS[c] === 'personal')
    await Promise.all([
      ...shared.map((c) => store.set(keyFor(c), clone(SEED[c]))),
      ...everyone.flatMap((u) => personal.map((c) => store.set(keyFor(c, u.username), clone(SEED[c])))),
    ])
    return { state: await stateFor(actor) }
  }

  const ROUTES = {
    'GET /api/health': async () => ({ ok: true, time: new Date().toISOString() }),
    'POST /api/auth/login': login,
    'GET /api/auth/me': async (req) => ({ user: await actorFrom(req) }),
    'GET /api/state': async (req) => stateFor(await actorFrom(req)),
    'POST /api/actions': act,
    'POST /api/admin/reset': reset,
  }

  return async function handle(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
    const route = ROUTES[req.method + ' ' + new URL(req.url).pathname.replace(/\/+$/, '')]
    if (!route) return json(req, 404, { error: 'Not found' })
    try {
      return json(req, 200, await route(req))
    } catch (err) {
      if (err instanceof HttpError) return json(req, err.status, { error: err.message })
      console.error(err)
      return json(req, 500, { error: 'Something went wrong on the server.' })
    }
  }
}
