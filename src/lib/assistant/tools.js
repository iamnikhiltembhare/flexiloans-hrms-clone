// HR Assistant tools, shared by the API server and the offline demo.
//
// Every tool runs against `ctx.state`, which is already the signed-in
// person's permitted view of the data (server: stateFor(actor); browser: the
// DataContext state). A tool also checks the person's permissions itself, so
// asking in natural language never reaches more than the screens would.
//
// Read tools return { data, card }: `data` is what the language model sees,
// `card` is what the chat window renders (a table, stats or a checklist).
// Write tools never change anything. They return a `proposal` - the exact
// { type, payload } the app sends to /api/actions - which runs only after the
// person presses Confirm, through the same server validation as the screens.

import { PERMS } from '../../data/accounts.js'
import { departments, locations, leaveBalances, headcountTrend } from '../../data/mock.js'
import { companyHolidays } from '../../data/holidays.js'
import { TICKET_DESKS, needsAdminApproval, ticketClosed, CANDIDATE_STAGES } from '../actions.js'

// --- helpers ------------------------------------------------------------

const lc = (s) => String(s ?? '').toLowerCase().trim()
const can = (ctx, perm) => ctx.actor.perms.includes(perm)
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const hhmm = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60)

class ToolError extends Error {}
const deny = (msg) => { throw new ToolError(msg) }

/** Loose match for a department, location or leave type typed in chat. */
function pick(list, text) {
  const t = lc(text)
  if (!t) return null
  return list.find((x) => lc(x) === t) || list.find((x) => lc(x).startsWith(t)) || list.find((x) => lc(x).includes(t)) || null
}

/** Find people by name or employee id; best matches first. */
export function findPeople(employees, text) {
  const t = lc(text).replace(/'s\b/g, '')
  if (!t) return []
  const byId = employees.filter((e) => lc(e.id) === t)
  if (byId.length) return byId
  const exact = employees.filter((e) => lc(e.name) === t || lc(e.username) === t)
  if (exact.length) return exact
  const words = t.split(/\s+/).filter(Boolean)
  return employees.filter((e) => words.every((w) => lc(e.name).includes(w)))
}

const personRow = (e) => ({
  id: e.id, name: e.name, designation: e.designation, department: e.department,
  location: e.location, joinDate: e.joinDate, manager: e.manager, status: e.status,
})

function monthRange(spec, today) {
  const t = parseISO(today)
  if (/^\d{4}-\d{2}$/.test(spec || '')) {
    const [y, m] = spec.split('-').map(Number)
    return [new Date(y, m - 1, 1), new Date(y, m, 0)]
  }
  if (spec === 'last_month') return [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)]
  return [new Date(t.getFullYear(), t.getMonth(), 1), t]
}

// --- attendance model ---------------------------------------------------
// The directory has no punch history for most people, so each day is derived
// deterministically from the employee id and date (the same answer every
// time), with approved leave and holidays applied. A person's own real
// punches, when known, replace the derived day.

const rnd = (seed) => { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return ((h >>> 0) % 10000) / 10000 }
const holidaySet = new Set(companyHolidays.map((h) => h.date))

export function employeeDay(emp, date, ctx) {
  const d = parseISO(date)
  const dow = d.getDay()
  if (holidaySet.has(date)) return { status: 'Holiday' }
  if (dow === 0 || dow === 6) return { status: 'Weekly off' }
  const onLeave = (ctx.state.leaveRequests || []).some((r) => r.empId === emp.id && r.status === 'Approved' && r.from <= date && r.to >= date)
  if (onLeave) return { status: 'On leave' }
  if (emp.id === ctx.actor.id) {
    const real = ctx.state.punch?.history?.[date]
    if (real?.in) return { status: 'Present', firstIn: real.in, lastOut: real.out || null, real: true }
  }
  const r = rnd(emp.id + date)
  if (r < 0.05) return { status: 'Absent' }
  const inMin = 575 + Math.floor(rnd(date + emp.id) * 55)
  const outMin = inMin + 530 + Math.floor(rnd(emp.id + date + 'o') * 80)
  const isToday = date === ctx.today
  if (isToday && ctx.nowMin != null && ctx.nowMin < inMin) return { status: 'Not in yet' }
  return {
    status: 'Present', late: inMin > 615, firstIn: hhmm(inMin),
    lastOut: isToday && ctx.nowMin != null && ctx.nowMin < outMin ? null : hhmm(outMin),
    hours: +(((isToday && ctx.nowMin != null ? Math.min(outMin, ctx.nowMin) : outMin) - inMin) / 60).toFixed(1),
  }
}

