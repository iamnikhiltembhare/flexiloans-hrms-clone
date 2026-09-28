// The HRMS API, written against the standard Fetch Request/Response so the
// same handler runs as a Netlify Function and as a plain Node server.
//
//   POST /api/auth/login      { username, password } -> { token, user }
//   GET  /api/auth/me         -> { user }
//   GET  /api/state           -> everything the signed-in person may see
//   POST /api/actions         { type, payload } -> { result, state }
//   POST /api/admin/reset     super admin only: restore the seed data
//   GET  /api/health

import { ALL_ACCOUNTS, passwordFor, ROLES, PERMS } from '../src/data/accounts.js'
import { SEED } from '../src/data/seed.js'
import { BRAND } from '../src/lib/brand.js'
import { ACTIONS, COLLECTIONS, applyAction, nextSerial, today } from '../src/lib/actions.js'
import { hashPassword, verifyPassword, issueToken, readToken } from './auth.js'
import { HttpError, prepare, visibleTo, fanOut, notificationFor } from './rules.js'
import { createAssistant } from './assistant.js'

const MAX_BODY = 64 * 1024
const fail = (msg) => { throw new HttpError(400, msg) }
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

const DEMO_LOGINS = ALL_ACCOUNTS.map((a) => ({ ...a, password: passwordFor(a.username) }))

/**
 * `accounts` are the logins this instance knows: [{ username, role, profile,
 * password }]. Production uses the demo accounts; the test environment
 * passes its own (see functions/api.js).
 */
