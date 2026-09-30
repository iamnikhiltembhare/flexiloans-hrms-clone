// API tests against an in-memory SQLite store: `npm run test:server`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from './app.js'
import { sqliteStore } from './store-sqlite.js'
import { localDate } from '../src/lib/actions.js'

const SECRET = 'test-secret-that-is-at-least-32-characters'
const BASE = 'http://api.test'

function setup() {
  const handle = createApp({ store: sqliteStore(':memory:'), secret: SECRET })
  const call = async (method, path, { token, body, origin } = {}) => {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = 'Bearer ' + token
    if (origin) headers.Origin = origin
    const res = await handle(new Request(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined }))
    return { status: res.status, headers: res.headers, data: await res.json().catch(() => null) }
  }
  const login = async (username, password) => (await call('POST', '/api/auth/login', { body: { username, password } })).data.token
  const act = (token, type, payload) => call('POST', '/api/actions', { token, body: { type, payload } })
  return { call, login, act }
}

const EMP = ['nikhil.tembhare', 'FlexiEmp@2026']
const HR = ['hr.manager', 'FlexiHR@2026']
const ADMIN = ['admin', 'Admin@2026']

test('login returns a token and the user; bad passwords are rejected', async () => {
  const { call } = setup()
  const ok = await call('POST', '/api/auth/login', { body: { username: 'Nikhil.Tembhare ', password: EMP[1] } })
  assert.equal(ok.status, 200)
  assert.equal(ok.data.user.name, 'Nikhil Tembhare')
  assert.equal(ok.data.user.roleKey, 'employee')
  assert.ok(!('passwordHash' in ok.data.user))

  const bad = await call('POST', '/api/auth/login', { body: { username: EMP[0], password: 'wrong' } })
  assert.equal(bad.status, 401)
})

test('five failed logins lock the account temporarily', async () => {
  const { call } = setup()
  for (let i = 0; i < 5; i++) await call('POST', '/api/auth/login', { body: { username: HR[0], password: 'nope' } })
  const locked = await call('POST', '/api/auth/login', { body: { username: HR[0], password: HR[1] } })
  assert.equal(locked.status, 429)
})

test('protected routes need a valid, untampered token', async () => {
  const { call, login } = setup()
  assert.equal((await call('GET', '/api/state')).status, 401)
  const token = await login(...EMP)
  assert.equal((await call('GET', '/api/state', { token })).status, 200)
  const [body, sig] = token.split('.')
  const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9e9 })).toString('base64url') + '.' + sig
  assert.equal((await call('GET', '/api/state', { token: forged })).status, 401)
  assert.equal((await call('GET', '/api/state', { token: body + '.x' + sig.slice(1) })).status, 401)
})

test('employees only see their own leave and tickets, and no hiring data', async () => {
  const { call, login } = setup()
  const emp = (await call('GET', '/api/state', { token: await login(...EMP) })).data
  assert.ok(emp.leaveRequests.length > 0)
  assert.ok(emp.leaveRequests.every((r) => r.empId === 'FL1009'))
  assert.ok(emp.tickets.length > 0)
  assert.ok(emp.tickets.every((t) => t.raisedById === 'FL1009'))
  assert.deepEqual(emp.candidates, [])
  assert.deepEqual(emp.requisitions, [])

  const hr = (await call('GET', '/api/state', { token: await login(...HR) })).data
  assert.ok(hr.leaveRequests.length > emp.leaveRequests.length)
  assert.ok(hr.candidates.length > 0)
})

test('leave flow: apply, HR is notified, HR approves, employee is notified', async () => {
  const { call, login, act } = setup()
  const emp = await login(...EMP)
  const hr = await login(...HR)

  const applied = await act(emp, 'leave.add', {
    request: { id: 'LV-9999', type: 'Casual Leave', from: '2026-10-05', to: '2026-10-06', reason: 'Trip', employee: 'Someone Else', empId: 'FL0001', status: 'Approved' },
  })
  assert.equal(applied.status, 200)
  const mine = applied.data.state.leaveRequests.find((r) => r.id === 'LV-9999')
  assert.equal(mine.employee, 'Nikhil Tembhare', 'server ignores a spoofed employee')
  assert.equal(mine.empId, 'FL1009')
  assert.equal(mine.status, 'Pending', 'server ignores a spoofed status')
  assert.equal(mine.days, 2)

  const hrState = (await call('GET', '/api/state', { token: hr })).data
  assert.match(hrState.notifications[0].title, /Leave request from Nikhil Tembhare/)

  assert.equal((await act(emp, 'leave.setStatus', { id: 'LV-9999', status: 'Approved' })).status, 403, 'employees cannot approve')
  const approved = await act(hr, 'leave.setStatus', { id: 'LV-9999', status: 'Approved' })
  assert.equal(approved.status, 200)
  assert.equal((await act(hr, 'leave.setStatus', { id: 'LV-9999', status: 'Rejected' })).status, 400, 'already decided')

  const empState = (await call('GET', '/api/state', { token: emp })).data
  assert.equal(empState.leaveRequests.find((r) => r.id === 'LV-9999').status, 'Approved')
  assert.match(empState.notifications[0].title, /Your leave was approved/)
})

test('HR cannot approve their own leave', async () => {
  const { login, act } = setup()
  const hr = await login(...HR)
  const r = await act(hr, 'leave.add', { request: { type: 'Sick Leave', from: '2026-10-01', to: '2026-10-01' } })
  const id = r.data.state.leaveRequests.find((x) => x.empId === 'FL1008').id
  assert.equal((await act(hr, 'leave.setStatus', { id, status: 'Approved' })).status, 403)
})

test('invalid input is rejected', async () => {
  const { login, act } = setup()
  const emp = await login(...EMP)
  assert.equal((await act(emp, 'leave.add', { request: { type: 'Casual Leave', from: '2026-10-09', to: '2026-10-01' } })).status, 400)
  assert.equal((await act(emp, 'leave.add', { request: { type: 'Casual Leave', from: 'soon', to: '2026-10-01' } })).status, 400)
  assert.equal((await act(emp, 'ticket.add', { ticket: { subject: '   ' } })).status, 400)
  assert.equal((await act(emp, 'no.such.action', {})).status, 400)
  assert.equal((await act(emp, 'employee.add', { employee: { name: 'X', designation: 'Y' } })).status, 403)
})

test('tickets: raised by an employee, resolved by HR, ids stay unique', async () => {
  const { login, act } = setup()
  const emp = await login(...EMP)
  const hr = await login(...HR)
  const a = await act(emp, 'ticket.add', { ticket: { id: 'HD-9000', subject: 'VPN access', priority: 'High' } })
  const b = await act(emp, 'ticket.add', { ticket: { id: 'HD-9000', subject: 'Second one' } })
  assert.equal(a.data.result, 'HD-9000')
  assert.notEqual(b.data.result, 'HD-9000', 'a duplicate id gets a fresh one')
  const done = await act(hr, 'ticket.setStatus', { id: 'HD-9000', status: 'Resolved', category: 'ignored' })
  assert.equal(done.data.state.tickets.find((t) => t.id === 'HD-9000').sla, 'Met')
})

test('punch in and out is per person', async () => {
  const { call, login, act } = setup()
  const emp = await login(...EMP)
  const first = await act(emp, 'punch.toggle', { now: '09:10 am', date: localDate() })
  assert.deepEqual(first.data.result, { action: 'out', now: '09:10 am' }, 'seed starts punched in')
  const again = await act(emp, 'punch.toggle', { now: '09:15 am', date: localDate() })
  assert.equal(again.data.result.action, 'in')
  const hrPunch = (await call('GET', '/api/state', { token: await login(...HR) })).data.punch
  assert.equal(hrPunch.inAt, '09:34 AM', 'another user is untouched')
})

