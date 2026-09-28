// Workforce insights: an explainable attrition-risk score and the live
// alerts shown on the dashboards. Both are computed from the data already in
// the app, so they update as soon as the data does.
//
// The risk score is a transparent points model, not a trained predictor:
// every point comes from a named factor HR can see and discuss. It is meant
// to start retention conversations, never to decide anything about a person.

import { employeeDay, isWorkingDay } from './attendance.js'
import { isUnpaidLeave } from './leave.js'
import { bandPosition } from './payroll.js'
import { addDays, grievanceSla } from './growth.js'

const years = (from, to) => (Date.parse(to) - Date.parse(from)) / (365.25 * 86400000)

/** { score 0-100, level, factors: [{ label, points }] } for one person. */
export function attritionRisk(emp, { appraisals = [], leaveRequests = [], training, today }) {
  const factors = []
  const add = (label, points) => factors.push({ label, points })
  if (emp.status === 'On Notice') add('Serving notice period', 70)
  const tenure = years(emp.joinDate, today)
  if (tenure < 1) add('In the first year', 12)
  else if (tenure >= 2 && tenure < 4) add('2-4 years in - a common exit point', 10)
  if (emp.employmentType === 'Contract') add('On a contract', 10)
  const pos = bandPosition(emp)
  if (pos < 0.33) add('Paid in the bottom third of the band', 15)
  const a = appraisals.find((x) => x.empId === emp.id)
  const last = a?.manager?.rating ?? a?.history?.[0]?.rating
  if (last != null && last < 3.2) add('Last rating ' + last, 15)
  if (last != null && last >= 4.4 && pos < 0.5) add('High performer paid below mid-band', 12)
  if (a && a.goals.length) {
    const w = a.goals.reduce((s, g) => s + g.progress * g.weight, 0) / a.goals.reduce((s, g) => s + g.weight, 0)
    if (w < 40) add('Goal progress under 40%', 8)
  }
  // Last 30 days of attendance.
  let absent = 0
  let late = 0
  for (let i = 1; i <= 30; i++) {
    const d = addDays(today, -i)
    if (!isWorkingDay(d)) continue
    const r = employeeDay(emp, d, { leaveRequests, today })
    if (r.status === 'Absent') absent++
    if (r.late) late++
  }
  if (absent >= 2) add(absent + ' unplanned absences in 30 days', 6 * Math.min(absent, 3))
  if (late >= 5) add('Late ' + late + ' times in 30 days', 6)
  const recent = leaveRequests.filter((r) => r.empId === emp.id && r.from >= addDays(today, -90) && (isUnpaidLeave(r.type) || /sick/i.test(r.type)))
  if (recent.length >= 2) add('Frequent sick or unpaid leave', 8)
  if (training && !training.enrollments.some((e) => e.empId === emp.id && e.status === 'Completed')) add('No training completed this year', 5)

  const score = Math.min(100, 5 + factors.reduce((s, f) => s + f.points, 0))
  return { score, level: score >= 50 ? 'High' : score >= 30 ? 'Medium' : 'Low', factors: factors.sort((x, y) => y.points - x.points) }
}

export const riskTone = (level) => ({ High: 'red', Medium: 'amber', Low: 'green' }[level] || 'gray')

/**
 * Live alerts for one person: [{ id, level: 'critical' | 'warning' | 'info', title, detail, to }].
 * `can(perm)` is the viewer's permission check; `state` is what they can see.
 */
