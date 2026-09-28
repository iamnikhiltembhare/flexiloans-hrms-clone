// Every change to HR data is an action: { type, payload }.
//
// applyAction() is pure and shared by the app and the API server. The app
// runs it first for an instant (optimistic) update; the server runs it again
// as the source of truth and sends back the result. Anything random - ids,
// timestamps - is decided before dispatch and travels in the payload, so both
// sides reach the same state.

import { PERMS } from '../data/accounts.js'

export const CANDIDATE_STAGES = ['Shortlisted', 'Tech Screen', 'HR Round', 'Final Round', 'Offer Rolled', 'Hired']

// Which team owns each helpdesk category. HR works its own tickets; tickets
// for other departments are approved or rejected by a super admin.
export const TICKET_DESKS = {
  Payroll: { desk: 'Payroll Desk', team: 'HR' },
  'HR Records': { desk: 'HR Ops', team: 'HR' },
  Benefits: { desk: 'Benefits Desk', team: 'HR' },
  IT: { desk: 'IT Helpdesk', team: 'IT' },
  Finance: { desk: 'Finance Desk', team: 'Finance' },
}
// Reasons an employee can give for correcting a day's attendance.
export const REGULARISATION_TYPES = ['Missed punch', 'Wrong punch time', 'Work from home', 'On duty / client visit']

export const TICKET_STATUSES = ['Open', 'In Progress', 'Approved', 'Rejected', 'Resolved']
/** True when a ticket's category belongs to a department other than HR. */
export const needsAdminApproval = (category) => (TICKET_DESKS[category]?.team || 'HR') !== 'HR'
/** Closed tickets take no further action except reopening. */
export const ticketClosed = (status) => status === 'Resolved' || status === 'Rejected'

// Which stored collection each action changes, and whether that collection
// is shared by the organisation or private to the signed-in person.
export const COLLECTIONS = {
  employees: 'shared',
  leaveRequests: 'shared',
  tickets: 'shared',
  announcements: 'shared',
  candidates: 'shared',
  requisitions: 'shared',
  regularisations: 'shared',
  payroll: 'shared',
  onboarding: 'shared',
  appraisals: 'shared',
  documents: 'personal',
  notifications: 'personal',
  punch: 'personal',
}

export const ACTIONS = {
  'employee.add': { collection: 'employees', perm: PERMS.HR_PEOPLE },
  'leave.add': { collection: 'leaveRequests', perm: PERMS.SELF },
  'leave.setStatus': { collection: 'leaveRequests', perm: PERMS.HR_PEOPLE },
  'ticket.add': { collection: 'tickets', perm: PERMS.SELF },
  'ticket.setStatus': { collection: 'tickets', perm: PERMS.HR_DESK },
  'announcement.add': { collection: 'announcements', perm: PERMS.HR_PEOPLE },
  'document.add': { collection: 'documents', perm: PERMS.SELF },
  'candidate.advance': { collection: 'candidates', perm: PERMS.HR_HIRING },
  'requisition.add': { collection: 'requisitions', perm: PERMS.HR_HIRING },
  'punch.toggle': { collection: 'punch', perm: PERMS.SELF },
  'regularisation.add': { collection: 'regularisations', perm: PERMS.SELF },
  'regularisation.decide': { collection: 'regularisations', perm: PERMS.HR_PEOPLE },
  // `needs`: other collections the server reads to validate or compute.
  // `localOnly`: payload keys used for the instant on-screen update but never
  // sent to the server, which computes them itself.
  'payroll.run': { collection: 'payroll', perm: PERMS.HR_PEOPLE, needs: ['employees', 'leaveRequests'], localOnly: ['run', 'payslips'] },
  'payroll.pay': { collection: 'payroll', perm: PERMS.HR_PEOPLE },
  'candidate.add': { collection: 'candidates', perm: PERMS.HR_HIRING },
  'candidate.schedule': { collection: 'candidates', perm: PERMS.HR_HIRING },
  'candidate.evaluate': { collection: 'candidates', perm: PERMS.HR_HIRING },
  'candidate.decide': { collection: 'candidates', perm: PERMS.HR_HIRING },
  'onboarding.start': { collection: 'onboarding', perm: PERMS.HR_PEOPLE },
  // Checked in detail by the server: HR ticks any task, a joiner only their own.
  'onboarding.task': { collection: 'onboarding', perm: PERMS.SELF },
  'onboarding.ack': { collection: 'onboarding', perm: PERMS.SELF },
  'appraisal.goal': { collection: 'appraisals', perm: PERMS.SELF },
  'appraisal.progress': { collection: 'appraisals', perm: PERMS.SELF },
  'appraisal.self': { collection: 'appraisals', perm: PERMS.SELF },
  'appraisal.review': { collection: 'appraisals', perm: PERMS.HR_PEOPLE },
  'notification.add': { collection: 'notifications', perm: PERMS.SELF },
  'notification.read': { collection: 'notifications', perm: PERMS.SELF },
  'notification.readAll': { collection: 'notifications', perm: PERMS.SELF },
  'notification.clear': { collection: 'notifications', perm: PERMS.SELF },
}

