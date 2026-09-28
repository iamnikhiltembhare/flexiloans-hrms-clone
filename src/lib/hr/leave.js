// Leave balances: the yearly policy minus what each person has used.
// "Used" is an opening figure (leave taken before this system's records
// start, stable per person) plus every approved request this year; pending
// requests are shown separately and count against what can still be applied.

import { leaveBalances } from '../../data/mock.js'

export const LEAVE_POLICY = leaveBalances.map(({ type, code, granted, color, bar }) => ({ type, code, granted, color, bar }))
export const LEAVE_TYPES = LEAVE_POLICY.map((l) => l.type)
const UNLIMITED = new Set(['Leave Without Pay'])

// Older requests use everyday names; map them onto the policy types.
const ALIASES = [
  [/privilege|earned|annual/i, 'Privilege Leave'],
  [/casual|sick/i, 'Casual Or Sick Leave'],
  [/comp/i, 'Comp - Off'],
  [/restricted|optional/i, 'Restricted Holiday'],
  [/paternity/i, 'Paternity Leave'],
  [/bereavement/i, 'Bereavement Leave'],
  [/without pay|lwp|unpaid/i, 'Leave Without Pay'],
]
export function policyType(type) {
  if (LEAVE_TYPES.includes(type)) return type
  for (const [re, t] of ALIASES) if (re.test(type || '')) return t
  return 'Privilege Leave'
}
export const isUnpaidLeave = (type) => policyType(type) === 'Leave Without Pay'

const rnd = (seed) => { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return ((h >>> 0) % 1000) / 1000 }
// Only the everyday leave types carry leave taken before the system's records.
const opening = (empId, l) => (['PL', 'CSL'].includes(l.code) ? Math.floor(rnd(empId + l.code) * Math.ceil(l.granted * 0.45)) : 0)

/** Balances for one person: [{ type, code, granted, used, pending, balance, unlimited }]. */
export function balancesFor(empId, leaveRequests = [], year = new Date().getFullYear()) {
  const mine = leaveRequests.filter((r) => r.empId === empId && String(r.from).startsWith(String(year)))
  return LEAVE_POLICY.map((l) => {
    const sum = (status) => mine.filter((r) => r.status === status && policyType(r.type) === l.type).reduce((s, r) => s + Number(r.days || 0), 0)
    const used = opening(empId, l) + sum('Approved')
    const pending = sum('Pending')
    return { ...l, used, pending, balance: Math.max(0, l.granted - used), unlimited: UNLIMITED.has(l.type) }
  })
}

/** Can this person apply for `days` of `type`? { ok, available, message }. */
export function checkBalance(empId, type, days, leaveRequests, year) {
  const row = balancesFor(empId, leaveRequests, year).find((b) => b.type === policyType(type))
  if (!row || row.unlimited) return { ok: true, available: Infinity }
  const available = Math.max(0, row.balance - row.pending)
  if (days <= available) return { ok: true, available }
  return { ok: false, available, message: 'Only ' + available + ' day' + (available === 1 ? '' : 's') + ' of ' + row.type + ' left' + (row.pending ? ' after ' + row.pending + ' pending' : '') + '; this request is ' + days + '.' }
}