test('admin reset restores the seed; others cannot reset', async () => {
  const { call, login, act } = setup()
  const hr = await login(...HR)
  await act(hr, 'announcement.add', { announcement: { title: 'Hello', body: 'World' } })
  assert.equal((await call('POST', '/api/admin/reset', { token: hr })).status, 403)
  const reset = await call('POST', '/api/admin/reset', { token: await login(...ADMIN) })
  assert.equal(reset.status, 200)
  assert.ok(!reset.data.state.announcements.some((a) => a.title === 'Hello'))
})

test('CORS allows the Android app origin and nothing unexpected', async () => {
  const { call } = setup()
  const app = await call('GET', '/api/health', { origin: 'https://localhost' })
  assert.equal(app.headers.get('access-control-allow-origin'), 'https://localhost')
  const evil = await call('GET', '/api/health', { origin: 'https://evil.example' })
  assert.equal(evil.headers.get('access-control-allow-origin'), null)
})

// --- test environment isolation ------------------------------------------

import { createEnvironments } from './environments.js'

function setupEnvs() {
  const handle = createEnvironments({ makeStore: () => sqliteStore(':memory:'), secret: SECRET })
  const call = async (method, path, { token, body } = {}) => {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = 'Bearer ' + token
    const res = await handle(new Request(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined }))
    return { status: res.status, data: await res.json().catch(() => null) }
  }
  const login = async (prefix, username, password) =>
    call('POST', prefix + '/api/auth/login', { body: { username, password } })
  return { call, login }
}

test('test accounts only work in the test environment, and vice versa', async () => {
  const { login } = setupEnvs()
  assert.equal((await login('/test', 'test.employee', 'TestEmp@2026')).status, 200)
  assert.equal((await login('/test', 'test.hr', 'TestHR@2026')).status, 200)
  assert.equal((await login('/test', 'test.admin', 'TestAdmin@2026')).status, 200)
  assert.equal((await login('', 'test.employee', 'TestEmp@2026')).status, 401, 'no test users in production')
  assert.equal((await login('/test', ...EMP)).status, 401, 'no demo users in test')
})

test('test and production data and tokens are isolated', async () => {
  const { call, login } = setupEnvs()
  const testToken = (await login('/test', 'test.employee', 'TestEmp@2026')).data.token
  const prodToken = (await login('', ...EMP)).data.token

  await call('POST', '/test/api/actions', { token: testToken, body: { type: 'ticket.add', payload: { ticket: { subject: 'Only in test' } } } })
  const hrProd = (await call('GET', '/api/state', { token: (await login('', ...HR)).data.token })).data
  assert.ok(!hrProd.tickets.some((t) => t.subject === 'Only in test'))
  const hrTest = (await call('GET', '/test/api/state', { token: (await login('/test', 'test.hr', 'TestHR@2026')).data.token })).data
  assert.ok(hrTest.tickets.some((t) => t.subject === 'Only in test'))

  assert.equal((await call('GET', '/api/state', { token: testToken })).status, 401, 'test token rejected in production')
  assert.equal((await call('GET', '/test/api/state', { token: prodToken })).status, 401, 'production token rejected in test')
})

