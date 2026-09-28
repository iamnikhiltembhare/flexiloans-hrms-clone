// Server-side validation for each action. The app is never trusted: every
// payload is rebuilt here from whitelisted fields, and anything that must be
// authoritative (who raised it, its status, the date) is set by the server.

import { PERMS } from '../src/data/accounts.js'
import { checkBalance } from '../src/lib/hr/leave.js'
import { computeRun, monthLabel } from '../src/lib/hr/payroll.js'
import { INTERVIEW_ROUNDS, INTERVIEW_MODES, RECOMMENDATIONS, CANDIDATE_SOURCES, POLICIES, COMPETENCIES, candidateRating, onboardingTasks } from '../src/lib/hr/people.js'
import { CANDIDATE_STAGES, REGULARISATION_TYPES, TICKET_DESKS, TICKET_STATUSES, needsAdminApproval, ticketClosed, nextSerial, today, newNotificationId } from '../src/lib/actions.js'

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
const candidate = (list, name) => list.find((c) => c.name === name) || bad('No candidate named ' + name)
/** An appraisal the actor may edit: their own, or anyone's for HR. */
function appraisal(list, id, actor) {
  const a = find(list, id, 'Appraisal')
  if (a.empId !== actor.id && !actor.perms.includes(PERMS.HR_PEOPLE)) forbidden('You can only change your own appraisal.')
  return a
}
function review(r = {}, who) {
  const rating = Number(r.rating)
  if (!(rating >= 1 && rating <= 5)) bad(who + ' rating must be from 1 to 5')
  const competencies = Object.fromEntries(COMPETENCIES.map((c) => {
    const v = Number(r.competencies?.[c])
    return [c, Number.isInteger(v) && v >= 1 && v <= 5 ? v : bad('Rate ' + c + ' from 1 to 5')]
  }))
  return { rating: Math.round(rating * 10) / 10, competencies, comments: required(r.comments, who + ' comments', 1500), at: new Date().toISOString() }
}

/**
 * Validate an action against the collection it will change.
 * Returns the sanitised payload to hand to applyAction().
 */
