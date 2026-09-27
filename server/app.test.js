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
  const body = { name: 'Priya Kapoor', username: 'priya.kapoor', role: 'hr', department: 'Human Resources', password: 'Welcome123' }
  assert.equal((await call('POST', '/api/admin/users', { token: hr, body })).status, 403, 'HR cannot create users')
  assert.equal((await call('POST', '/api/admin/users', { token: admin, body: { ...body, password: 'short' } })).status, 400)
  assert.equal((await call('POST', '/api/admin/users', { token: admin, body: { ...body, username: 'nikhil.tembhare' } })).status, 400, 'taken')

  const made = await call('POST', '/api/admin/users', { token: admin, body })
  assert.equal(made.status, 200)
  assert.ok(made.data.state.employees.some((e) => e.username === 'priya.kapoor'), 'added to the directory')

  const r = await call('POST', '/api/auth/login', { body: { username: 'priya.kapoor', password: 'Welcome123' } })
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
    body: JSON.stringify({ name: 'New Person', username: 'new.person', role: 'employee', password: 'Password1' }) }))
  assert.equal(made.status, 200)
  // A later deploy with a different code account list keeps the admin-made user.
  const v2 = createApp({ store, secret: SECRET, accounts: [acct('seed', 'pw-seed')] })
  const r = await v2(new Request(BASE + '/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'new.person', password: 'Password1' }) }))
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