// --- tool definitions -----------------------------------------------------
// `schema` is the JSON Schema Claude sees; `run(input, ctx)` does the work.

const str = (description) => ({ type: 'string', description })
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false })

export const TOOLS = {
  search_employees: {
    description: 'Search the employee directory. Filter by free text (name, id, designation), department, location, designation, joining period or manager. Returns name, id, designation, department, location, joining date and manager - never salary, bank, PAN or other personal details.',
    schema: obj({
      query: str('Name, employee id or designation words'),
      department: { type: 'string', enum: departments },
      location: { type: 'string', enum: locations },
      joined: { type: 'string', enum: ['this_month', 'last_month', 'last_30_days', 'this_year'], description: 'Joining period' },
      manager: str('Reporting manager name'),
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    }),
    run(input, ctx) {
      let list = ctx.state.employees
      const today = parseISO(ctx.today)
      if (input.query) {
        const q = lc(input.query)
        list = list.filter((e) => (lc(e.name) + ' ' + lc(e.id) + ' ' + lc(e.designation) + ' ' + lc(e.username)).includes(q) || findPeople([e], q).length)
      }
      if (input.department) list = list.filter((e) => e.department === pick(departments, input.department))
      if (input.location) list = list.filter((e) => e.location === pick(locations, input.location))
      if (input.manager) list = list.filter((e) => lc(e.manager).includes(lc(input.manager)))
      if (input.joined) {
        const from = input.joined === 'this_month' ? new Date(today.getFullYear(), today.getMonth(), 1)
          : input.joined === 'last_month' ? new Date(today.getFullYear(), today.getMonth() - 1, 1)
            : input.joined === 'this_year' ? new Date(today.getFullYear(), 0, 1)
              : new Date(today.getTime() - 30 * 86400000)
        const to = input.joined === 'last_month' ? new Date(today.getFullYear(), today.getMonth(), 0) : today
        list = list.filter((e) => e.joinDate >= ymd(from) && e.joinDate <= ymd(to))
      }
      const rows = list.slice(0, input.limit || 50).map(personRow)
      return {
        data: { total: list.length, shown: rows.length, employees: rows },
        card: { kind: 'table', title: list.length + ' employee' + (list.length === 1 ? '' : 's'), columns: ['name', 'id', 'designation', 'department', 'location', 'joinDate'], rows, csv: 'employees' },
      }
    },
  },

  get_employee: {
    description: 'Look up one employee by name or id: designation, department, location, joining date, manager, status and employment type. Does not return salary, bank, PAN, Aadhaar or other sensitive personal data.',
    schema: obj({ name_or_id: str('Employee name or id, e.g. "Nilesh Shaikh" or "FL1001"') }, ['name_or_id']),
    run(input, ctx) {
      const found = findPeople(ctx.state.employees, input.name_or_id)
      if (!found.length) return { data: { found: 0 }, card: { kind: 'note', text: 'No employee matches "' + input.name_or_id + '".' } }
      const rows = found.slice(0, 5).map((e) => ({ ...personRow(e), employmentType: e.employmentType, email: e.email }))
      return { data: { found: found.length, employees: rows }, card: { kind: 'people', rows } }
    },
  },

  attendance_today: {
    description: 'Today\'s attendance: how many are present, late, absent, on leave or not in yet, with names. HR sees the whole company or one department; employees see only themselves.',
    schema: obj({ department: { type: 'string', enum: departments } }),
    run(input, ctx) {
      const org = can(ctx, PERMS.HR_PEOPLE)
      let people = org ? ctx.state.employees : ctx.state.employees.filter((e) => e.id === ctx.actor.id)
      if (!org && !people.length) people = [{ ...ctx.actor }]
      if (input.department) people = people.filter((e) => e.department === pick(departments, input.department))
      const rows = people.map((e) => ({ name: e.name, id: e.id, department: e.department, ...employeeDay(e, ctx.today, ctx) }))
      const count = (s) => rows.filter((r) => r.status === s).length
      const summary = {
        date: ctx.today, total: rows.length, present: count('Present'), late: rows.filter((r) => r.late).length,
        absent: count('Absent'), on_leave: count('On leave'), not_in_yet: count('Not in yet'),
        off: count('Weekly off') + count('Holiday'),
      }
      const attention = rows.filter((r) => r.status === 'Absent' || r.status === 'On leave' || r.late)
      return {
        data: { scope: org ? (input.department || 'company') : 'self', summary, absent: rows.filter((r) => r.status === 'Absent').map((r) => r.name), on_leave: rows.filter((r) => r.status === 'On leave').map((r) => r.name), late: rows.filter((r) => r.late).map((r) => r.name + ' (' + r.firstIn + ')') },
        card: { kind: 'stats', title: 'Attendance on ' + ctx.today + (input.department ? ' - ' + pick(departments, input.department) : ''),
          stats: [['Present', summary.present, 'green'], ['Late', summary.late, 'amber'], ['Absent', summary.absent, 'red'], ['On leave', summary.on_leave, 'purple'], ['Not in yet', summary.not_in_yet, 'gray']],
          table: attention.length ? { columns: ['name', 'department', 'status', 'firstIn'], rows: attention.map((r) => ({ name: r.name, department: r.department, status: r.late ? 'Late' : r.status, firstIn: r.firstIn || '--' })) } : null },
      }
    },
  },

  attendance_report: {
    description: 'Monthly attendance report per employee: days present, late, absent, on leave and average hours. HR can report on a department or the company; employees get their own.',
    schema: obj({
      department: { type: 'string', enum: departments },
      month: str('"this_month" (default), "last_month" or YYYY-MM'),
      employee: str('Limit to one employee by name or id'),
    }),
    run(input, ctx) {
      const org = can(ctx, PERMS.HR_PEOPLE)
      let people = org ? ctx.state.employees : ctx.state.employees.filter((e) => e.id === ctx.actor.id)
      if (input.department) people = people.filter((e) => e.department === pick(departments, input.department))
      if (input.employee) people = findPeople(people, input.employee)
      const [from, to] = monthRange(input.month, ctx.today)
      const days = []
      for (let d = new Date(from); d <= to && ymd(d) <= ctx.today; d.setDate(d.getDate() + 1)) days.push(ymd(d))
      const rows = people.map((e) => {
        const recs = days.map((day) => employeeDay(e, day, ctx))
        const present = recs.filter((r) => r.status === 'Present')
        return {
          name: e.name, id: e.id, department: e.department,
          present: present.length, late: present.filter((r) => r.late).length,
          absent: recs.filter((r) => r.status === 'Absent').length, leave: recs.filter((r) => r.status === 'On leave').length,
          avgHours: present.length ? +(present.reduce((s, r) => s + (r.hours || 0), 0) / present.length).toFixed(1) : 0,
        }
      })
      const label = from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      const totals = rows.reduce((t, r) => ({ present: t.present + r.present, late: t.late + r.late, absent: t.absent + r.absent, leave: t.leave + r.leave }), { present: 0, late: 0, absent: 0, leave: 0 })
      return {
        data: { period: label, working_days_so_far: days.filter((d) => ![0, 6].includes(parseISO(d).getDay()) && !holidaySet.has(d)).length, employees: rows.length, totals, rows: rows.slice(0, 40) },
        card: { kind: 'table', title: 'Attendance report - ' + (input.department ? pick(departments, input.department) + ', ' : '') + label, columns: ['name', 'department', 'present', 'late', 'absent', 'leave', 'avgHours'], rows, csv: 'attendance-report' },
      }
    },
  },

  leave_balance: {
    description: 'Leave balances by leave type. Anyone can see their own; HR can check another employee\'s.',
    schema: obj({ employee: str('Employee name or id; omit for yourself') }),
    run(input, ctx) {
      let who = ctx.actor.name
      if (input.employee && findPeople([ctx.actor], input.employee).length === 0) {
        if (!can(ctx, PERMS.HR_PEOPLE)) deny('You can only see your own leave balance.')
        const found = findPeople(ctx.state.employees, input.employee)
        if (!found.length) deny('No employee matches "' + input.employee + '".')
        who = found[0].name
      }
      const rows = leaveBalances.map((l) => ({ type: l.type, granted: l.granted, used: l.used, balance: l.balance }))
      return { data: { employee: who, balances: rows }, card: { kind: 'table', title: 'Leave balance - ' + who, columns: ['type', 'granted', 'used', 'balance'], rows } }
    },
  },

  list_leave_requests: {
    description: 'List leave requests. HR sees everyone\'s and can filter by department, status or employee; employees see their own.',
    schema: obj({
      status: { type: 'string', enum: ['Pending', 'Approved', 'Rejected'] },
      department: { type: 'string', enum: departments },
      employee: str('Employee name or id'),
    }),
    run(input, ctx) {
      let list = ctx.state.leaveRequests
      const deptOf = (id) => ctx.state.employees.find((e) => e.id === id)?.department
      if (input.status) list = list.filter((r) => r.status === input.status)
      if (input.department) list = list.filter((r) => deptOf(r.empId) === pick(departments, input.department))
      if (input.employee) { const ids = findPeople(ctx.state.employees, input.employee).map((e) => e.id); list = list.filter((r) => ids.includes(r.empId)) }
      const rows = list.map((r) => ({ id: r.id, employee: r.employee, department: deptOf(r.empId) || '--', type: r.type, from: r.from, to: r.to, days: r.days, status: r.status }))
      return { data: { count: rows.length, can_decide: can(ctx, PERMS.HR_PEOPLE), requests: rows }, card: { kind: 'table', title: rows.length + ' leave request' + (rows.length === 1 ? '' : 's'), columns: ['id', 'employee', 'department', 'type', 'from', 'to', 'days', 'status'], rows } }
    },
  },

  pending_tasks: {
    description: 'Summary of what is waiting for the signed-in person: approvals for HR and admins (leave, regularisation, tickets), and their own pending requests.',
    schema: obj({}),
    run(_input, ctx) {
      const s = ctx.state
      const items = []
      if (can(ctx, PERMS.HR_PEOPLE)) {
        const leave = s.leaveRequests.filter((r) => r.status === 'Pending' && r.empId !== ctx.actor.id)
        const regs = (s.regularisations || []).filter((r) => r.status === 'Pending' && r.empId !== ctx.actor.id)
        if (leave.length) items.push({ task: 'Leave requests to approve', count: leave.length, detail: leave.map((r) => r.employee).join(', '), to: '/leave' })
        if (regs.length) items.push({ task: 'Regularisations to approve', count: regs.length, detail: regs.map((r) => r.employee + ' (' + r.date + ')').join(', '), to: '/attendance' })
      }
      if (can(ctx, PERMS.HR_DESK)) {
        const mine = s.tickets.filter((t) => !ticketClosed(t.status) && (can(ctx, PERMS.ADMIN_SYSTEM) || !needsAdminApproval(t.category)))
        if (mine.length) items.push({ task: 'Open helpdesk tickets', count: mine.length, detail: mine.map((t) => t.id).join(', '), to: '/helpdesk' })
      }
      if (can(ctx, PERMS.ADMIN_SYSTEM)) {
        const appr = s.tickets.filter((t) => needsAdminApproval(t.category) && !ticketClosed(t.status) && t.status !== 'Approved')
        if (appr.length) items.push({ task: 'IT and Finance tickets to approve', count: appr.length, detail: appr.map((t) => t.id).join(', '), to: '/helpdesk' })
      }
      if (can(ctx, PERMS.HR_HIRING)) {
        const offers = s.candidates.filter((c) => c.stage === 'Offer Rolled')
        if (offers.length) items.push({ task: 'Offers awaiting sign-off', count: offers.length, detail: offers.map((c) => c.name).join(', '), to: '/recruitment' })
      }
      const ownLeave = s.leaveRequests.filter((r) => r.empId === ctx.actor.id && r.status === 'Pending')
      const ownRegs = (s.regularisations || []).filter((r) => r.empId === ctx.actor.id && r.status === 'Pending')
      if (ownLeave.length) items.push({ task: 'Your leave requests awaiting approval', count: ownLeave.length, detail: ownLeave.map((r) => r.from + ' to ' + r.to).join(', '), to: '/leave' })
      if (ownRegs.length) items.push({ task: 'Your regularisations awaiting approval', count: ownRegs.length, detail: ownRegs.map((r) => r.date).join(', '), to: '/attendance' })
      return { data: { items }, card: { kind: 'tasks', rows: items } }
    },
  },

  list_tickets: {
    description: 'Helpdesk tickets. HR sees HR-desk tickets and read-only IT/Finance ones; employees see their own.',
    schema: obj({
      status: { type: 'string', enum: ['Open', 'In Progress', 'Approved', 'Rejected', 'Resolved'] },
      category: { type: 'string', enum: Object.keys(TICKET_DESKS) },
      awaiting_approval: { type: 'boolean', description: 'Only IT/Finance tickets waiting for a super admin' },
    }),
    run(input, ctx) {
      let list = ctx.state.tickets
      if (input.status) list = list.filter((t) => t.status === input.status)
      if (input.category) list = list.filter((t) => t.category === input.category)
      if (input.awaiting_approval) list = list.filter((t) => needsAdminApproval(t.category) && !ticketClosed(t.status) && t.status !== 'Approved')
      const rows = list.map((t) => ({ id: t.id, subject: t.subject, category: t.category, raisedBy: t.raisedBy, priority: t.priority, status: t.status }))
      return { data: { count: rows.length, tickets: rows }, card: { kind: 'table', title: rows.length + ' ticket' + (rows.length === 1 ? '' : 's'), columns: ['id', 'subject', 'category', 'raisedBy', 'priority', 'status'], rows } }
    },
  },

  recruitment: {
    description: 'Recruitment: open positions, candidates (optionally for one role) or the pipeline by stage. HR hiring access only.',
    schema: obj({ view: { type: 'string', enum: ['openings', 'candidates', 'pipeline'] }, role: str('Role or requisition to filter candidates') }, ['view']),
    run(input, ctx) {
      if (!can(ctx, PERMS.HR_HIRING)) deny('Recruitment data is limited to the HR team.')
      if (input.view === 'openings') {
        const rows = ctx.state.requisitions.map((o) => ({ id: o.id, role: o.role, dept: o.dept, location: o.location, applicants: o.applicants, stage: o.stage, priority: o.priority }))
        return { data: { count: rows.length, openings: rows }, card: { kind: 'table', title: rows.length + ' open positions', columns: ['id', 'role', 'dept', 'location', 'applicants', 'stage', 'priority'], rows } }
      }
      let cands = ctx.state.candidates
      if (input.role) cands = cands.filter((c) => lc(c.role).includes(lc(input.role)))
      if (input.view === 'pipeline') {
        const rows = CANDIDATE_STAGES.map((s) => ({ stage: s, candidates: cands.filter((c) => c.stage === s).length, names: cands.filter((c) => c.stage === s).map((c) => c.name).join(', ') }))
        return { data: { pipeline: rows }, card: { kind: 'table', title: 'Recruitment pipeline', columns: ['stage', 'candidates', 'names'], rows } }
      }
      const rows = cands.map((c) => ({ name: c.name, role: c.role, stage: c.stage, rating: c.rating, source: c.source }))
      return { data: { count: rows.length, candidates: rows }, card: { kind: 'table', title: rows.length + ' candidates', columns: ['name', 'role', 'stage', 'rating', 'source'], rows } }
    },
  },

  headcount_report: {
    description: 'Headcount report grouped by department, location or status, plus the six-month joiner/exit trend and turnover rate. HR reports access.',
    schema: obj({ group_by: { type: 'string', enum: ['department', 'location', 'status'] } }),
    run(input, ctx) {
      if (!can(ctx, PERMS.HR_REPORTS)) deny('Workforce reports are limited to HR.')
      const key = input.group_by || 'department'
      const counts = {}
      for (const e of ctx.state.employees) counts[e[key]] = (counts[e[key]] || 0) + 1
      const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ [key]: k, employees: n }))
      const exits = headcountTrend.reduce((s, m) => s + m.exits, 0)
      const avg = headcountTrend.reduce((s, m) => s + m.headcount, 0) / headcountTrend.length
      const turnover = +((exits / avg) * 100).toFixed(1)
      return {
        data: { directory_total: ctx.state.employees.length, by: key, rows, trend: headcountTrend, six_month_turnover_percent: turnover },
        card: { kind: 'table', title: 'Headcount by ' + key + ' - ' + ctx.state.employees.length + ' in directory, ' + turnover + '% turnover (6 months)', columns: [key, 'employees'], rows, csv: 'headcount-by-' + key },
      }
    },
  },

  onboarding_checklist: {
    description: 'Draft an onboarding checklist for a new hire in a given role, with tasks assigned to HR, IT, Finance, Admin, the manager and the new joiner, and due days relative to the start date.',
    schema: obj({ role: str('Job title, e.g. "Software Engineer"'), department: { type: 'string', enum: departments }, start_date: str('YYYY-MM-DD; defaults to next Monday') }, ['role']),
    run(input, ctx) {
      if (!can(ctx, PERMS.HR_PEOPLE)) deny('Onboarding checklists are prepared by HR.')
      const t = parseISO(ctx.today)
      const start = input.start_date && /^\d{4}-\d{2}-\d{2}$/.test(input.start_date) ? input.start_date : ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + ((8 - t.getDay()) % 7 || 7)))
      const tech = /engineer|developer|devops|qa|data|product designer/i.test(input.role)
      const sales = /sales|relationship|collection/i.test(input.role)
      const on = (days) => { const d = parseISO(start); d.setDate(d.getDate() + days); return ymd(d) }
      const tasks = [
        ['HR', 'Send offer acceptance and joining instructions', -7],
        ['HR', 'Collect documents: PAN, Aadhaar, address proof, previous employer relieving letter', -3],
        ['Finance', 'Set up payroll, bank account and tax declaration', -2],
        ['IT', tech ? 'Laptop with developer image, VPN, GitHub and Jira access' : 'Laptop, email and HRMS access', -2],
        ['Admin', 'Access card and seat at ' + (input.department ? 'the ' + pick(departments, input.department) + ' bay' : 'the team bay'), -1],
        ['Manager', 'Share a 30-60-90 day plan and assign a buddy', 0],
        ['HR', 'Day 1 induction: policies, POSH, code of conduct', 0],
        ['New joiner', 'Complete profile and nominations in the HRMS', 2],
        ...(tech ? [['Manager', 'Walk through architecture, codebase and on-call process', 3], ['IT', 'Grant staging and production read access after security training', 5]] : []),
        ...(sales ? [['Manager', 'Product and credit policy training; CRM access', 3], ['Admin', 'Visiting cards and field travel policy briefing', 5]] : []),
        ['New joiner', 'Complete mandatory compliance training (KYC, AML, information security)', 7],
        ['HR', '30-day check-in with the new joiner and manager', 30],
      ].map(([owner, task, day]) => ({ owner, task, due: on(day) }))
      return {
        data: { role: input.role, start_date: start, tasks },
        card: { kind: 'checklist', title: 'Onboarding checklist - ' + input.role + ', starting ' + start, rows: tasks, csv: 'onboarding-checklist' },
      }
    },
  },

  // --- proposals (write actions, confirmed by the person) -----------------

  propose_leave_decision: {
    write: true,
    description: 'Prepare approving or rejecting a pending leave request. Does not act - the person must confirm. HR only; you cannot decide your own leave.',
    schema: obj({ employee_or_request: str('Employee name or leave request id (e.g. LV-2041)'), decision: { type: 'string', enum: ['approve', 'reject'] } }, ['employee_or_request', 'decision']),
    run(input, ctx) {
      if (!can(ctx, PERMS.HR_PEOPLE)) deny('Only HR can approve or reject leave.')
      const key = lc(input.employee_or_request)
      const pending = ctx.state.leaveRequests.filter((r) => r.status === 'Pending' && r.empId !== ctx.actor.id)
      const ids = findPeople(ctx.state.employees, key).map((e) => e.id)
      const matches = pending.filter((r) => lc(r.id) === key || ids.includes(r.empId))
      if (!matches.length) deny('There is no pending leave request for "' + input.employee_or_request + '".')
      if (matches.length > 1) deny('More than one pending request matches: ' + matches.map((r) => r.id + ' (' + r.employee + ')').join(', ') + '. Say which one.')
      const r = matches[0]
      const status = input.decision === 'approve' ? 'Approved' : 'Rejected'
      return proposal({ type: 'leave.setStatus', payload: { id: r.id, status },
        summary: (input.decision === 'approve' ? 'Approve' : 'Reject') + ' ' + r.employee + '\'s ' + r.type + ' (' + r.days + ' day' + (r.days > 1 ? 's' : '') + ', ' + r.from + (r.to !== r.from ? ' to ' + r.to : '') + ')',
        detail: 'Request ' + r.id + ': "' + r.reason + '". ' + r.employee + ' will be notified.', tone: status === 'Approved' ? 'green' : 'red' })
    },
  },

  propose_regularisation_decision: {
    write: true,
    description: 'Prepare approving or rejecting a pending attendance regularisation. Does not act - the person must confirm. HR only.',
    schema: obj({ employee_or_request: str('Employee name or regularisation id (e.g. RG-1002)'), decision: { type: 'string', enum: ['approve', 'reject'] } }, ['employee_or_request', 'decision']),
    run(input, ctx) {
      if (!can(ctx, PERMS.HR_PEOPLE)) deny('Only HR can decide regularisations.')
      const key = lc(input.employee_or_request)
      const ids = findPeople(ctx.state.employees, key).map((e) => e.id)
      const matches = (ctx.state.regularisations || []).filter((r) => r.status === 'Pending' && r.empId !== ctx.actor.id && (lc(r.id) === key || ids.includes(r.empId)))
      if (!matches.length) deny('There is no pending regularisation for "' + input.employee_or_request + '".')
      if (matches.length > 1) deny('More than one matches: ' + matches.map((r) => r.id + ' (' + r.date + ')').join(', ') + '. Say which one.')
      const r = matches[0]
      return proposal({ type: 'regularisation.decide', payload: { id: r.id, status: input.decision === 'approve' ? 'Approved' : 'Rejected' },
        summary: (input.decision === 'approve' ? 'Approve' : 'Reject') + ' ' + r.employee + '\'s regularisation for ' + r.date,
        detail: r.type + ': in ' + (r.in || '--') + ', out ' + (r.out || '--') + '. "' + r.reason + '"', tone: input.decision === 'approve' ? 'green' : 'red' })
    },
  },

  propose_ticket_update: {
    write: true,
    description: 'Prepare a helpdesk ticket change: start, resolve, reopen, or (super admin, IT/Finance tickets) approve or reject. Does not act - the person must confirm.',
    schema: obj({ ticket_id: str('Ticket id, e.g. HD-8836'), action: { type: 'string', enum: ['start', 'resolve', 'reopen', 'approve', 'reject'] } }, ['ticket_id', 'action']),
    run(input, ctx) {
      const t = ctx.state.tickets.find((x) => lc(x.id) === lc(input.ticket_id))
      if (!t) deny('Ticket ' + input.ticket_id + ' is not in your view.')
      const admin = can(ctx, PERMS.ADMIN_SYSTEM)
      if (!can(ctx, PERMS.HR_DESK)) deny('Only the helpdesk team can change tickets.')
      if ((input.action === 'approve' || input.action === 'reject') && !admin) deny('Only a super admin can approve or reject tickets.')
      if (needsAdminApproval(t.category) && !admin) deny(t.category + ' tickets belong to another department and are approved by a super admin.')
      const status = { start: 'In Progress', resolve: 'Resolved', reopen: 'Open', approve: 'Approved', reject: 'Rejected' }[input.action]
      return proposal({ type: 'ticket.setStatus', payload: { id: t.id, status },
        summary: input.action[0].toUpperCase() + input.action.slice(1) + ' ' + t.id + ' - ' + t.subject, detail: t.category + ' ticket raised by ' + t.raisedBy + '. They will be notified.', tone: input.action === 'reject' ? 'red' : 'green' })
    },
  },

  propose_candidate_advance: {
    write: true,
    description: 'Prepare moving a candidate to the next recruitment stage. Does not act - the person must confirm. HR hiring only.',
    schema: obj({ candidate: str('Candidate name') }, ['candidate']),
    run(input, ctx) {
      if (!can(ctx, PERMS.HR_HIRING)) deny('Only the hiring team can move candidates.')
      const c = ctx.state.candidates.find((x) => lc(x.name).includes(lc(input.candidate)))
      if (!c) deny('No candidate named "' + input.candidate + '".')
      const i = CANDIDATE_STAGES.indexOf(c.stage)
      if (i >= CANDIDATE_STAGES.length - 1) deny(c.name + ' is already ' + c.stage + '.')
      return proposal({ type: 'candidate.advance', payload: { name: c.name }, summary: 'Move ' + c.name + ' from ' + c.stage + ' to ' + CANDIDATE_STAGES[i + 1], detail: c.role, tone: 'green' })
    },
  },

  propose_leave_application: {
    write: true,
    description: 'Prepare a leave application for the signed-in person. Does not act - they must confirm. Dates are YYYY-MM-DD.',
    schema: obj({ type: { type: 'string', enum: leaveBalances.map((l) => l.type) }, from: str('Start date YYYY-MM-DD'), to: str('End date YYYY-MM-DD'), reason: str('Reason') }, ['type', 'from', 'to']),
    run(input, ctx) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to)) deny('I need the dates as YYYY-MM-DD.')
      if (input.to < input.from) deny('The end date is before the start date.')
      const days = Math.round((parseISO(input.to) - parseISO(input.from)) / 86400000) + 1
      const type = pick(leaveBalances.map((l) => l.type), input.type) || leaveBalances[0].type
      return proposal({ type: 'leave.add', payload: { request: { type, from: input.from, to: input.to, days, reason: input.reason || 'Personal', employee: ctx.actor.name, empId: ctx.actor.id } },
        summary: 'Apply for ' + days + ' day' + (days > 1 ? 's' : '') + ' of ' + type + ' (' + input.from + (input.to !== input.from ? ' to ' + input.to : '') + ')', detail: 'Goes to HR for approval.', tone: 'blue' })
    },
  },
}