test('accounts added to the code later are created without touching existing users', async () => {
  const store = sqliteStore(':memory:')
  const one = createApp({ store, secret: SECRET, accounts: [{ username: 'a', role: 'employee', profile: { id: 'X1', name: 'A' }, password: 'pw-a' }] })
  const r1 = await one(new Request(BASE + '/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'a', password: 'pw-a' }) }))
  assert.equal(r1.status, 200)
  const two = createApp({ store, secret: SECRET, accounts: [
    { username: 'a', role: 'employee', profile: { id: 'X1', name: 'A' }, password: 'changed-in-code' },
    { username: 'b', role: 'hr', profile: { id: 'X2', name: 'B' }, password: 'pw-b' },
  ] })
  const login = (u, p) => two(new Request(BASE + '/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }))
  assert.equal((await login('b', 'pw-b')).status, 200, 'new account created')
  assert.equal((await login('a', 'pw-a')).status, 200, 'existing password kept')
})

// --- directory logins -----------------------------------------------------

import { employees } from '../src/data/mock.js'

test('every directory employee can sign in with the employee password', async () => {
  const { call } = setup()
  const usernames = employees.map((e) => e.username)
  assert.equal(new Set(usernames).size, usernames.length, 'usernames are unique')
  assert.ok(usernames.includes('arjun.joshi2'), 'repeated names get a number')
  for (const e of employees.filter((x) => x.username !== 'hr.manager')) {
    const r = await call('POST', '/api/auth/login', { body: { username: e.username, password: 'FlexiEmp@2026' } })
    assert.equal(r.status, 200, e.username)
    assert.equal(r.data.user.id, e.id)
    assert.equal(r.data.user.roleKey, 'employee')
  }
})

test('a directory employee sees only their own leave, and it carries their name', async () => {
  const { call, login } = setup()
  const person = employees.find((e) => e.id === 'FL1015')
  const token = await login(person.username, 'FlexiEmp@2026')
  const state = (await call('GET', '/api/state', { token })).data
  assert.ok(state.leaveRequests.length > 0)
  assert.ok(state.leaveRequests.every((r) => r.empId === 'FL1015' && r.employee === person.name))
})

test('removed accounts stop working; kept ones keep their password', async () => {
  const store = sqliteStore(':memory:')
  const acct = (username, password) => ({ username, role: 'employee', profile: { id: username, name: username }, password })
  const login = (app, u, p) => app(new Request(BASE + '/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }))
  const before = createApp({ store, secret: SECRET, accounts: [acct('keep', 'pw-keep'), acct('old', 'pw-old')] })
  assert.equal((await login(before, 'old', 'pw-old')).status, 200)
  const after = createApp({ store, secret: SECRET, accounts: [acct('keep', 'changed'), acct('new', 'pw-new')] })
  assert.equal((await login(after, 'old', 'pw-old')).status, 401, 'removed')
  assert.equal((await login(after, 'keep', 'pw-keep')).status, 200, 'password kept')
  assert.equal((await login(after, 'new', 'pw-new')).status, 200, 'added')
})

// --- ticket approvals across departments ----------------------------------

test('HR works HR tickets; other departments need a super admin to approve', async () => {
  const { login, act } = setup()
  const emp = await login(...EMP)
  const hr = await login(...HR)
  const admin = await login(...ADMIN)
  const it = (await act(emp, 'ticket.add', { ticket: { subject: 'VPN access', category: 'IT' } })).data
  const itId = it.result
  assert.equal(it.state.tickets.find((t) => t.id === itId).assignee, 'IT Helpdesk', 'routed to the owning desk')
  const payroll = (await act(emp, 'ticket.add', { ticket: { subject: 'Payslip query', category: 'Payroll' } })).data.result

  assert.equal((await act(hr, 'ticket.setStatus', { id: payroll, status: 'Resolved' })).status, 200, 'HR resolves HR tickets')
  assert.equal((await act(hr, 'ticket.setStatus', { id: itId, status: 'In Progress' })).status, 403, 'HR cannot work IT tickets')
  assert.equal((await act(hr, 'ticket.setStatus', { id: payroll, status: 'Approved' })).status, 403, 'HR cannot approve')
  assert.equal((await act(emp, 'ticket.setStatus', { id: itId, status: 'Approved' })).status, 403)

  const ok = await act(admin, 'ticket.setStatus', { id: itId, status: 'Approved' })
  assert.equal(ok.status, 200)
  const t = ok.data.state.tickets.find((x) => x.id === itId)
  assert.equal(t.status, 'Approved')
  assert.equal(t.decidedBy, 'System Administrator')
  assert.equal((await act(admin, 'ticket.setStatus', { id: payroll, status: 'Approved' })).status, 400, 'cannot approve a closed ticket')
})

// --- punch history ----------------------------------------------------------

test('punches keep the first in and last out of each day', async () => {
  const { login, act } = setup()
  const emp = await login(...EMP)
  const d = localDate()
  await act(emp, 'punch.toggle', { now: '09:10 am', date: d }) // seed starts punched in -> out
  await act(emp, 'punch.toggle', { now: '09:40 am', date: d }) // in
  const out = await act(emp, 'punch.toggle', { now: '06:55 pm', date: d }) // out
  const day = out.data.state.punch.history[d]
  assert.equal(day.out, '06:55 pm')
  assert.ok(day.in, 'first in recorded')
  assert.equal((await act(emp, 'punch.toggle', { now: '09:00 am', date: '2020-01-01' })).status, 400, 'far-off dates are rejected')
})

// --- user administration ----------------------------------------------------

test('a super admin can create a user who can then sign in', async () => {
  const { call, login } = setup()
  const admin = await login(...ADMIN)
  const hr = await login(...HR)
  const body = { name: 'Priya Kapoor', username: 'priya.kapoor', role: 'hr', department: 'Human Resources', password: 'Harbour4Tide' }
  assert.equal((await call('POST', '/api/admin/users', { token: hr, body })).status, 403, 'HR cannot create users')
  assert.equal((await call('POST', '/api/admin/users', { token: admin, body: { ...body, password: 'short' } })).status, 400)
  assert.equal((await call('POST', '/api/admin/users', { token: admin, body: { ...body, username: 'nikhil.tembhare' } })).status, 400, 'taken')

  const made = await call('POST', '/api/admin/users', { token: admin, body })
  assert.equal(made.status, 200)
  assert.ok(made.data.state.employees.some((e) => e.username === 'priya.kapoor'), 'added to the directory')

  const r = await call('POST', '/api/auth/login', { body: { username: 'priya.kapoor', password: 'Harbour4Tide' } })
  assert.equal(r.status, 200)
  assert.equal(r.data.user.roleKey, 'hr')
  const list = (await call('GET', '/api/admin/users', { token: admin })).data.users
  assert.equal(list.find((u) => u.username === 'priya.kapoor').source, 'admin')
})

test('users created by an admin survive the code account sync', async () => {
  const store = sqliteStore(':memory:')
  const acct = (username, password) => ({ username, role: 'employee', profile: { id: username, name: username }, password })
  const v1 = createApp({ store, secret: SECRET, accounts: [acct('seed', 'pw-seed')] })
  const tok = async (app) => (await (await app(new Request(BASE + '/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'seed', password: 'pw-seed' }) }))).json()).token
  // make "seed" an admin for this test by giving the store a super admin
  const adminApp = createApp({ store, secret: SECRET, accounts: [acct('seed', 'pw-seed'), { ...acct('boss', 'pw-boss'), role: 'super_admin' }] })
  const boss = await (await adminApp(new Request(BASE + '/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'boss', password: 'pw-boss' }) }))).json()
  const made = await adminApp(new Request(BASE + '/api/admin/users', { method: 'POST', headers: { Authorization: 'Bearer ' + boss.token },
    body: JSON.stringify({ name: 'New Person', username: 'new.person', role: 'employee', password: 'Lantern72x' }) }))
  assert.equal(made.status, 200)
  // A later deploy with a different code account list keeps the admin-made user.
  const v2 = createApp({ store, secret: SECRET, accounts: [acct('seed', 'pw-seed')] })
  const r = await v2(new Request(BASE + '/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'new.person', password: 'Lantern72x' }) }))
  assert.equal(r.status, 200)
  assert.ok(await tok(v1))
})

// --- attendance regularisation ----------------------------------------------

test('regularisation: employee requests, HR is notified and approves, employee is notified', async () => {
  const { call, login, act } = setup()
  const emp = await login(...EMP)
  const hr = await login(...HR)
  const day = localDate(new Date(Date.now() - 2 * 86400000))
  const req = { date: day, in: '09:45', out: '19:05', type: 'Missed punch', reason: 'Card reader was down', empId: 'FL0001', status: 'Approved' }

  const made = await act(emp, 'regularisation.add', { request: req })
  assert.equal(made.status, 200)
  const mine = made.data.state.regularisations.find((r) => r.id === made.data.result)
  assert.equal(mine.empId, 'FL1009', 'server sets the employee')
  assert.equal(mine.status, 'Pending', 'server ignores a spoofed status')
  assert.equal((await act(emp, 'regularisation.add', { request: req })).status, 400, 'one pending request per day')

  const hrState = (await call('GET', '/api/state', { token: hr })).data
  assert.match(hrState.notifications[0].title, /Regularisation request from Nikhil Tembhare/)
  assert.equal((await act(emp, 'regularisation.decide', { id: mine.id, status: 'Approved' })).status, 403, 'employees cannot approve')
  assert.equal((await act(hr, 'regularisation.decide', { id: mine.id, status: 'Approved' })).status, 200)

  const empState = (await call('GET', '/api/state', { token: emp })).data
  assert.equal(empState.regularisations.find((r) => r.id === mine.id).status, 'Approved')
  assert.ok(empState.regularisations.every((r) => r.empId === 'FL1009'), 'employees see only their own')
  assert.match(empState.notifications[0].title, /Regularisation approved/)
})

test('regularisation input is validated', async () => {
  const { login, act } = setup()
  const emp = await login(...EMP)
  const day = localDate(new Date(Date.now() - 86400000))
  const add = (r) => act(emp, 'regularisation.add', { request: { date: day, reason: 'x', ...r } })
  assert.equal((await add({ in: '', out: '' })).status, 400, 'needs a time')
  assert.equal((await add({ in: '19:00', out: '09:00' })).status, 400, 'out after in')
  assert.equal((await add({ in: '9am' })).status, 400, 'time format')
  assert.equal((await add({ in: '09:30', reason: '  ' })).status, 400, 'reason required')
  assert.equal((await add({ in: '09:30', date: localDate(new Date(Date.now() + 5 * 86400000)) })).status, 400, 'no future days')
  assert.equal((await add({ in: '09:30', date: '2026-01-01' })).status, 400, 'older than 60 days')
})

// --- HR Assistant -----------------------------------------------------------

import { createAssistant } from './assistant.js'

function setupWith(assistant) {
  const handle = createApp({ store: sqliteStore(':memory:'), secret: SECRET, assistant })
  const call = async (method, path, { token, body } = {}) => {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = 'Bearer ' + token
    const res = await handle(new Request(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined }))
    return { status: res.status, data: await res.json().catch(() => null) }
  }
  const login = async (u, p) => (await call('POST', '/api/auth/login', { body: { username: u, password: p } })).data.token
  return { call, login }
}

test('assistant (built-in engine): HR lists, proposes, confirms; the change is audited', async () => {
  const { call, login } = setupWith(createAssistant())
  const hr = await login(...HR)
  const admin = await login(...ADMIN)
  const ask = (message, memory) => call('POST', '/api/assistant', { token: hr, body: { message, memory } })

  const list = await ask('Show pending leave requests from the Engineering department')
  assert.equal(list.status, 200)
  assert.equal(list.data.engine, 'rules')
  assert.match(list.data.reply, /Nikhil Tembhare/)
  assert.equal(list.data.cards[0].kind, 'table')

  const prop = await ask('Approve the first one', list.data.memory)
  const p = prop.data.proposals[0]
  assert.deepEqual({ type: p.type, payload: p.payload }, { type: 'leave.setStatus', payload: { id: 'LV-2041', status: 'Approved' } })
  const before = (await call('GET', '/api/state', { token: hr })).data.leaveRequests.find((r) => r.id === 'LV-2041')
  assert.equal(before.status, 'Pending', 'nothing changes until confirmed')

  assert.equal((await call('POST', '/api/actions', { token: hr, body: { type: p.type, payload: p.payload, via: 'assistant' } })).status, 200)
  const log = (await call('GET', '/api/admin/audit', { token: admin })).data.entries
  assert.ok(log.some((e) => e.action === 'leave.setStatus' && e.target === 'LV-2041' && e.via === 'assistant' && e.actor === 'Aarti Deshmukh'))
  assert.ok(log.some((e) => e.action === 'assistant.ask'))
  assert.equal((await call('GET', '/api/admin/audit', { token: hr })).status, 403, 'audit log is admin only')

  const hist = (await call('GET', '/api/assistant/history', { token: hr })).data.messages
  assert.equal(hist.length, 4)
})

test('assistant refuses sensitive requests and keeps employees to their own data', async () => {
  const { call, login } = setupWith(createAssistant())
  const emp = await login(...EMP)
  const ask = (message) => call('POST', '/api/assistant', { token: emp, body: { message } })
  assert.match((await ask('Increase my salary by 20%')).data.reply, /outside what I can do/)
  assert.match((await ask('Terminate Rahul Patel')).data.reply, /outside what I can do/)
  assert.match((await ask('Approve Arjun Joshi leave')).data.reply, /Only HR/)
  assert.match((await ask('How many employees are absent today?')).data.reply, /visible to HR only/)
  assert.match((await ask('Show open positions')).data.reply, /limited to the HR team/)
})

test('assistant (Claude path): tools run with the user\'s permissions and results go back to the model', async () => {
  const calls = []
  const scripted = [
    { stop_reason: 'tool_use', content: [
      { type: 'text', text: 'Let me check.' },
      { type: 'tool_use', id: 't1', name: 'list_leave_requests', input: { status: 'Pending' } },
      { type: 'tool_use', id: 't2', name: 'propose_leave_decision', input: { employee_or_request: 'Arjun Joshi', decision: 'approve' } },
    ] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done looking.' }] },
  ]
  const fake = { beta: { messages: { create: async (params) => { calls.push(structuredClone(params)); return scripted[calls.length - 1] } } } }
  const { call, login } = setupWith(createAssistant({ client: fake }))
  const emp = await login(...EMP)
  const r = await call('POST', '/api/assistant', { token: emp, body: { message: 'approve arjun joshi leave' } })
  assert.equal(r.data.engine, 'claude')
  assert.equal(r.data.reply, 'Done looking.')
  assert.equal(r.data.proposals.length, 0, 'an employee gets no approval proposal')

  const first = calls[0]
  assert.equal(first.model, 'claude-opus-5')
  assert.deepEqual(first.thinking, { type: 'adaptive' })
  assert.equal(first.fallbacks, 'default')
  assert.ok(first.tools.some((t) => t.name === 'propose_leave_decision'))
  assert.match(first.system[1].text, /Nikhil Tembhare/)

  const results = calls[1].messages.at(-1).content
  assert.equal(results.length, 2, 'both tool results in one message')
  const [list, propose] = results
  assert.ok(JSON.parse(list.content).requests.every((q) => q.employee === 'Nikhil Tembhare'), 'model sees only the employee\'s own requests')
  assert.equal(propose.is_error, true)
  assert.match(JSON.parse(propose.content).error, /Only HR/)
})

test('assistant falls back to the built-in engine when the model call fails', async () => {
  const fake = { beta: { messages: { create: async () => { throw new Error('network down') } } } }
  const { call, login } = setupWith(createAssistant({ client: fake }))
  const hr = await login(...HR)
  const r = await call('POST', '/api/assistant', { token: hr, body: { message: 'show pending leave requests' } })
  assert.equal(r.status, 200)
  assert.equal(r.data.engine, 'rules')
  assert.equal(r.data.degraded, true)
  assert.match(r.data.reply, /requests/)
})

// --- payroll and leave balances ----------------------------------------------

test('payroll: HR runs a month, amounts are recomputed server-side, paying releases payslips', async () => {
  const { call, login, act } = setup()
  const hr = await login(...HR)
  const emp = await login(...EMP)
  const now = new Date()
  const month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')

  assert.equal((await act(emp, 'payroll.run', { month })).status, 403, 'employees cannot run payroll')
  const forged = { month, bonusPercent: 10, payslips: [{ id: 'x', empId: 'FL1009', net: 99999999 }], run: { id: 'x', net: 1 } }
  const ran = await act(hr, 'payroll.run', forged)
  assert.equal(ran.status, 200)
  const pr = ran.data.state.payroll
  const run = pr.runs.find((r) => r.month === month)
  assert.equal(run.status, 'Processed')
  assert.equal(run.bonusPercent, 10)
  const mine = pr.payslips.filter((p) => p.month === month)
  assert.equal(mine.length, pr.payslips.filter((p) => p.month === '2026-08').length, 'one payslip per employee')
  assert.ok(mine.every((p) => p.net < 1000000 && p.net === p.gross - p.totalDeductions), 'forged amounts ignored')
  assert.ok(mine.find((p) => p.empId === 'FL1009').earnings.some((e) => /Bonus/.test(e.head)))

  const before = (await call('GET', '/api/state', { token: emp })).data.payroll
  assert.ok(!before.payslips.some((p) => p.month === month), 'not visible to employees until paid')
  assert.ok(before.payslips.every((p) => p.empId === 'FL1009'), 'employees see only their own payslips')
  assert.ok(before.runs.every((r) => r.net === undefined), 'employees do not see company totals')

  assert.equal((await act(hr, 'payroll.pay', { month })).status, 200)
  const after = (await call('GET', '/api/state', { token: emp })).data
  assert.ok(after.payroll.payslips.some((p) => p.month === month))
  assert.match(after.notifications[0].title, /Payslip for .* is ready/)
  assert.equal((await act(hr, 'payroll.run', { month })).status, 400, 'a paid month is locked')
  assert.equal((await act(hr, 'payroll.run', { month: '2099-01' })).status, 400, 'no future months')
})

test('leave requests cannot exceed the remaining balance', async () => {
  const { login, act } = setup()
  const emp = await login(...EMP)
  const y = new Date().getFullYear() + 1
  const over = await act(emp, 'leave.add', { request: { type: 'Restricted Holiday', from: y + '-03-02', to: y + '-03-03' } })
  assert.equal(over.status, 400)
  assert.match(over.data.error, /Only 1 day of Restricted Holiday left/)
  assert.equal((await act(emp, 'leave.add', { request: { type: 'Restricted Holiday', from: y + '-03-02', to: y + '-03-02' } })).status, 200)
  assert.equal((await act(emp, 'leave.add', { request: { type: 'Restricted Holiday', from: y + '-04-06', to: y + '-04-06' } })).status, 400, 'the pending day counts')
  assert.equal((await act(emp, 'leave.add', { request: { type: 'Leave Without Pay', from: y + '-05-04', to: y + '-05-29' } })).status, 200, 'unpaid leave has no cap')
})

test('work-from-home punches are recorded', async () => {
  const { login, act } = setup()
  const emp = await login(...EMP)
  const d = localDate()
  await act(emp, 'punch.toggle', { now: '09:10 am', date: d }) // seed starts punched in -> out
  const r = await act(emp, 'punch.toggle', { now: '09:40 am', date: d, mode: 'Remote' })
  assert.equal(r.data.state.punch.history[d].mode, 'Remote', 'the day is marked as work from home')
  await act(emp, 'punch.toggle', { now: '01:00 pm', date: d })
  const again = await act(emp, 'punch.toggle', { now: '02:00 pm', date: d, mode: 'Office' })
  assert.equal(again.data.state.punch.history[d].mode, 'Remote', 'the first chosen mode of the day is kept')
})

// --- recruitment, onboarding and appraisals ----------------------------------

test('recruitment: add, schedule, score and hire a candidate; employees are kept out', async () => {
  const { call, login, act } = setup()
  const hr = await login(...HR)
  const emp = await login(...EMP)
  const candidate = { name: 'Priya Nair', role: 'Credit Analyst', source: 'Referral', stage: 'Hired', status: 'Hired' }
  assert.equal((await act(emp, 'candidate.add', { candidate })).status, 403)
  const added = await act(hr, 'candidate.add', { candidate })
  assert.equal(added.status, 200)
  const c = added.data.state.candidates.find((x) => x.name === 'Priya Nair')
  assert.equal(c.stage, 'Shortlisted', 'stage and status are set by the server')
  assert.equal(c.status, 'Active')
  assert.equal((await act(hr, 'candidate.add', { candidate })).status, 400, 'no duplicates')

  assert.equal((await act(hr, 'candidate.schedule', { name: 'Priya Nair', interview: { round: 'Tech Screen', at: 'soon', interviewer: 'Rahul Patel' } })).status, 400)
  const booked = await act(hr, 'candidate.schedule', { name: 'Priya Nair', interview: { round: 'Tech Screen', at: '2026-10-05T11:00', interviewer: 'Rahul Patel', mode: 'Phone' } })
  assert.equal(booked.data.state.candidates.find((x) => x.name === 'Priya Nair').interviews[0].status, 'Scheduled')

  assert.equal((await act(hr, 'candidate.decide', { name: 'Priya Nair', decision: 'Hired' })).status, 400, 'no hire without a scorecard')
  assert.equal((await act(hr, 'candidate.evaluate', { name: 'Priya Nair', evaluation: { round: 'Tech Screen', technical: 9, communication: 4, culture: 4, recommendation: 'Hire' } })).status, 400, 'scores are 1-5')
  const scored = await act(hr, 'candidate.evaluate', { name: 'Priya Nair', evaluation: { round: 'Tech Screen', technical: 5, communication: 4, culture: 3, recommendation: 'Hire' }, rating: 1 })
  const s = scored.data.state.candidates.find((x) => x.name === 'Priya Nair')
  assert.equal(s.rating, 4, 'the rating is computed server-side')
  assert.equal(s.interviews[0].status, 'Completed', 'the scored round is closed')

  const hired = await act(hr, 'candidate.decide', { name: 'Priya Nair', decision: 'Hired', reason: 'Strong analytics' })
  assert.equal(hired.status, 200)
  assert.equal(hired.data.state.candidates.find((x) => x.name === 'Priya Nair').stage, 'Hired')
  assert.equal((await act(hr, 'candidate.decide', { name: 'Priya Nair', decision: 'Rejected' })).status, 400, 'decisions are final')
  assert.deepEqual((await call('GET', '/api/state', { token: emp })).data.candidates, [])
})

test('onboarding: HR starts a checklist, the joiner ticks only their own tasks and acknowledges policies', async () => {
  const { call, login, act } = setup()
  const hr = await login(...HR)
  const emp = await login(...EMP)
  const joiner = await login('rahul.patel', EMP[1])
  assert.equal((await act(emp, 'onboarding.start', { record: { name: 'X', role: 'Y', startDate: '2026-10-01' } })).status, 403)

  const mine = (await call('GET', '/api/state', { token: joiner })).data.onboarding
  assert.equal(mine.length, 1, 'the joiner sees only their own record')
  const rec = mine[0]
  assert.equal((await call('GET', '/api/state', { token: emp })).data.onboarding.length, 0)
  const hrTask = rec.tasks.find((t) => t.owner === 'IT' && !t.done)
  const myTask = rec.tasks.find((t) => t.owner === 'New joiner' && !t.done)
  assert.equal((await act(joiner, 'onboarding.task', { id: rec.id, taskId: hrTask.id, done: true })).status, 403, 'IT tasks are not the joiner\'s')
  assert.equal((await act(joiner, 'onboarding.task', { id: rec.id, taskId: myTask.id, done: true })).status, 200)
  assert.equal((await act(emp, 'onboarding.ack', { id: rec.id, policy: 'POSH policy' })).status, 403, 'only the joiner acknowledges')
  const acked = await act(joiner, 'onboarding.ack', { id: rec.id, policy: 'Information security and acceptable use' })
  assert.equal(acked.data.state.onboarding[0].acknowledgements.length, 3)
  assert.equal((await act(hr, 'onboarding.task', { id: rec.id, taskId: hrTask.id, done: true })).status, 200, 'HR can tick any task')

  const started = await act(hr, 'onboarding.start', { record: { name: 'Priya Nair', role: 'Data Engineer', department: 'Engineering', startDate: '2026-10-12' } })
  assert.equal(started.status, 200)
  const made = started.data.state.onboarding.find((r) => r.name === 'Priya Nair')
  assert.match(made.id, /^OB-\d+$/)
  assert.ok(made.tasks.some((t) => /developer image/.test(t.task)), 'tech roles get engineering tasks')
  assert.equal((await act(hr, 'onboarding.start', { record: { name: 'Priya Nair', role: 'Data Engineer', startDate: '2026-10-12' } })).status, 400, 'one active record per person')
})

test('appraisals: goals, self review, then someone else completes the review', async () => {
  const { call, login, act } = setup()
  const hr = await login(...HR)
  const emp = await login(...EMP)
  const state = (await call('GET', '/api/state', { token: emp })).data
  assert.equal(state.appraisals.length, 1, 'employees see only their own appraisal')
  const a = state.appraisals[0]
  const other = (await call('GET', '/api/state', { token: hr })).data.appraisals.find((x) => x.empId !== a.empId && x.status === 'Self review')
  assert.equal((await act(emp, 'appraisal.progress', { id: other.id, goalId: other.goals[0].id, progress: 90 })).status, 403, 'not someone else\'s')

  assert.equal(a.status, 'Self review', 'the demo employee starts at self review')
  {
    const added = await act(emp, 'appraisal.goal', { id: a.id, goal: { title: 'Mentor two interns', weight: 10, due: '2026-12-31' } })
    assert.equal(added.status, 200)
    assert.equal((await act(emp, 'appraisal.self', { id: a.id, self: { rating: 4, comments: 'Good half', competencies: { 'Customer focus': 4, Execution: 4, Collaboration: 4, Ownership: 4, Communication: 4 } } })).status, 400, 'weights must total 100')
    const g = added.data.state.appraisals[0].goals.find((x) => x.title === 'Mentor two interns')
    await act(emp, 'appraisal.goal', { id: a.id, goal: { ...g, weight: 5 } })
    await act(emp, 'appraisal.goal', { id: a.id, goal: { ...a.goals[0], weight: 35 } })
    assert.equal((await act(emp, 'appraisal.self', { id: a.id, self: { rating: 4, comments: 'Good half', competencies: { Execution: 4 } } })).status, 400, 'every competency is rated')
    const self = await act(emp, 'appraisal.self', { id: a.id, self: { rating: 4.2, comments: 'Good half', competencies: { 'Customer focus': 4, Execution: 5, Collaboration: 4, Ownership: 4, Communication: 3 } } })
    assert.equal(self.status, 200, self.data.error)
    assert.equal(self.data.state.appraisals[0].status, 'Manager review')
  }

  const hrUser = (await call('GET', '/api/auth/me', { token: hr })).data.user
  const own = (await call('GET', '/api/state', { token: hr })).data.appraisals.find((x) => x.empId === hrUser.id)
  const review = { rating: 4, comments: 'Solid delivery', competencies: { 'Customer focus': 4, Execution: 4, Collaboration: 4, Ownership: 4, Communication: 4 } }
  assert.equal((await act(hr, 'appraisal.review', { id: own.id, manager: review })).status, 403, 'nobody reviews themselves')
  assert.equal((await act(emp, 'appraisal.review', { id: a.id, manager: review })).status, 403)
  const done = await act(hr, 'appraisal.review', { id: a.id, manager: review })
  assert.equal(done.status, 200, done.data.error)
  const after = (await call('GET', '/api/state', { token: emp })).data
  assert.equal(after.appraisals[0].status, 'Completed')
  assert.equal(after.appraisals[0].manager.by, hrUser.name)
  assert.match(after.notifications[0].title, /appraisal is complete/)
})

// --- training, grievances and alerts -------------------------------------------

test('training: employees enrol and complete their own courses; HR assigns by skill gap', async () => {
  const { call, login, act } = setup()
  const hr = await login(...HR)
  const emp = await login(...EMP)
  const t = (await call('GET', '/api/state', { token: emp })).data.training
  assert.ok(t.courses.length >= 10)
  assert.ok(t.enrollments.every((e) => e.empId === 'FL1009'), 'employees see only their own enrolments')
  assert.equal((await act(emp, 'course.add', { course: { title: 'X', skill: 'Y', hours: 2 } })).status, 403)

  const course = t.courses.find((c) => !t.enrollments.some((e) => e.courseId === c.id))
  const enrolled = await act(emp, 'course.enroll', { courseId: course.id })
  assert.equal(enrolled.status, 200)
  assert.equal((await act(emp, 'course.enroll', { courseId: course.id })).status, 400, 'no double enrolment')
  const mine = enrolled.data.state.training.enrollments.find((e) => e.courseId === course.id)
  const others = (await call('GET', '/api/state', { token: hr })).data.training.enrollments.find((e) => e.empId !== 'FL1009')
  assert.equal((await act(emp, 'course.progress', { id: others.id, progress: 100 })).status, 403, 'not someone else\'s course')
  const done = await act(emp, 'course.progress', { id: mine.id, progress: 100 })
  assert.equal(done.data.state.training.enrollments.find((e) => e.id === mine.id).status, 'Completed')

  const added = await act(hr, 'course.add', { course: { title: 'Credit bureau deep dive', skill: 'Credit underwriting', hours: 6 } })
  assert.equal(added.status, 200)
  const cid = added.data.state.training.courses.find((c) => c.title === 'Credit bureau deep dive').id
  assert.equal((await act(hr, 'course.assign', { courseId: cid, empIds: ['FL1009'], due: 'soon' })).status, 400)
  const assigned = await act(hr, 'course.assign', { courseId: cid, empIds: ['FL1009', 'FL1015', 'NOPE'], due: '2026-11-30' })
  assert.equal(assigned.data.result, 2, 'unknown people are ignored')
  const note = (await call('GET', '/api/state', { token: emp })).data.notifications[0]
  assert.match(note.title, /Training assigned/)
})

test('grievances: confidential, anonymous cases hide the raiser everywhere, internal notes stay internal', async () => {
  const { call, login, act } = setup()
  const hr = await login(...HR)
  const emp = await login(...EMP)
  const admin = await login(...ADMIN)
  const other = await login('rahul.patel', EMP[1])
  const g = { category: 'Manager conduct', severity: 'Low', subject: 'Shouting in reviews', description: 'Happens weekly.', anonymous: true, raisedById: 'FL1050' }
  const raised = await act(emp, 'grievance.add', { grievance: g })
  assert.equal(raised.status, 200)
  const id = raised.data.result
  const own = raised.data.state.grievances.find((x) => x.id === id)
  assert.equal(own.raisedById, 'FL1009', 'the raiser is always the signed-in person')
  assert.equal(own.status, 'Submitted')

  const hrView = (await call('GET', '/api/state', { token: hr })).data.grievances.find((x) => x.id === id)
  assert.ok(hrView, 'HR sees the case')
  assert.equal(hrView.raisedBy, undefined, 'but not who raised it')
  assert.equal(hrView.raisedById, undefined)
  assert.ok(!(await call('GET', '/api/state', { token: other })).data.grievances.some((x) => x.id === id), 'other employees never see it')
  const audit = (await call('GET', '/api/admin/audit', { token: admin })).data.entries.find((e) => e.action === 'grievance.add')
  assert.equal(audit.actor, 'Anonymous', 'the audit log does not reveal the raiser')

  assert.equal((await act(emp, 'grievance.update', { id, status: 'Closed', note: 'x' })).status, 403, 'employees cannot handle cases')
  assert.equal((await act(hr, 'grievance.update', { id, status: 'Under investigation' })).status, 400, 'status changes need a note')
  await act(hr, 'grievance.update', { id, status: 'Under investigation', note: 'Speaking to the team', internal: false, assignedTo: 'Aarti Deshmukh' })
  await act(hr, 'grievance.update', { id, status: 'Under investigation', note: 'Manager has a prior warning', internal: true })
  const mine = (await call('GET', '/api/state', { token: emp })).data
  const seen = mine.grievances.find((x) => x.id === id)
  assert.equal(seen.updates.length, 1, 'the raiser does not see internal notes')
  assert.match(mine.notifications[0].title, /Update on your case/)
  const reply = await act(emp, 'grievance.reply', { id, note: 'It happened again today' })
  assert.equal(reply.data.state.grievances.find((x) => x.id === id).updates.at(-1).by, 'Anonymous raiser')
  assert.equal((await act(other, 'grievance.reply', { id, note: 'hi' })).status, 403)

  const posh = await act(emp, 'grievance.add', { grievance: { category: 'Harassment (POSH)', severity: 'Low', subject: 'Messages', description: 'Details' } })
  const p = posh.data.state.grievances.find((x) => x.id === posh.data.result)
  assert.equal(p.severity, 'High', 'POSH cases are never below high')
  assert.equal(p.assignedTo, 'Internal Committee')
})

test('alerts and attrition risk are computed from live data', async () => {
  const { alertsFor, attritionRisk } = await import('../src/lib/hr/insights.js')
  const { SEED } = await import('../src/data/seed.js')
  const { PERMS } = await import('../src/data/accounts.js')
  const today = '2026-09-28'
  const hrAlerts = alertsFor(SEED, { user: { id: 'FL1003', name: 'Aarti Deshmukh' }, can: () => true, perms: PERMS, today, nowMin: 600 })
  assert.equal(hrAlerts[0].level, 'critical', 'critical alerts come first')
  assert.ok(hrAlerts.some((a) => a.id === 'gr-overdue'), 'grievances past SLA escalate')
  const empAlerts = alertsFor(SEED, { user: { id: 'FL1009', name: 'Nikhil Tembhare' }, can: (p) => p === PERMS.SELF, perms: PERMS, today, nowMin: 600 })
  assert.ok(!empAlerts.some((a) => a.id.startsWith('gr-') || a.id === 'pay-run'), 'employees get no HR alerts')
  const notice = SEED.employees.find((e) => e.status === 'On Notice')
  const r = attritionRisk(notice, { ...SEED, today })
  assert.equal(r.level, 'High')
  assert.ok(r.factors.every((f) => f.label && f.points > 0), 'every point is explained')
})

// --- employee self-service assistant -------------------------------------------

test('assistant (built-in engine) handles the everyday employee questions', async () => {
  const { call, login } = setupWith(createAssistant())
  const emp = await login(...EMP)
  let memory = {}
  const ask = async (message) => {
    const r = (await call('POST', '/api/assistant', { token: emp, body: { message, memory, today: '2026-09-28', nowMin: 600 } })).data
    memory = { ...memory, leaveDraft: undefined, ...(r.memory || {}) }
    return r
  }
  assert.match((await ask('How many casual leaves do I have left?')).reply, /days? of Casual Or Sick Leave left/)
  assert.match((await ask('What is the work-from-home policy?')).reply, /2 days a week.*Source: Work from home policy/s)
  assert.match((await ask('Where can I download my pay slip?')).reply, /Print or save PDF/)
  const why = await ask('Why was my salary deduction higher this month?')
  assert.ok(!why.refused, 'your own deductions are not a sensitive topic')
  assert.match(why.reply, /deductions were Rs/)
  assert.match((await ask('What are the company holidays this year?')).reply, /company holidays in 2026/)
  assert.match((await ask('When is my performance review?')).reply, /2026-10-12/)
  assert.match((await ask('Is there a policy on pet insurance for goldfish?')).reply, /rather not guess/)

  // Leave: dates, then the assistant asks for type and reason, then proposes.
  assert.match((await ask('Apply for leave from October 5 to October 7')).reply, /Which type of leave.*3 working days/)
  assert.match((await ask('privilege')).reply, /What is the reason/)
  const leave = await ask('visiting my parents in Nagpur')
  assert.equal(leave.proposals[0].type, 'leave.add')
  assert.equal(leave.proposals[0].payload.request.reason, 'visiting my parents in Nagpur')
  assert.match((await ask('apply for casual leave on 2 October because of travel')).reply, /Gandhi Jayanti, a company holiday/)

  const ticket = await ask('Create an HR ticket for a payroll problem.')
  assert.equal(ticket.proposals[0].type, 'ticket.add')
  assert.equal(ticket.proposals[0].payload.ticket.category, 'Payroll')
  const contact = await ask('Update my emergency contact to Sunita Tembhare, +91 98330 22118, spouse')
  assert.equal(contact.proposals[0].type, 'profile.update')
  assert.match((await ask('What is Rahul\'s salary?')).reply, /outside what I can do/)
  assert.match((await ask('Update my bank account')).reply, /outside what I can do/)
})

test('profile updates: only your own contact details, confirmed, and private to you and HR', async () => {
  const { call, login, act } = setup()
  const emp = await login(...EMP)
  const other = await login('rahul.patel', EMP[1])
  const hr = await login(...HR)
  assert.equal((await act(emp, 'profile.update', { personalPhone: 'call me' })).status, 400)
  assert.equal((await act(emp, 'profile.update', { designation: 'CEO' })).status, 400, 'only contact fields can change')
  const ok = await act(emp, 'profile.update', { emergencyContact: { name: 'Asha Tembhare', phone: '+91 98111 22334', relationship: 'Mother' }, id: 'FL1050' })
  assert.equal(ok.status, 200)
  const mine = ok.data.state.employees.find((e) => e.id === 'FL1009')
  assert.equal(mine.emergencyContact.name, 'Asha Tembhare')
  assert.ok(!ok.data.state.employees.find((e) => e.id === 'FL1050').emergencyContact, 'the id in the payload is ignored')
  const seen = (await call('GET', '/api/state', { token: other })).data.employees.find((e) => e.id === 'FL1009')
  assert.equal(seen.emergencyContact, undefined, 'colleagues do not see it')
  assert.equal(seen.personalPhone, undefined)
  assert.equal((await call('GET', '/api/state', { token: hr })).data.employees.find((e) => e.id === 'FL1009').emergencyContact.phone, '+91 98111 22334')
})

test('leave counts working days and cannot overlap existing leave', async () => {
  const { login, act } = setup()
  const emp = await login(...EMP)
  const fri = await act(emp, 'leave.add', { request: { type: 'Privilege Leave', from: '2026-10-09', to: '2026-10-12', reason: 'Trip' } })
  assert.equal(fri.status, 200)
  assert.equal(fri.data.state.leaveRequests.find((r) => r.from === '2026-10-09').days, 2, 'the weekend is not counted')
  assert.equal((await act(emp, 'leave.add', { request: { type: 'Privilege Leave', from: '2026-10-12', to: '2026-10-13', reason: 'x' } })).status, 400, 'overlaps the earlier request')
  const holiday = await act(emp, 'leave.add', { request: { type: 'Privilege Leave', from: '2026-10-02', to: '2026-10-02', reason: 'x' } })
  assert.equal(holiday.status, 400)
  assert.match(holiday.data.error, /holiday/)
})

// --- account recovery ------------------------------------------------------------

import { outboxDelivery } from './delivery.js'
import { OTP_TTL_MS } from './recovery.js'

function setupRecovery({ channels } = {}) {
  const store = sqliteStore(':memory:')
  const box = outboxDelivery(store)
  const delivery = channels ? { ...box, channels } : box
  const handle = createApp({ store, secret: SECRET, delivery, appUrl: 'https://app.test' })
  let ip = 1
  const call = async (method, path, { token, body, from } = {}) => {
    const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': from || '10.0.0.' + ip }
    if (token) headers.Authorization = 'Bearer ' + token
    const res = await handle(new Request(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined }))
    return { status: res.status, data: await res.json().catch(() => null) }
  }
  const login = async (username, password) => (await call('POST', '/api/auth/login', { body: { username, password } })).data?.token
  const lastMessage = async (channel) => (await box.read()).find((m) => m.channel === channel)
  const codeIn = (m) => m.text.match(/\b(\d{6})\b/)[1]
  const newIp = () => { ip++ }
  return { call, login, lastMessage, codeIn, box, newIp, store }
}

test('recovery: an SMS code resets the password, ends old sessions and tells the person', async () => {
  const { call, login, lastMessage, codeIn } = setupRecovery()
  const old = await login(...EMP)
  assert.equal((await call('GET', '/api/auth/recovery/options')).data.channels.sms, true)
  const start = await call('POST', '/api/auth/recovery/start', { body: { identifier: '+91 98200 31009', channel: 'sms', purpose: 'password' } })
  assert.equal(start.status, 200)
  const sms = await lastMessage('sms')
  assert.equal(sms.to, '+919820031009', 'sent to the registered mobile')
  assert.ok(!JSON.stringify(start.data).includes(codeIn(sms)), 'the code is never in the response')

  assert.equal((await call('POST', '/api/auth/recovery/verify', { body: { requestId: start.data.requestId, code: '000000' } })).status, 400)
  const ok = await call('POST', '/api/auth/recovery/verify', { body: { requestId: start.data.requestId, code: codeIn(sms) } })
  assert.equal(ok.status, 200)
  assert.equal(ok.data.username, 'nikhil.tembhare')
  assert.equal((await call('POST', '/api/auth/recovery/verify', { body: { requestId: start.data.requestId, code: codeIn(sms) } })).status, 400, 'a code works once')

  const weak = await call('POST', '/api/auth/recovery/complete', { body: { ticket: ok.data.ticket, password: 'short1' } })
  assert.match(weak.data.error, /at least 8/)
  assert.match((await call('POST', '/api/auth/recovery/complete', { body: { ticket: ok.data.ticket, password: EMP[1] } })).data.error, /not used/, 'not the same password again')
  const done = await call('POST', '/api/auth/recovery/complete', { body: { ticket: ok.data.ticket, password: 'Monsoon2026ride' } })
  assert.equal(done.status, 200)
  assert.equal((await call('POST', '/api/auth/recovery/complete', { body: { ticket: ok.data.ticket, password: 'Another2026ride' } })).status, 400, 'a ticket works once')

  assert.equal((await call('GET', '/api/state', { token: old })).status, 401, 'sessions from before the reset are signed out')
  assert.equal(await login(...EMP), undefined, 'the old password no longer works')
  const fresh = await login('nikhil.tembhare', 'Monsoon2026ride')
  assert.ok(fresh)
  const me = (await call('GET', '/api/state', { token: fresh })).data
  assert.match(me.notifications[0].title, /password was changed/)
  assert.match((await lastMessage('email')).text, /password was changed/, 'an email notice too')
})

test('recovery: the email link works once, and a forgotten username is recovered and changed', async () => {
  const { call, login, lastMessage } = setupRecovery()
  const start = await call('POST', '/api/auth/recovery/start', { body: { identifier: 'Nikhil.Tembhare@flexiloans.com', channel: 'email', purpose: 'both' } })
  assert.equal(start.status, 200)
  const mail = await lastMessage('email')
  const token = mail.text.match(/recover\?token=([\w-]+)/)[1]
  const opened = await call('POST', '/api/auth/recovery/link', { body: { token } })
  assert.equal(opened.status, 200)
  assert.equal(opened.data.username, 'nikhil.tembhare', 'the username is shown only after the link or code proves who you are')
  assert.equal((await call('POST', '/api/auth/recovery/link', { body: { token } })).status, 400, 'a link works once')

  assert.match((await call('POST', '/api/auth/recovery/complete', { body: { ticket: opened.data.ticket, username: 'hr.manager' } })).data.error, /taken/)
  const done = await call('POST', '/api/auth/recovery/complete', { body: { ticket: opened.data.ticket, username: 'nikhil.t', password: 'Monsoon2026ride' } })
  assert.equal(done.status, 200, JSON.stringify(done.data))
  assert.equal(done.data.username, 'nikhil.t')
  assert.equal(await login(...EMP), undefined)
  const t = await login('nikhil.t', 'Monsoon2026ride')
  assert.ok(t, 'the new username signs in')
  const state = (await call('GET', '/api/state', { token: t })).data
  assert.ok(state.leaveRequests.some((r) => r.empId === 'FL1009'), 'the same person and data')
  assert.match(state.notifications[0].title, /password and username was changed|username and password|password/i)
  assert.equal(await login('nikhil.tembhare', 'Monsoon2026ride'), undefined, 'the old username is gone, even after the account list syncs')
})

test('recovery: unknown accounts look the same, codes expire, and guessing is stopped', async () => {
  const { call, lastMessage, codeIn, box, newIp, store } = setupRecovery()
  const unknown = await call('POST', '/api/auth/recovery/start', { body: { identifier: 'nobody.here', channel: 'sms' } })
  const known = await call('POST', '/api/auth/recovery/start', { body: { identifier: 'hr.manager', channel: 'sms' } })
  assert.equal(unknown.status, known.status)
  assert.equal(unknown.data.message, known.data.message, 'no hint whether an account exists')
  assert.equal((await box.read()).length, 1, 'nothing is sent for an unknown account')
  assert.match((await call('POST', '/api/auth/recovery/verify', { body: { requestId: unknown.data.requestId, code: '123456' } })).data.error, /not right/)

  // Five wrong tries void a code.
  for (let i = 0; i < 4; i++) await call('POST', '/api/auth/recovery/verify', { body: { requestId: known.data.requestId, code: String(100000 + i) } })
  const fifth = await call('POST', '/api/auth/recovery/verify', { body: { requestId: known.data.requestId, code: '199999' } })
  assert.match(fifth.data.error, /can no longer be used/)
  const code = codeIn(await lastMessage('sms'))
  assert.equal((await call('POST', '/api/auth/recovery/verify', { body: { requestId: known.data.requestId, code } })).status, 400, 'even the right code is refused after that')

  // Resend wait, then a per-account cap on codes.
  assert.equal((await call('POST', '/api/auth/recovery/start', { body: { identifier: 'hr.manager', channel: 'sms' } })).status, 429)

  // Expiry: age the stored request past its lifetime.
  newIp()
  const again = await call('POST', '/api/auth/recovery/start', { body: { identifier: 'admin', channel: 'email' } })
  const { hashSecret } = await import('./auth.js')
  const key = 'recovery/' + hashSecret(again.data.requestId, SECRET)
  await store.update(key, (cur) => ({ ...cur, expiresAt: Date.now() - 1 }))
  const late = await call('POST', '/api/auth/recovery/verify', { body: { requestId: again.data.requestId, code: codeIn(await lastMessage('email')) } })
  assert.match(late.data.error, /expired/)
  assert.ok(OTP_TTL_MS <= 10 * 60 * 1000)

  // Only hashes are stored.
  const raw = JSON.stringify(await store.get(key))
  assert.ok(!raw.includes(codeIn(await lastMessage('email'))), 'the code itself is not stored')
})

test('recovery: channels that are not configured are not offered; phone verification and password change', async () => {
  const off = setupRecovery({ channels: { email: true, sms: false } })
  assert.equal((await off.call('GET', '/api/auth/recovery/options')).data.channels.sms, false)
  assert.match((await off.call('POST', '/api/auth/recovery/start', { body: { identifier: 'admin', channel: 'sms' } })).data.error, /SMS codes are not available/)

  const { call, login, lastMessage, codeIn } = setupRecovery()
  const t = await login(...EMP)
  const sec = (await call('GET', '/api/auth/security', { token: t })).data
  assert.ok(sec.email.includes('•') && !sec.email.startsWith('nikhil'), 'contact details are masked')
  const st = await call('POST', '/api/auth/phone/start', { token: t, body: { phone: '98111 22334' } })
  assert.equal(st.status, 200)
  const sms = await lastMessage('sms')
  assert.equal(sms.to, '+919811122334')
  assert.equal((await call('POST', '/api/auth/phone/confirm', { token: t, body: { requestId: st.data.requestId, code: codeIn(sms) } })).status, 200)
  assert.equal((await call('GET', '/api/auth/security', { token: t })).data.phoneVerified, true)
  // The verified number now works for recovery.
  const rec = await call('POST', '/api/auth/recovery/start', { body: { identifier: '+91 98111 22334', channel: 'sms' } })
  assert.equal((await lastMessage('sms')).to, '+919811122334')
  assert.equal(rec.status, 200)

  assert.match((await call('POST', '/api/auth/password', { token: t, body: { current: 'wrong', password: 'Monsoon2026ride' } })).data.error, /current password/)
  const ch = await call('POST', '/api/auth/password', { token: t, body: { current: EMP[1], password: 'Monsoon2026ride' } })
  assert.equal(ch.status, 200)
  assert.equal((await call('GET', '/api/state', { token: t })).status, 401, 'the old session ends')
  assert.equal((await call('GET', '/api/state', { token: ch.data.token })).status, 200, 'the new token works')
})
