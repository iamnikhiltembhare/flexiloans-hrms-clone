// API tests against an in-memory SQLite store: `npm run test:server`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from './app.js'
import { sqliteStore } from './store-sqlite.js'

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

const EMP = ['rohan.sharma', 'FlexiEmp@2026']
const HR = ['hr.manager', 'FlexiHR@2026']
const ADMIN = ['admin', 'Admin@2026']

test('login returns a token and the user; bad passwords are rejected', async () => {
  const { call } = setup()
  const ok = await call('POST', '/api/auth/login', { body: { username: 'Rohan.Sharma ', password: EMP[1] } })
  assert.equal(ok.status, 200)
  assert.equal(ok.data.user.name, 'Rohan Sharma')
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
  assert.ok(emp.tickets.every((t) => t.raisedBy === 'Rohan Sharma'))
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
  assert.equal(mine.employee, 'Rohan Sharma', 'server ignores a spoofed employee')
  assert.equal(mine.empId, 'FL1009')
  assert.equal(mine.status, 'Pending', 'server ignores a spoofed status')
  assert.equal(mine.days, 2)

  const hrState = (await call('GET', '/api/state', { token: hr })).data
  assert.match(hrState.notifications[0].title, /Leave request from Rohan Sharma/)

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
  const done = await act(hr, 'ticket.setStatus', { id: 'HD-9000', status: 'Resolved' })
  assert.equal(done.data.state.tickets.find((t) => t.id === 'HD-9000').sla, 'Met')
})

test('punch in and out is per person', async () => {
  const { call, login, act } = setup()
  const emp = await login(...EMP)
  const first = await act(emp, 'punch.toggle', { now: '09:10 am' })
  assert.deepEqual(first.data.result, { action: 'out', now: '09:10 am' }, 'seed starts punched in')
  const again = await act(emp, 'punch.toggle', { now: '09:15 am' })
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