function proposal(p) {
  return {
    data: { status: 'awaiting_confirmation', summary: p.summary, note: 'Nothing has changed yet. The user must press Confirm.' },
    proposal: { id: 'pr-' + Math.random().toString(36).slice(2, 9), type: p.type, payload: p.payload, summary: p.summary, detail: p.detail, tone: p.tone },
  }
}

/** Run a tool by name; permission problems come back as a plain message. */
export function runTool(name, input, ctx) {
  const tool = TOOLS[name]
  if (!tool) return { error: 'Unknown tool ' + name }
  try {
    return tool.run(input || {}, ctx)
  } catch (err) {
    if (err instanceof ToolError) return { error: err.message }
    throw err
  }
}

/** Tool list in the Messages API shape. */
export const toolSchemas = () => Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, input_schema: t.schema }))

// --- sensitive requests ---------------------------------------------------
// Decisions that change someone's pay, job or record, and sensitive personal
// data, are never handled by the assistant - whatever the role.

const SENSITIVE = [
  [/\b(salary|salaries|ctc|pay\s*(hike|raise|cut|revision)|increment|compensation|bonus)\b/i, 'Salary and compensation changes'],
  [/\b(terminat\w*|fire|firing|sack|dismiss\w*|let go|lay\s*off|layoff)\b/i, 'Terminations'],
  [/\b(disciplin\w*|warning letter|show cause|pip|performance improvement plan)\b/i, 'Disciplinary decisions'],
  [/\b(promot\w*|demot\w*)\b/i, 'Promotions and demotions'],
  [/\b(pan|aadhaar|aadhar|bank (account|details)|account number|ifsc|health record|passport number)\b/i, 'Sensitive personal data'],
]

/** A reason string when the request touches a sensitive area, else null. */
export function sensitiveTopic(text) {
  for (const [re, label] of SENSITIVE) if (re.test(text)) return label
  return null
}

export const SENSITIVE_REPLY = (label) =>
  label + ' are outside what I can do. They need explicit authorisation and a person to review them, so please use the HR process for this (or ask HR leadership).'