// Onboarding is complete once every task is done and every policy acknowledged.
const withStatus = (r) => {
  const done = r.tasks.every((t) => t.done) && (r.acknowledgements || []).length >= (r.policies || []).length
  return { ...r, status: done ? 'Completed' : 'In progress' }
}

const REDUCERS = {
  'employee.add': (list, { employee }) => ({ value: [employee, ...list] }),

  'leave.add': (list, { request }) => ({ value: [request, ...list] }),

  'leave.setStatus': (list, { id, status }) => ({
    value: list.map((r) => (r.id === id ? { ...r, status } : r)),
  }),

  'ticket.add': (list, { ticket }) => ({ value: [ticket, ...list], result: ticket.id }),

  'ticket.setStatus': (list, { id, status, by }) => ({
    value: list.map((t) => (t.id !== id ? t : {
      ...t, status,
      sla: status === 'Resolved' || status === 'Approved' ? 'Met' : t.sla,
      ...(status === 'Approved' || status === 'Rejected' ? { decidedBy: by } : {}),
    })),
  }),

  'announcement.add': (list, { announcement }) => ({ value: [announcement, ...list] }),

  'document.add': (list, { document }) => ({ value: [document, ...list] }),

  'candidate.advance': (list, { name }) => {
    let moved = null
    const value = list.map((c) => {
      if (c.name !== name) return c
      const i = CANDIDATE_STAGES.indexOf(c.stage)
      moved = CANDIDATE_STAGES[Math.min(i + 1, CANDIDATE_STAGES.length - 1)]
      return { ...c, stage: moved }
    })
    return { value, result: moved }
  },

  'requisition.add': (list, { requisition }) => ({ value: [requisition, ...list], result: requisition.id }),

  // Punches are kept per day: the first punch-in and the last punch-out.
  // A punch left open from an earlier day does not carry over.
  'punch.toggle': (p, { now, date, mode = 'Office' }) => {
    const history = { ...(p.history || {}) }
    const day = history[date] || {}
    const stale = p.date && p.date !== date
    if (stale || p.outAt || !p.inAt) {
      history[date] = { in: day.in || now, out: day.out || null, mode: day.mode || mode }
      return { value: { inAt: now, outAt: null, date, history }, result: { action: 'in', now } }
    }
    history[date] = { ...day, in: day.in || p.inAt, out: now }
    return { value: { ...p, outAt: now, date, history }, result: { action: 'out', now } }
  },

  'payroll.run': (p, { run, payslips }) => ({
    value: { runs: [run, ...p.runs.filter((r) => r.month !== run.month)], payslips: [...payslips, ...p.payslips.filter((x) => x.month !== run.month)] },
    result: run.id,
  }),
  'payroll.pay': (p, { month, paidAt, by }) => ({
    value: { ...p, runs: p.runs.map((r) => (r.month === month ? { ...r, status: 'Paid', paidAt, paidBy: by } : r)) },
  }),

  // --- recruitment ---
  'candidate.add': (list, { candidate }) => ({ value: [candidate, ...list], result: candidate.name }),
  'candidate.schedule': (list, { name, interview }) => ({
    value: list.map((c) => (c.name === name ? { ...c, interviews: [...(c.interviews || []), interview] } : c)),
  }),
  'candidate.evaluate': (list, { name, evaluation, rating }) => ({
    value: list.map((c) => (c.name !== name ? c : {
      ...c, rating,
      evaluations: [...(c.evaluations || []), evaluation],
      interviews: (c.interviews || []).map((iv) => (iv.round === evaluation.round && iv.status === 'Scheduled' ? { ...iv, status: 'Completed' } : iv)),
    })),
  }),
  'candidate.decide': (list, { name, decision, reason, by, at }) => ({
    value: list.map((c) => (c.name !== name ? c : { ...c, status: decision, ...(decision === 'Hired' ? { stage: 'Hired' } : {}), decision: { decision, reason, by, at } })),
    result: decision,
  }),

  // --- onboarding ---
  'onboarding.start': (list, { record }) => ({ value: [record, ...list], result: record.id }),
  'onboarding.task': (list, { id, taskId, done, by, at }) => ({
    value: list.map((r) => (r.id !== id ? r : withStatus({ ...r, tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, done, doneBy: done ? by : null, doneAt: done ? at : null } : t)) }))),
  }),
  'onboarding.ack': (list, { id, policy, at }) => ({
    value: list.map((r) => (r.id !== id || (r.acknowledgements || []).some((a) => a.policy === policy) ? r
      : withStatus({ ...r, acknowledgements: [...(r.acknowledgements || []), { policy, at }] }))),
  }),

  // --- appraisals ---
  'appraisal.goal': (list, { id, goal }) => ({
    value: list.map((a) => (a.id !== id ? a : { ...a, goals: a.goals.some((g) => g.id === goal.id) ? a.goals.map((g) => (g.id === goal.id ? { ...g, ...goal } : g)) : [...a.goals, goal] })),
  }),
  'appraisal.progress': (list, { id, goalId, progress }) => ({
    value: list.map((a) => (a.id !== id ? a : { ...a, goals: a.goals.map((g) => (g.id === goalId ? { ...g, progress } : g)) })),
  }),
  'appraisal.self': (list, { id, self }) => ({
    value: list.map((a) => (a.id === id ? { ...a, self, status: 'Manager review' } : a)),
  }),
  'appraisal.review': (list, { id, manager }) => ({
    value: list.map((a) => (a.id === id ? { ...a, manager, status: 'Completed' } : a)),
  }),

  'regularisation.add': (list, { request }) => ({ value: [request, ...list], result: request.id }),
  'regularisation.decide': (list, { id, status, by }) => ({
    value: list.map((r) => (r.id === id ? { ...r, status, decidedBy: by } : r)),
  }),

  'notification.add': (list, { notification }) => ({ value: [notification, ...list] }),
  'notification.read': (list, { id }) => ({ value: list.map((n) => (n.id === id ? { ...n, read: true } : n)) }),
  'notification.readAll': (list) => ({ value: list.map((n) => ({ ...n, read: true })) }),
  'notification.clear': () => ({ value: [] }),
}

/**
 * Apply one action to the current value of its collection.
 * Returns { value, result }: the new collection value and anything the
 * caller needs back (a new id, the stage a candidate moved to).
 */
export function applyAction(current, { type, payload }) {
  const reduce = REDUCERS[type]
  if (!reduce) throw new Error('Unknown action ' + type)
  return reduce(current, payload || {})
}

// --- id and time helpers used when building an action -------------------

export const today = () => new Date().toISOString().slice(0, 10)

/** Local calendar date, YYYY-MM-DD (not UTC, so late evening stays "today"). */
export const localDate = (d = new Date()) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

/** Punched in right now? A punch without a date is the seed data's "today". */
export const isPunchedIn = (p) => Boolean(p?.inAt) && !p?.outAt && (!p?.date || p.date === localDate())

export const clockTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

const rand = () => Math.random().toString(36).slice(2, 8)

/** Next number in a `PREFIX-1234` style series, from the ids already in use. */
export function nextSerial(list, prefix, floor) {
  const nums = list.map((x) => Number(String(x.id || '').replace(prefix, ''))).filter(Number.isFinite)
  return prefix + (Math.max(floor, ...nums) + 1)
}

export const newNotificationId = () => 'n-' + Date.now().toString(36) + rand()