export function createApp({ store, secret, allowedOrigins = DEFAULT_ORIGINS, accounts = DEMO_LOGINS, assistant = createAssistant() }) {
  if (!secret || secret.length < 32) throw new Error('HRMS_TOKEN_SECRET must be at least 32 characters')

  // --- data access --------------------------------------------------------

  // Stored users. The code's account list decides who exists and what their
  // profile says: new accounts are created, removed ones stop working, and
  // profile edits are picked up. Users a super admin created in the app
  // (source: 'admin') are kept as they are. Password hashes are never
  // regenerated for an account that already exists.
  const wanted = new Map(accounts.map((a) => [a.username, a]))
  const current = (u) => {
    const a = wanted.get(u.username)
    return a && a.role === u.role && JSON.stringify(a.profile) === JSON.stringify(u.profile)
  }
  async function users() {
    const existing = (await store.get('users')) || []
    const fromCode = existing.filter((u) => u.source !== 'admin')
    if (fromCode.length === accounts.length && fromCode.every(current)) return existing
    const hashes = new Map(existing.map((u) => [u.username, u.passwordHash]))
    const synced = await Promise.all(accounts.map(async (a) => ({
      username: a.username, role: a.role, profile: a.profile,
      passwordHash: hashes.get(a.username) ?? await hashPassword(a.password),
    })))
    return store.update('users', (cur) => [
      ...synced,
      ...(cur || []).filter((u) => u.source === 'admin' && !wanted.has(u.username)),
    ])
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
    const { type, payload, via } = await body(req)
    const spec = ACTIONS[type]
    if (!spec) throw new HttpError(400, 'Unknown action ' + type)
    if (!actor.perms.includes(spec.perm)) throw new HttpError(403, 'Your role cannot do that.')

    let result
    let clean
    let before
    // Collections the action reads besides the one it changes (unfiltered).
    const extra = Object.fromEntries(await Promise.all((spec.needs || []).map(async (c) => [c, await read(c, actor.username)])))
    await store.update(keyFor(spec.collection, actor.username), (cur) => {
      before = cur ?? clone(SEED[spec.collection])
      // Validate against the freshest copy, inside the atomic update.
      clean = prepare(type, payload, actor, before, extra)
      const out = applyAction(before, { type, payload: clean })
      result = out.result
      return out.value
    })

    const everyone = (await users()).map(publicUser)
    for (const { to, notification } of fanOut(type, clean, actor, before)) {
      await Promise.all(everyone.filter(to).map((u) => pushNotification(u.username, notification)))
    }

    // An anonymous grievance must not be traceable through the audit log either.
    const hidden = (type === 'grievance.add' && clean.grievance.anonymous) || (type === 'grievance.reply' && before.find((g) => g.id === clean.id)?.anonymous)
    const who = hidden ? { name: 'Anonymous', username: 'anonymous', role: 'employee' } : actor
    await audit(who, type, targetOf(type, clean), via === 'assistant' ? 'assistant' : 'app')
    return { result, state: await stateFor(actor) }
  }

  // --- audit log -------------------------------------------------------------
  // Every change, and every question to the assistant, with who and when.

  const AUDIT_MAX = 500
  const targetOf = (type, p) => p?.id || p?.name || p?.grievance?.id || p?.record?.id || p?.course?.id || p?.courseId || p?.candidate?.name || p?.request?.id || p?.ticket?.id || p?.employee?.id
    || p?.requisition?.id || p?.announcement?.title || p?.document?.name || (type === 'punch.toggle' ? p?.date : '') || ''
  async function audit(actor, action, target, via, detail) {
    const entry = { id: 'AU-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: new Date().toISOString(),
      actor: actor.name, username: actor.username, role: actor.role, action, target: String(target || '').slice(0, 120), via, ...(detail ? { detail } : {}) }
    await store.update('audit', (cur) => [entry, ...(cur || [])].slice(0, AUDIT_MAX))
  }

  async function auditLog(req) {
    const actor = await actorFrom(req)
    if (!actor.perms.includes(PERMS.ADMIN_SYSTEM)) throw new HttpError(403, 'Only a super admin can read the audit log.')
    return { entries: (await store.get('audit')) || [] }
  }

  // --- HR Assistant -------------------------------------------------------

  const CHAT_MAX = 60
  const chatKey = (username) => 'chat/' + username

  async function ask(req) {
    const actor = await actorFrom(req)
    const b = await body(req)
    const message = typeof b.message === 'string' ? b.message.trim().slice(0, 2000) : ''
    if (!message) throw new HttpError(400, 'Type a question for the assistant')
    // The device's date and time, so "today" matches the user's time zone.
    const localToday = /^\d{4}-\d{2}-\d{2}$/.test(b.today) && Math.abs(Date.parse(b.today) - Date.now()) < 36 * 3600 * 1000 ? b.today : today()
    const nowMin = Number.isInteger(b.nowMin) && b.nowMin >= 0 && b.nowMin < 1440 ? b.nowMin : null
    const ctx = { actor, state: await stateFor(actor), today: localToday, nowMin }
    const history = ((await store.get(chatKey(actor.username))) || []).map((m) => ({ role: m.role, text: m.text }))
    // Short-term memory from the app: the last list shown, and a leave
    // application still being filled in. Only these known shapes are kept.
    const m = b.memory && typeof b.memory === 'object' ? b.memory : {}
    const memory = {}
    if (Array.isArray(m.pending)) memory.pending = m.pending.slice(0, 20).map(String)
    if (m.leaveDraft && typeof m.leaveDraft === 'object') {
      const d = m.leaveDraft
      const iso = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
      memory.leaveDraft = { from: iso(d.from), to: iso(d.to), type: typeof d.type === 'string' ? d.type.slice(0, 40) : undefined, reason: typeof d.reason === 'string' ? d.reason.slice(0, 300) : undefined }
    }

    const out = await assistant.answer({ message, history, ctx, memory })
    const at = new Date().toISOString()
    await store.update(chatKey(actor.username), (cur) => [...(cur || []),
      { role: 'user', text: message, at },
      { role: 'assistant', text: out.reply, at, cards: out.cards, proposals: out.proposals, engine: out.engine },
    ].slice(-CHAT_MAX))
    await audit(actor, out.refused ? 'assistant.refused' : 'assistant.ask', (out.tools || []).join(', '), 'assistant', message.slice(0, 200))
    return { reply: out.reply, cards: out.cards || [], proposals: out.proposals || [], engine: out.engine, degraded: !!out.degraded, memory: out.memory || {} }
  }

  async function chatHistory(req) {
    const actor = await actorFrom(req)
    return { messages: (await store.get(chatKey(actor.username))) || [], engine: assistant.engine }
  }

  async function clearChat(req) {
    const actor = await actorFrom(req)
    await store.set(chatKey(actor.username), [])
    return { messages: [] }
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

  // --- user administration (super admin) ---------------------------------

  const USERNAME = /^[a-z][a-z0-9._-]{2,39}$/
  const accountRow = (u) => ({
    username: u.username, name: u.profile.name, email: u.profile.email, empId: u.profile.id,
    role: ROLES[u.role].label, roleKey: u.role, source: u.source === 'admin' ? 'admin' : 'seed',
    createdBy: u.createdBy || null, createdAt: u.createdAt || null,
  })

  async function requireAdmin(req) {
    const actor = await actorFrom(req)
    if (!actor.perms.includes(PERMS.ADMIN_SYSTEM)) throw new HttpError(403, 'Only a super admin can manage users.')
    return actor
  }

  async function listUsers(req) {
    await requireAdmin(req)
    return { users: (await users()).map(accountRow) }
  }

  async function createUser(req) {
    const actor = await requireAdmin(req)
    const b = await body(req)
    const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
    const name = text(b.name, 80) || fail('Full name is required')
    const username = text(b.username, 40).toLowerCase()
    if (!USERNAME.test(username)) fail('Username must be 3-40 characters: lowercase letters, numbers, dots, dashes or underscores, starting with a letter')
    const role = ROLES[b.role] ? b.role : fail('Pick a role')
    const password = typeof b.password === 'string' ? b.password : ''
    if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) fail('The password needs at least 8 characters, with letters and numbers')
    const passwordHash = await hashPassword(password)

    await users() // make sure the seeded accounts exist before checking for clashes
    const employees = await read('employees')
    const id = nextSerial(employees, 'FL', 1000)
    const profile = {
      id, name, email: text(b.email, 120) || username + '@' + BRAND.emailDomain,
      designation: text(b.designation, 80) || ROLES[role].label, department: text(b.department, 60) || 'Operations',
      location: text(b.location, 60) || 'Mumbai HQ', manager: text(b.manager, 80) || actor.name,
      joinDate: today(), phone: text(b.phone, 30) || 'Not provided', gender: text(b.gender, 20) || 'Not specified',
      employmentType: 'Permanent', bloodGroup: 'Not provided', dob: 'Not provided', grade: 'Not provided',
      bank: 'Not provided', pan: 'Not provided', uan: 'Not provided',
    }
    await store.update('users', (cur) => {
      if ((cur || []).some((u) => u.username === username)) fail('The username ' + username + ' is already taken')
      return [...(cur || []), { username, role, profile, passwordHash, source: 'admin', createdBy: actor.name, createdAt: new Date().toISOString() }]
    })
    // They join the People directory too.
    await store.update(keyFor('employees'), (cur) => [{
      id, name, email: profile.email, phone: profile.phone, department: profile.department,
      designation: profile.designation, location: profile.location, joinDate: profile.joinDate,
      status: 'Probation', manager: profile.manager, experience: '0 yrs', gender: profile.gender,
      employmentType: 'Permanent', username,
    }, ...(cur ?? clone(SEED.employees))])

    return { user: accountRow({ username, role, profile, source: 'admin', createdBy: actor.name }), state: await stateFor(actor) }
  }

  const ROUTES = {
    'GET /api/health': async () => ({ ok: true, time: new Date().toISOString() }),
    'POST /api/auth/login': login,
    'GET /api/auth/me': async (req) => ({ user: await actorFrom(req) }),
    'GET /api/state': async (req) => stateFor(await actorFrom(req)),
    'POST /api/actions': act,
    'POST /api/admin/reset': reset,
    'GET /api/admin/users': listUsers,
    'POST /api/admin/users': createUser,
    'GET /api/admin/audit': auditLog,
    'POST /api/assistant': ask,
    'GET /api/assistant/history': chatHistory,
    'POST /api/assistant/clear': clearChat,
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