export function alertsFor(state, { user, can, perms, today, nowMin }) {
  const out = []
  const push = (id, level, title, detail, to) => out.push({ id, level, title, detail, to })
  const old = (iso, days) => iso && iso <= addDays(today, -days)
  const d = Number(today.slice(8, 10))

  if (can(perms.HR_PEOPLE)) {
    const stale = (state.leaveRequests || []).filter((r) => r.status === 'Pending' && r.empId !== user.id && old(r.appliedOn, 2))
    if (stale.length) push('leave-stale', 'warning', stale.length + ' leave request' + (stale.length > 1 ? 's' : '') + ' waiting over 2 days', 'Oldest from ' + stale[stale.length - 1].employee, '/leave')
    const cases = (state.grievances || []).map((g) => ({ g, sla: grievanceSla(g, today) }))
    const late = cases.filter((c) => c.sla.overdue)
    if (late.length) push('gr-overdue', 'critical', late.length + ' grievance' + (late.length > 1 ? 's' : '') + ' past SLA - escalated', late.map((c) => c.g.id + ' (' + c.g.severity + ')').join(', '), '/grievances')
    const fresh = cases.filter((c) => c.g.status === 'Submitted' && !c.sla.overdue)
    if (fresh.length) push('gr-new', 'warning', fresh.length + ' new grievance' + (fresh.length > 1 ? 's' : '') + ' to acknowledge', 'Assign an investigator', '/grievances')
    const obLate = (state.onboarding || []).filter((r) => r.status !== 'Completed').flatMap((r) => r.tasks.filter((t) => !t.done && t.due < today).map(() => r.name))
    if (obLate.length) push('ob-late', 'warning', obLate.length + ' overdue onboarding task' + (obLate.length > 1 ? 's' : ''), 'For ' + [...new Set(obLate)].join(', '), '/onboarding')
    const reviews = (state.appraisals || []).filter((a) => a.status === 'Manager review' && a.empId !== user.id)
    if (reviews.length) push('ap-review', 'info', reviews.length + ' appraisal' + (reviews.length > 1 ? 's' : '') + ' ready for review', 'Self reviews are in', '/performance')
    const month = today.slice(0, 7)
    const run = state.payroll?.runs?.find((r) => r.month === month)
    if (d >= 25 && !run) push('pay-run', 'critical', 'Payroll for this month has not been run', 'Salaries are due on the last working day', '/payroll')
    else if (d >= 25 && run?.status !== 'Paid') push('pay-paid', 'warning', 'This month\'s payroll is processed but not paid', 'Mark it paid to release payslips', '/payroll')
    const risky = (state.employees || []).filter((e) => e.status !== 'On Notice' && attritionRisk(e, { ...state, today }).level === 'High')
    if (risky.length) push('attr', 'info', risky.length + ' people at high attrition risk', 'See the factors in Reports', '/reports')
  }
  if (can(perms.HR_DESK)) {
    const breached = (state.tickets || []).filter((t) => t.sla === 'Breached' && t.status !== 'Resolved')
    if (breached.length) push('hd-sla', 'critical', breached.length + ' helpdesk ticket' + (breached.length > 1 ? 's' : '') + ' past SLA', breached.map((t) => t.id).join(', '), '/helpdesk')
  }
  if (can(perms.HR_HIRING)) {
    const ivs = (state.candidates || []).flatMap((c) => (c.interviews || []).filter((i) => i.status === 'Scheduled' && i.at.startsWith(today)).map((i) => c.name + ' at ' + i.at.slice(11)))
    if (ivs.length) push('iv-today', 'info', ivs.length + ' interview' + (ivs.length > 1 ? 's' : '') + ' today', ivs.join(', '), '/recruitment')
  }

  // Everyone: their own to-dos.
  const me = user.id
  const ob = (state.onboarding || []).find((r) => r.empId === me && r.status !== 'Completed')
  if (ob) {
    const mine = ob.tasks.filter((t) => t.owner === 'New joiner' && !t.done)
    const acks = (ob.policies || []).length - (ob.acknowledgements || []).length
    if (mine.length || acks) push('my-ob', mine.some((t) => t.due < today) ? 'warning' : 'info', 'Finish your onboarding', [mine.length && mine.length + ' task' + (mine.length > 1 ? 's' : ''), acks && acks + ' polic' + (acks > 1 ? 'ies' : 'y') + ' to acknowledge'].filter(Boolean).join(' and '), '/onboarding')
  }
  const courses = state.training?.courses || []
  for (const e of (state.training?.enrollments || []).filter((x) => x.empId === me && x.status !== 'Completed' && x.due)) {
    if (e.due <= addDays(today, 7)) push('my-course-' + e.id, e.due < today ? 'critical' : 'warning', (e.due < today ? 'Overdue: ' : 'Due soon: ') + (courses.find((c) => c.id === e.courseId)?.title || e.courseId), 'Due ' + e.due, '/learning')
  }
  const ap = (state.appraisals || []).find((a) => a.empId === me)
  if (ap && ['Goal setting', 'Self review'].includes(ap.status)) push('my-self', 'info', 'Your self review is open', ap.cycle, '/performance')
  const punch = state.punch
  // A punch with no date is from before per-day records (see isPunchedIn in actions.js).
  const punchedToday = (punch?.inAt && (!punch.date || punch.date === today)) || punch?.history?.[today]?.in
  if (isWorkingDay(today) && nowMin > 615 && !punchedToday) push('my-punch', 'warning', 'You have not punched in today', 'Punch in, or regularise it later', '/attendance')
  const replies = (state.grievances || []).filter((g) => g.raisedById === me && g.updates?.length && g.updates[g.updates.length - 1].by !== user.name && g.status !== 'Closed')
  if (replies.length) push('my-gr', 'info', 'HR replied on your case', replies.map((g) => g.id).join(', '), '/grievances')

  const rank = { critical: 0, warning: 1, info: 2 }
  return out.sort((a, b) => rank[a.level] - rank[b.level])
}
