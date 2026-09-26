// Server-side validation for each action. The app is never trusted: every
// payload is rebuilt here from whitelisted fields, and anything that must be
// authoritative (who raised it, its status, the date) is set by the server.

import { PERMS } from '../src/data/accounts.js'
import { CANDIDATE_STAGES, nextSerial, today, newNotificationId } from '../src/lib/actions.js'

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

const bad = (msg) => { throw new HttpError(400, msg) }
const forbidden = (msg) => { throw new HttpError(403, msg) }

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const required = (v, field, max) => str(v, max) || bad(field + ' is required')
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback)
const isoDate = (v, field) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : bad(field + ' must be a YYYY-MM-DD date'))

/** Keep a client-proposed id when it is well formed and unused; else mint one. */
function uniqueId(list, proposed, pattern, prefix, floor) {
  if (typeof proposed === 'string' && pattern.test(proposed) && !list.some((x) => x.id === proposed)) return proposed
  return nextSerial(list, prefix, floor)
}

const find = (list, id, what) => list.find((x) => x.id === id) || bad(what + ' ' + id + ' does not exist')

/**
 * Validate an action against the collection it will change.
 * Returns the sanitised payload to hand to applyAction().
 */
export function prepare(type, payload, actor, current) {
  const p = payload && typeof payload === 'object' ? payload : {}

  switch (type) {
    case 'employee.add': {
      const e = p.employee || {}
      return { employee: {
        id: uniqueId(current, e.id, /^FL\d{4}$/, 'FL', 1000),
        name: required(e.name, 'Name', 80),
        email: str(e.email, 120),
        phone: str(e.phone, 30),
        department: str(e.department, 60),
        designation: required(e.designation, 'Designation', 80),
        location: str(e.location, 60),
        gender: str(e.gender, 20),
        status: 'Probation', experience: '0 yrs', employmentType: 'Permanent',
        manager: actor.name, joinDate: today(),
      } }
    }

    case 'leave.add': {
      const r = p.request || {}
      const from = isoDate(r.from, 'Start date')
      const to = isoDate(r.to, 'End date')
      if (to < from) bad('The end date cannot be before the start date')
      const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1
      if (days > 60) bad('A single request cannot exceed 60 days')
      return { request: {
        id: uniqueId(current, r.id, /^LV-\d+$/, 'LV-', 2041),
        employee: actor.name, empId: actor.id,
        type: required(r.type, 'Leave type', 40),
        from, to, days,
        reason: str(r.reason, 300) || 'Personal',
        status: 'Pending', appliedOn: today(),
      } }
    }

    case 'leave.setStatus': {
      const target = find(current, p.id, 'Leave request')
      if (target.empId === actor.id) forbidden('You cannot approve your own leave')
      if (target.status !== 'Pending') bad(target.id + ' is already ' + target.status.toLowerCase())
      return { id: target.id, status: oneOf(p.status, ['Approved', 'Rejected']) || bad('Status must be Approved or Rejected') }
    }

    case 'ticket.add': {
      const t = p.ticket || {}
      return { ticket: {
        id: uniqueId(current, t.id, /^HD-\d+$/, 'HD-', 8841),
        subject: required(t.subject, 'Subject', 160),
        category: str(t.category, 40) || 'General',
        priority: oneOf(t.priority, ['Low', 'Medium', 'High'], 'Medium'),
        status: 'Open', sla: '8h left', assignee: 'HR Ops',
        raisedBy: actor.name, raisedById: actor.id, created: today(),
      } }
    }

    case 'ticket.setStatus': {
      const target = find(current, p.id, 'Ticket')
      return { id: target.id, status: oneOf(p.status, ['Open', 'In Progress', 'Resolved']) || bad('Unknown ticket status') }
    }

    case 'announcement.add': {
      const a = p.announcement || {}
      return { announcement: {
        id: Date.now(),
        title: required(a.title, 'Title', 160),
        body: required(a.body, 'Message', 4000),
        tag: str(a.tag, 30) || 'Policy',
        author: actor.name, date: today(), pinned: false,
      } }
    }

    case 'document.add': {
      const d = p.document || {}
      return { document: {
        name: required(d.name, 'File name', 160),
        category: str(d.category, 40) || 'Onboarding',
        size: str(d.size, 20),
        status: 'Pending', uploaded: today(),
      } }
    }

    case 'candidate.advance': {
      const c = current.find((x) => x.name === p.name) || bad('No candidate named ' + p.name)
      if (c.stage === CANDIDATE_STAGES[CANDIDATE_STAGES.length - 1]) bad(c.name + ' is already hired')
      return { name: c.name }
    }

    case 'requisition.add': {
      const r = p.requisition || {}
      return { requisition: {
        id: uniqueId(current, r.id, /^REQ-\d+$/, 'REQ-', 311),
        role: required(r.role, 'Role', 120),
        dept: str(r.dept, 60), location: str(r.location, 60),
        type: str(r.type, 30) || 'Permanent',
        priority: oneOf(r.priority, ['Low', 'Medium', 'High'], 'Medium'),
        applicants: 0, stage: 'Sourcing', owner: actor.name, posted: today(),
      } }
    }

    case 'punch.toggle': {
      // The display time comes from the device so it matches the user's clock.
      const now = /^\d{1,2}:\d{2}\s?(am|pm)$/i.test(p.now) ? p.now : bad('Invalid time')
      return { now }
    }

    case 'notification.add': {
      const n = p.notification || {}
      return { notification: notificationFor(n) }
    }

    case 'notification.read':
      return { id: str(p.id, 60) }

    case 'notification.readAll':
    case 'notification.clear':
      return {}

    default:
      return bad('Unknown action ' + type)
  }
}

