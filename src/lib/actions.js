// Every change to HR data is an action: { type, payload }.
//
// applyAction() is pure and shared by the app and the API server. The app
// runs it first for an instant (optimistic) update; the server runs it again
// as the source of truth and sends back the result. Anything random - ids,
// timestamps - is decided before dispatch and travels in the payload, so both
// sides reach the same state.

import { PERMS } from '../data/accounts.js'

export const CANDIDATE_STAGES = ['Shortlisted', 'Tech Screen', 'HR Round', 'Final Round', 'Offer Rolled', 'Hired']

// Which stored collection each action changes, and whether that collection
// is shared by the organisation or private to the signed-in person.
export const COLLECTIONS = {
  employees: 'shared',
  leaveRequests: 'shared',
  tickets: 'shared',
  announcements: 'shared',
  candidates: 'shared',
  requisitions: 'shared',
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
  'notification.add': { collection: 'notifications', perm: PERMS.SELF },
  'notification.read': { collection: 'notifications', perm: PERMS.SELF },
  'notification.readAll': { collection: 'notifications', perm: PERMS.SELF },
  'notification.clear': { collection: 'notifications', perm: PERMS.SELF },
}

const REDUCERS = {
  'employee.add': (list, { employee }) => ({ value: [employee, ...list] }),

  'leave.add': (list, { request }) => ({ value: [request, ...list] }),

  'leave.setStatus': (list, { id, status }) => ({
    value: list.map((r) => (r.id === id ? { ...r, status } : r)),
  }),

  'ticket.add': (list, { ticket }) => ({ value: [ticket, ...list], result: ticket.id }),

  'ticket.setStatus': (list, { id, status }) => ({
    value: list.map((t) => (t.id === id ? { ...t, status, sla: status === 'Resolved' ? 'Met' : t.sla } : t)),
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

  'punch.toggle': (p, { now }) => {
    if (p.outAt || !p.inAt) return { value: { inAt: now, outAt: null }, result: { action: 'in', now } }
    return { value: { ...p, outAt: now }, result: { action: 'out', now } }
  },

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

export const clockTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

const rand = () => Math.random().toString(36).slice(2, 8)

/** Next number in a `PREFIX-1234` style series, from the ids already in use. */
export function nextSerial(list, prefix, floor) {
  const nums = list.map((x) => Number(String(x.id || '').replace(prefix, ''))).filter(Number.isFinite)
  return prefix + (Math.max(floor, ...nums) + 1)
}

export const newNotificationId = () => 'n-' + Date.now().toString(36) + rand()