export function prepare(type, payload, actor, current, extra = {}) {
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
      const type = required(r.type, 'Leave type', 40)
      const balance = checkBalance(actor.id, type, days, current, Number(from.slice(0, 4)))
      if (!balance.ok) bad(balance.message)
      return { request: {
        id: uniqueId(current, r.id, /^LV-\d+$/, 'LV-', 2041),
        employee: actor.name, empId: actor.id,
        type,
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
        category: oneOf(t.category, Object.keys(TICKET_DESKS), 'HR Records'),
        priority: oneOf(t.priority, ['Low', 'Medium', 'High'], 'Medium'),
        status: 'Open', sla: '8h left', assignee: TICKET_DESKS[t.category]?.desk || 'HR Ops',
        raisedBy: actor.name, raisedById: actor.id, created: today(),
      } }
    }

    case 'ticket.setStatus': {
      const target = find(current, p.id, 'Ticket')
      const status = oneOf(p.status, TICKET_STATUSES) || bad('Unknown ticket status')
      const admin = actor.perms.includes(PERMS.ADMIN_SYSTEM)
      // HR works HR tickets. Approving, rejecting, or touching another
      // department's ticket at all is for a super admin.
      if ((status === 'Approved' || status === 'Rejected') && !admin) forbidden('Only a super admin can approve or reject tickets.')
      if (needsAdminApproval(target.category) && !admin) forbidden(target.category + ' tickets are approved by a super admin.')
      if (status === 'Approved' && ticketClosed(target.status)) bad(target.id + ' is already ' + target.status.toLowerCase())
      return { id: target.id, status, by: actor.name }
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
      // Time and date come from the device so they match the user's clock and
      // time zone; the date must still be within a day of the server's.
      const now = /^\d{1,2}:\d{2}\s?(am|pm)$/i.test(p.now) ? p.now : bad('Invalid time')
      const date = /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : bad('Invalid date')
      if (Math.abs(Date.parse(date) - Date.now()) > 36 * 3600 * 1000) bad('That date is not today')
      return { now, date, mode: p.mode === 'Remote' ? 'Remote' : 'Office' }
    }

    // --- recruitment -------------------------------------------------------
    case 'candidate.add': {
      const c = p.candidate || {}
      const name = required(c.name, 'Candidate name', 80)
      if (current.some((x) => x.name.toLowerCase() === name.toLowerCase())) bad(name + ' is already in the pipeline')
      return { candidate: {
        name, role: required(c.role, 'Role', 120), email: str(c.email, 120), phone: str(c.phone, 30),
        source: oneOf(c.source, CANDIDATE_SOURCES, 'Careers Page'), experience: str(c.experience, 20),
        resume: str(c.resume, 160), stage: 'Shortlisted', status: 'Active', rating: null,
        applied: today(), addedBy: actor.name, interviews: [], evaluations: [],
      } }
    }
    case 'candidate.schedule': {
      const c = candidate(current, p.name)
      const iv = p.interview || {}
      const at = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iv.at) ? iv.at : bad('Pick a date and time for the interview')
      return { name: c.name, interview: {
        id: 'iv-' + Date.now().toString(36), round: oneOf(iv.round, INTERVIEW_ROUNDS, INTERVIEW_ROUNDS[0]), at,
        interviewer: required(iv.interviewer, 'Interviewer', 80), mode: oneOf(iv.mode, INTERVIEW_MODES, INTERVIEW_MODES[0]),
        status: 'Scheduled', by: actor.name,
      } }
    }
    case 'candidate.evaluate': {
      const c = candidate(current, p.name)
      const e = p.evaluation || {}
      const score = (v, f) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : bad(f + ' must be a score from 1 to 5'))
      const evaluation = {
        round: oneOf(e.round, INTERVIEW_ROUNDS, INTERVIEW_ROUNDS[0]),
        technical: score(e.technical, 'Technical'), communication: score(e.communication, 'Communication'), culture: score(e.culture, 'Culture fit'),
        recommendation: oneOf(e.recommendation, RECOMMENDATIONS) || bad('Pick a recommendation'),
        notes: str(e.notes, 600), by: actor.name, at: new Date().toISOString(),
      }
      return { name: c.name, evaluation, rating: candidateRating([...(c.evaluations || []), evaluation]) }
    }
    case 'candidate.decide': {
      const c = candidate(current, p.name)
      if (c.status === 'Hired' || c.status === 'Rejected') bad(c.name + ' is already ' + c.status.toLowerCase())
      const decision = oneOf(p.decision, ['Hired', 'Rejected']) || bad('Decision must be Hired or Rejected')
      if (decision === 'Hired' && !(c.evaluations || []).length) bad('Record at least one interview evaluation before hiring')
      return { name: c.name, decision, reason: str(p.reason, 300), by: actor.name, at: new Date().toISOString() }
    }

    // --- onboarding --------------------------------------------------------
    case 'onboarding.start': {
      const r = p.record || {}
      const startDate = isoDate(r.startDate, 'Start date')
      const name = required(r.name, 'Name', 80)
      if (current.some((x) => x.name === name && x.status !== 'Completed')) bad(name + ' already has onboarding in progress')
      const role = required(r.role, 'Role', 120)
      const department = str(r.department, 60)
      return { record: {
        id: uniqueId(current, r.id, /^OB-\d+$/, 'OB-', 1000), name, role, department, startDate,
        empId: str(r.empId, 20) || null, candidate: str(r.candidate, 80) || null,
        tasks: onboardingTasks(role, department, startDate), policies: POLICIES, acknowledgements: [],
        status: 'In progress', startedBy: actor.name, createdAt: new Date().toISOString(),
      } }
    }
    case 'onboarding.task': {
      const r = find(current, p.id, 'Onboarding')
      const t = r.tasks.find((x) => x.id === p.taskId) || bad('No such task')
      const hr = actor.perms.includes(PERMS.HR_PEOPLE)
      const joiner = r.empId && r.empId === actor.id
      if (!hr && !(joiner && t.owner === 'New joiner')) forbidden(hr ? '' : 'You can only tick your own onboarding tasks.')
      return { id: r.id, taskId: t.id, done: !!p.done, by: actor.name, at: new Date().toISOString() }
    }
    case 'onboarding.ack': {
      const r = find(current, p.id, 'Onboarding')
      if (r.empId !== actor.id) forbidden('Only the new joiner can acknowledge policies.')
      const policy = oneOf(p.policy, r.policies || POLICIES) || bad('Unknown policy')
      return { id: r.id, policy, at: new Date().toISOString() }
    }

    // --- appraisals ---------------------------------------------------------
    case 'appraisal.goal': {
      const a = appraisal(current, p.id, actor)
      if (!['Goal setting', 'Self review'].includes(a.status)) bad('Goals are locked once the self review is submitted')
      const g = p.goal || {}
      const weight = Number(g.weight)
      if (!Number.isInteger(weight) || weight < 5 || weight > 100) bad('Weight must be a whole number from 5 to 100')
      const existing = a.goals.find((x) => x.id === g.id)
      if (!existing && a.goals.length >= 8) bad('A cycle can have at most 8 goals')
      return { id: a.id, goal: {
        id: existing ? existing.id : 'g' + (a.goals.length + 1) + '-' + Date.now().toString(36),
        title: required(g.title, 'Goal', 160), weight, due: isoDate(g.due, 'Due date'), progress: existing ? existing.progress : 0,
      } }
    }
    case 'appraisal.progress': {
      const a = appraisal(current, p.id, actor)
      if (a.status === 'Completed') bad('This appraisal is completed')
      const g = a.goals.find((x) => x.id === p.goalId) || bad('No such goal')
      const progress = Number(p.progress)
      if (!Number.isInteger(progress) || progress < 0 || progress > 100) bad('Progress must be 0 to 100')
      return { id: a.id, goalId: g.id, progress }
    }
    case 'appraisal.self': {
      const a = appraisal(current, p.id, actor)
      if (a.empId !== actor.id) forbidden('Only the employee submits their self review.')
      if (!['Goal setting', 'Self review'].includes(a.status)) bad('The self review is already submitted')
      const total = a.goals.reduce((s, g) => s + g.weight, 0)
      if (total !== 100) bad('Goal weights add up to ' + total + '%; make them 100% before submitting')
      return { id: a.id, self: review(p.self, 'Self') }
    }
    case 'appraisal.review': {
      const a = find(current, p.id, 'Appraisal')
      if (a.empId === actor.id) forbidden('You cannot review your own appraisal.')
      if (a.status !== 'Manager review') bad(a.employee + ' has not submitted a self review yet')
      return { id: a.id, manager: { ...review(p.manager, 'Manager'), by: actor.name } }
    }

    case 'payroll.run': {
      const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) ? p.month : bad('Pick a month (YYYY-MM)')
      const now = new Date()
      const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
      if (month > thisMonth) bad('You cannot run payroll for a future month')
      if (current.runs.some((r) => r.month === month && r.status === 'Paid')) bad(monthLabel(month) + ' payroll is already paid and locked')
      const bonusPercent = Math.min(100, Math.max(0, Number(p.bonusPercent) || 0))
      const otMultiplier = [1, 1.5, 2].includes(Number(p.otMultiplier)) ? Number(p.otMultiplier) : 1.5
      // Amounts are always recomputed here; the app's own figures are ignored.
      return computeRun(extra.employees || [], month, { leaveRequests: extra.leaveRequests || [] }, { bonusPercent, otMultiplier }, actor.name)
    }

    case 'payroll.pay': {
      const run = current.runs.find((r) => r.month === p.month) || bad('No payroll run for ' + p.month)
      if (run.status === 'Paid') bad(monthLabel(run.month) + ' is already paid')
      return { month: run.month, paidAt: new Date().toISOString(), by: actor.name }
    }

    case 'regularisation.add': {
      const r = p.request || {}
      const date = isoDate(r.date, 'Date')
      const age = (Date.now() - Date.parse(date)) / 86400000
      if (age < -1) bad('You cannot regularise a day that has not happened yet')
      if (age > 62) bad('Regularisation is only open for the last 60 days')
      const time = (v, field) => (v === '' || v == null ? null : /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : bad(field + ' must be a time like 09:30'))
      const inT = time(r.in, 'Punch-in')
      const outT = time(r.out, 'Punch-out')
      if (!inT && !outT) bad('Enter the punch-in time, the punch-out time, or both')
      if (inT && outT && outT <= inT) bad('Punch-out must be after punch-in')
      if (current.some((x) => x.empId === actor.id && x.date === date && x.status === 'Pending')) bad('You already have a pending request for ' + date)
      return { request: {
        id: uniqueId(current, r.id, /^RG-\d+$/, 'RG-', 1000),
        empId: actor.id, employee: actor.name, date, in: inT, out: outT,
        type: oneOf(r.type, REGULARISATION_TYPES, REGULARISATION_TYPES[0]),
        reason: required(r.reason, 'Reason', 300),
        status: 'Pending', appliedOn: today(),
      } }
    }

    case 'regularisation.decide': {
      const target = find(current, p.id, 'Regularisation request')
      if (target.empId === actor.id) forbidden('You cannot approve your own regularisation')
      if (target.status !== 'Pending') bad(target.id + ' is already ' + target.status.toLowerCase())
      return { id: target.id, status: oneOf(p.status, ['Approved', 'Rejected']) || bad('Status must be Approved or Rejected'), by: actor.name }
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
    case 'leaveRequests':
    case 'regularisations':
    case 'onboarding':
    case 'appraisals': return can(PERMS.HR_PEOPLE) ? value : value.filter((r) => r.empId === actor.id)
    case 'payroll': {
      if (can(PERMS.HR_PEOPLE)) return value
      // Employees see only their own payslips, and only once released.
      const paid = new Set(value.runs.filter((r) => r.status === 'Paid').map((r) => r.month))
      return {
        runs: value.runs.filter((r) => paid.has(r.month)).map(({ id, month, status, paidAt }) => ({ id, month, status, paidAt })),
        payslips: value.payslips.filter((x) => x.empId === actor.id && paid.has(x.month)),
      }
    }
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
    case 'candidate.decide':
      return [{ to: hasPerm(PERMS.HR_PEOPLE), notification: { title: payload.name + ' ' + (payload.decision === 'Hired' ? 'hired' : 'not selected'), detail: 'Decision by ' + actor.name, to: payload.decision === 'Hired' ? '/onboarding' : '/recruitment', kind: 'task' } }]
    case 'onboarding.start': {
      const r = payload.record
      return r.empId ? [{ to: (u) => u.id === r.empId, notification: { title: 'Welcome aboard - your onboarding has started', detail: r.tasks.length + ' tasks and ' + r.policies.length + ' policies to acknowledge', to: '/onboarding', kind: 'task' } }] : []
    }
    case 'appraisal.self': {
      const a = before.find((x) => x.id === payload.id)
      return [{ to: hasPerm(PERMS.HR_PEOPLE), notification: { title: 'Self review from ' + a.employee, detail: a.cycle + ' - ready for manager review', to: '/performance', kind: 'task' } }]
    }
    case 'appraisal.review': {
      const a = before.find((x) => x.id === payload.id)
      return [{ to: (u) => u.id === a.empId, notification: { title: 'Your appraisal is complete', detail: a.cycle + ' - rating ' + payload.manager.rating + ' by ' + actor.name, to: '/performance', kind: 'info' } }]
    }
    case 'payroll.pay':
      return [{ to: (u) => u.username !== actor.username, notification: { title: 'Payslip for ' + monthLabel(payload.month) + ' is ready', detail: 'Salary has been processed', to: '/payroll', kind: 'info' } }]
    case 'regularisation.add': {
      const r = payload.request
      return [{ to: hasPerm(PERMS.HR_PEOPLE), notification: { title: 'Regularisation request from ' + r.employee, detail: r.type + ' on ' + r.date, to: '/attendance', kind: 'task' } }]
    }
    case 'regularisation.decide': {
      const r = before.find((x) => x.id === payload.id)
      return [{ to: (u) => u.id === r.empId, notification: { title: 'Regularisation ' + payload.status.toLowerCase(), detail: r.date + ' - ' + r.type + ', by ' + actor.name, to: '/attendance', kind: payload.status === 'Approved' ? 'info' : 'alert' } }]
    }
    case 'announcement.add': {
      const a = payload.announcement
      return [{ to: (u) => u.username !== actor.username, notification: { title: 'New announcement', detail: a.title, to: '/announcements', kind: 'info' } }]
    }
    default:
      return []
  }
}