const KINDS = ['leave', 'alert', 'task', 'info']

export function notificationFor(n) {
  return {
    id: newNotificationId(),
    title: str(n.title, 120) || 'Update',
    detail: str(n.detail, 240),
    to: str(n.to, 60).startsWith('/') ? str(n.to, 60) : '/',
    kind: oneOf(n.kind, KINDS, 'info'),
    time: 'Just now', at: new Date().toISOString(), read: false,
  }
}

/** Trim shared collections down to what this person is allowed to see. */
export function visibleTo(actor, collection, value) {
  const can = (perm) => actor.perms.includes(perm)
  switch (collection) {
    case 'leaveRequests': return can(PERMS.HR_PEOPLE) ? value : value.filter((r) => r.empId === actor.id)
    case 'tickets': return can(PERMS.HR_DESK) ? value : value.filter((t) => t.raisedById === actor.id || t.raisedBy === actor.name)
    case 'candidates':
    case 'requisitions': return can(PERMS.HR_HIRING) ? value : []
    default: return value
  }
}

/**
 * Who else should hear about an action once it has been applied.
 * Returns [{ to: (user) => boolean, notification }].
 */
export function fanOut(type, payload, actor, before) {
  const hasPerm = (perm) => (u) => u.perms.includes(perm) && u.username !== actor.username
  switch (type) {
    case 'leave.add': {
      const r = payload.request
      return [{ to: hasPerm(PERMS.HR_PEOPLE), notification: { title: 'Leave request from ' + r.employee, detail: r.days + ' day' + (r.days > 1 ? 's' : '') + ' of ' + r.type, to: '/leave', kind: 'leave' } }]
    }
    case 'leave.setStatus': {
      const r = before.find((x) => x.id === payload.id)
      return [{ to: (u) => u.id === r.empId, notification: { title: 'Your leave was ' + payload.status.toLowerCase(), detail: r.id + ' - ' + r.type + ' (' + r.days + 'd), by ' + actor.name, to: '/leave', kind: 'leave' } }]
    }
    case 'ticket.add': {
      const t = payload.ticket
      return [{ to: hasPerm(PERMS.HR_DESK), notification: { title: 'New ticket ' + t.id, detail: t.subject + ' - ' + t.raisedBy, to: '/helpdesk', kind: t.priority === 'High' ? 'alert' : 'task' } }]
    }
    case 'ticket.setStatus': {
      const t = before.find((x) => x.id === payload.id)
      return [{ to: (u) => u.id === t.raisedById && u.username !== actor.username, notification: { title: t.id + ' is now ' + payload.status, detail: t.subject, to: '/', kind: 'info' } }]
    }
    case 'announcement.add': {
      const a = payload.announcement
      return [{ to: (u) => u.username !== actor.username, notification: { title: 'New announcement', detail: a.title, to: '/announcements', kind: 'info' } }]
    }
    default:
      return []
  }
}
