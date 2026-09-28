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
import { departments, locations, headcountTrend } from '../../data/mock.js'
import { balancesFor, checkBalance, LEAVE_TYPES, leaveDays, overlapping } from '../hr/leave.js'
import { employeeDay as baseDay, holidaySet, isWorkingDay } from '../hr/attendance.js'
import { TICKET_DESKS, needsAdminApproval, ticketClosed, CANDIDATE_STAGES } from '../actions.js'
import { monthLabel } from '../hr/payroll.js'
import { CYCLE_DATES, onboardingProgress } from '../hr/people.js'
import { skillProfile } from '../hr/growth.js'
import { companyHolidays } from '../../data/holidays.js'
import { searchPolicies } from './policies.js'

// --- helpers ------------------------------------------------------------

const lc = (s) => String(s ?? '').toLowerCase().trim()
const can = (ctx, perm) => ctx.actor.perms.includes(perm)
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

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

// Attendance comes from the shared model (src/lib/hr/attendance.js); the
// signed-in person's real punches replace their derived days.
const dayCtx = (ctx) => ({ leaveRequests: ctx.state.leaveRequests, today: ctx.today, nowMin: ctx.nowMin, self: { id: ctx.actor.id, punch: ctx.state.punch } })
export const employeeDay = (emp, date, ctx) => baseDay(emp, date, dayCtx(ctx))

// --- tool definitions -----------------------------------------------------
// `schema` is the JSON Schema Claude sees; `run(input, ctx)` does the work.

const str = (description) => ({ type: 'string', description })
const INR = (n) => 'Rs ' + Math.round(n).toLocaleString('en-IN')
const myPayslips = (ctx) => (ctx.state.payroll?.payslips || []).filter((p) => p.empId === ctx.actor.id).sort((a, b) => b.month.localeCompare(a.month))
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
    schema: obj({ employee: str('Employee name or id; omit for yourself'), type: { type: 'string', enum: LEAVE_TYPES, description: 'One leave type, when the question is about one' } }),
    run(input, ctx) {
      let who = ctx.actor
      if (input.employee && findPeople([ctx.actor], input.employee).length === 0) {
        if (!can(ctx, PERMS.HR_PEOPLE)) deny('You can only see your own leave balance.')
        const found = findPeople(ctx.state.employees, input.employee)
        if (!found.length) deny('No employee matches "' + input.employee + '".')
        who = found[0]
      }
      const rows = balancesFor(who.id, ctx.state.leaveRequests, Number(ctx.today.slice(0, 4)))
        .map((l) => ({ type: l.type, granted: l.unlimited ? 'no limit' : l.granted, used: l.used, pending: l.pending, balance: l.unlimited ? 'no limit' : l.balance }))
      const self = who.id === ctx.actor.id
      who = who.name
      const one = input.type && rows.find((r) => r.type === pick(LEAVE_TYPES, input.type))
      const asked = one && { ...one, available: one.balance === 'no limit' ? 'no limit' : Math.max(0, one.balance - one.pending) }
      return { data: { employee: who, self, balances: rows, ...(asked ? { asked } : {}) }, card: { kind: 'table', title: 'Leave balance - ' + who, columns: ['type', 'granted', 'used', 'pending', 'balance'], rows } }
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

  // --- employee self-service ---------------------------------------------

  search_policies: {
    description: 'Search the HR knowledge base (policies, handbook, FAQs): leave rules, work from home, attendance, holidays, payroll and deductions, tax, insurance and benefits, reimbursements, conduct, POSH, IT security, performance cycle, learning, onboarding documents, profile changes, resignation and notice period, and how to get help. Answer policy questions only from what this returns and name the policy you used. If nothing relevant comes back, say you do not know and offer to raise an HR ticket.',
    schema: obj({ query: str('The question or topic, e.g. "work from home policy"') }, ['query']),
    run(input) {
      const hits = searchPolicies(input.query)
      if (!hits.length) return { data: { found: 0, advice: 'Nothing in the knowledge base covers this. Do not guess; offer to create an HR ticket.' }, card: { kind: 'note', text: 'No policy covers "' + input.query + '". I can raise a ticket with HR for you.' } }
      return {
        data: { found: hits.length, articles: hits.map(({ id, title, category, updated, body }) => ({ id, title, category, updated, text: body })) },
        card: { kind: 'policy', rows: hits.slice(0, 2).map(({ id, title, category, updated, body }) => ({ id, title, category, updated, body })) },
      }
    },
  },

  my_payslips: {
    description: 'The signed-in person\'s own released payslips: month, paid days, loss-of-pay days, gross, deductions and net, with links to view and download each one. Only ever the person\'s own pay.',
    schema: obj({ month: str('YYYY-MM for one month; omit for the latest few') }),
    run(input, ctx) {
      let list = myPayslips(ctx)
      if (input.month) list = list.filter((p) => p.month === input.month)
      if (!list.length) return { data: { found: 0, note: input.month ? 'No released payslip for ' + input.month + '. Payslips appear once payroll is marked paid, on the last working day.' : 'No payslips released yet.' }, card: { kind: 'note', text: 'No released payslip' + (input.month ? ' for ' + monthLabel(input.month) : '') + ' yet. Payslips appear once payroll is marked paid.' } }
      const rows = list.slice(0, 6).map((p) => ({ id: p.id, month: monthLabel(p.month), paidDays: p.paidDays, lopDays: p.lopDays, gross: INR(p.gross), deductions: INR(p.totalDeductions), net: INR(p.net) }))
      return {
        data: { payslips: rows, how_to_download: 'Open Payroll > My payslips > View, then Print or save PDF - or use the links on the card.' },
        card: { kind: 'links', title: 'Your payslips', rows: rows.map((r) => ({ label: r.month + ' - net ' + r.net, detail: 'Gross ' + r.gross + ', deductions ' + r.deductions + (r.lopDays ? ', ' + r.lopDays + ' LOP day' + (r.lopDays > 1 ? 's' : '') : ''), to: '/payroll?payslip=' + r.id, action: 'View and download' })) },
      }
    },
  },

  explain_payslip: {
    description: 'Explain the signed-in person\'s own payslip for a month compared with the month before: which earnings and deductions changed and why (loss of pay, overtime, bonus, PF, ESI, TDS). Use for "why is my salary or deduction different this month". Only the person\'s own pay.',
    schema: obj({ month: str('YYYY-MM; omit for the latest released payslip') }),
    run(input, ctx) {
      const list = myPayslips(ctx)
      const i = input.month ? list.findIndex((p) => p.month === input.month) : 0
      const cur = list[i]
      if (!cur) return { data: { found: 0, note: 'That payslip is not released yet; payslips appear once payroll is marked paid. The latest released one is ' + (list[0] ? list[0].month : 'none') + '.' }, card: { kind: 'note', text: input.month ? monthLabel(input.month) + ' is not released yet. Your latest payslip is ' + (list[0] ? monthLabel(list[0].month) : 'not available') + '.' : 'No payslips released yet.' } }
      const prev = list[i + 1]
      const heads = (p, k) => Object.fromEntries((p?.[k] || []).map((x) => [x.head.replace(/ \(.*\)$/, ''), x.amount]))
      const diff = (k) => {
        const a = heads(prev, k); const b = heads(cur, k)
        return [...new Set([...Object.keys(a), ...Object.keys(b)])].map((h) => ({ head: h, before: a[h] || 0, now: b[h] || 0, change: (b[h] || 0) - (a[h] || 0) })).filter((r) => r.change)
      }
      const earn = diff('earnings'); const ded = diff('deductions')
      const reasons = []
      if (prev && cur.lopDays !== prev.lopDays) reasons.push(cur.lopDays > prev.lopDays ? cur.lopDays + ' loss-of-pay day' + (cur.lopDays > 1 ? 's' : '') + ' reduced fixed pay (unapproved absence or leave without pay)' : 'fewer loss-of-pay days than last month')
      if (earn.some((r) => r.head === 'Bonus' && r.change > 0)) reasons.push('a bonus was paid, which also raises the income tax (TDS) estimate')
      if (earn.some((r) => r.head === 'Overtime' && r.change)) reasons.push('overtime pay changed')
      if (ded.some((r) => r.head.startsWith('Income Tax') && r.change)) reasons.push('TDS is re-estimated every month from projected annual income')
      if (ded.some((r) => r.head.startsWith('Provident') && r.change)) reasons.push('PF is 12% of the Basic earned that month (capped at 1,800), so it moves with loss-of-pay days')
      const rows = [...earn.map((r) => ({ type: 'Earning', ...r })), ...ded.map((r) => ({ type: 'Deduction', ...r }))].map((r) => ({ ...r, before: INR(r.before), now: INR(r.now), change: (r.change > 0 ? '+' : '-') + INR(Math.abs(r.change)).slice(3) }))
      return {
        data: { month: cur.month, not_current: !input.month && cur.month !== ctx.today.slice(0, 7), compared_with: prev?.month || null, gross: cur.gross, deductions: cur.totalDeductions, net: cur.net, previous: prev ? { gross: prev.gross, deductions: prev.totalDeductions, net: prev.net } : null, lop_days: cur.lopDays, changes: rows, reasons, deduction_lines: cur.deductions },
        card: { kind: 'table', title: monthLabel(cur.month) + (prev ? ' vs ' + monthLabel(prev.month) : '') + ' - net ' + INR(cur.net) + (prev ? ' (' + (cur.net >= prev.net ? '+' : '-') + INR(Math.abs(cur.net - prev.net)).slice(3) + ')' : ''), columns: ['type', 'head', 'before', 'now', 'change'], rows: rows.length ? rows : [{ type: '--', head: 'No change from last month', before: '', now: '', change: '' }] },
      }
    },
  },

  holidays: {
    description: 'Company holiday calendar: fixed holidays (office closed) and optional/restricted holidays, for a year or just the upcoming ones.',
    schema: obj({ year: { type: 'integer' }, upcoming_only: { type: 'boolean' }, include_optional: { type: 'boolean' } }),
    run(input, ctx) {
      const year = String(input.year || ctx.today.slice(0, 4))
      let list = companyHolidays.filter((h) => h.date.startsWith(year))
      if (input.upcoming_only) list = list.filter((h) => h.date >= ctx.today)
      if (!input.include_optional) list = list.filter((h) => !h.optional)
      const rows = list.map((h) => ({ date: h.date, day: parseISO(h.date).toLocaleDateString('en-IN', { weekday: 'short' }), name: h.name, type: h.optional ? 'Optional' + (h.scope ? ' (' + h.scope + ')' : '') : 'Holiday' }))
      const next = companyHolidays.find((h) => !h.optional && h.date >= ctx.today)
      return { data: { year, count: rows.length, next_holiday: next ? next.name + ' on ' + next.date : null, holidays: rows }, card: { kind: 'table', title: (input.upcoming_only ? 'Upcoming ' : '') + (input.include_optional ? 'holidays and optional holidays ' : 'company holidays ') + year, columns: ['date', 'day', 'name', 'type'], rows, csv: 'holidays-' + year } }
    },
  },

  my_performance: {
    description: 'The signed-in person\'s own appraisal for the current cycle: stage, deadlines (self review, manager review), goals with weights and progress, and past ratings. Use for "when is my performance review".',
    schema: obj({}),
    run(_input, ctx) {
      const a = (ctx.state.appraisals || []).find((x) => x.empId === ctx.actor.id)
      if (!a) return { data: { found: 0 }, card: { kind: 'note', text: 'No appraisal is open for you this cycle.' } }
      const next = a.status === 'Goal setting' || a.status === 'Self review' ? 'Submit your self review by ' + CYCLE_DATES.selfReviewCloses
        : a.status === 'Manager review' ? 'Your manager review is due by ' + CYCLE_DATES.managerReviewDue : 'This cycle is complete'
      const rows = a.goals.map((g) => ({ goal: g.title, weight: g.weight + '%', progress: g.progress + '%', due: g.due }))
      return {
        data: { cycle: a.cycle, stage: a.status, next_step: next, deadlines: CYCLE_DATES, goals: rows, final_rating: a.manager?.rating ?? null, history: a.history },
        card: { kind: 'links', title: a.cycle + ' - ' + a.status, rows: [{ label: next, detail: rows.length + ' goals, ' + Math.round(a.goals.reduce((s, g) => s + g.progress * g.weight, 0) / 100) + '% weighted progress', to: '/performance', action: 'Open Performance' }] },
      }
    },
  },

  my_learning: {
    description: 'The signed-in person\'s own training: enrolled and assigned courses with progress and due dates, and skill gaps against their role with recommended courses.',
    schema: obj({}),
    run(_input, ctx) {
      const t = ctx.state.training || { courses: [], enrollments: [] }
      const title = (id) => t.courses.find((c) => c.id === id)?.title || id
      const mine = t.enrollments.filter((e) => e.empId === ctx.actor.id).map((e) => ({ course: title(e.courseId), status: e.status, progress: e.progress + '%', due: e.due || '--' }))
      const me = ctx.state.employees.find((e) => e.id === ctx.actor.id) || ctx.actor
      const gaps = skillProfile(me, t).filter((s) => s.gap > 0).map((s) => ({ skill: s.skill, level: s.level, required: s.required, courses: s.courses.map((c) => c.id + ' ' + c.title) }))
      return { data: { enrolments: mine, skill_gaps: gaps }, card: { kind: 'table', title: 'Your learning - ' + mine.length + ' course' + (mine.length === 1 ? '' : 's') + ', ' + gaps.length + ' skill gap' + (gaps.length === 1 ? '' : 's'), columns: ['course', 'status', 'progress', 'due'], rows: mine } }
    },
  },

  my_onboarding: {
    description: 'The signed-in person\'s own onboarding: checklist tasks still open (theirs and other teams\'), policies still to acknowledge, and documents submitted or pending verification.',
    schema: obj({}),
    run(_input, ctx) {
      const rec = (ctx.state.onboarding || []).find((r) => r.empId === ctx.actor.id)
      const docs = (ctx.state.documents || []).map((d) => ({ name: d.name, category: d.category, status: d.status }))
      if (!rec) return { data: { onboarding: null, documents: docs }, card: docs.length ? { kind: 'table', title: 'Your documents', columns: ['name', 'category', 'status'], rows: docs } : { kind: 'note', text: 'You have no onboarding in progress.' } }
      const p = onboardingProgress(rec)
      const open = rec.tasks.filter((x) => !x.done).map((x) => ({ owner: x.owner, task: x.task, due: x.due }))
      const acked = new Set((rec.acknowledgements || []).map((a) => a.policy))
      return {
        data: { status: rec.status, progress: p, open_tasks: open, policies_to_acknowledge: (rec.policies || []).filter((x) => !acked.has(x)), documents: docs },
        card: { kind: 'checklist', title: 'Your onboarding - ' + p.done + ' of ' + p.total + ' done', rows: open },
      }
    },
  },

  propose_ticket: {
    write: true,
    description: 'Prepare a support ticket for the signed-in person - HR records, payroll, benefits, IT or finance. Use it for problems, requests, or questions the knowledge base cannot answer. Does not act - they must confirm.',
    schema: obj({
      category: { type: 'string', enum: Object.keys(TICKET_DESKS) },
      subject: str('One line describing the problem'),
      priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
    }, ['category', 'subject']),
    run(input) {
      const category = pick(Object.keys(TICKET_DESKS), input.category) || 'HR Records'
      const subject = String(input.subject || '').trim().slice(0, 160)
      if (subject.length < 4) deny('What is the problem? I need a short description for the ticket.')
      const priority = ['Low', 'Medium', 'High'].includes(input.priority) ? input.priority : 'Medium'
      const desk = TICKET_DESKS[category].desk
      return proposal({ type: 'ticket.add', payload: { ticket: { subject, category, priority } },
        summary: 'Raise a ' + category + ' ticket: "' + subject + '"', detail: 'Goes to the ' + desk + ' with ' + priority.toLowerCase() + ' priority' + (needsAdminApproval(category) ? ' (handled by the ' + TICKET_DESKS[category].team + ' team)' : '') + '. You will be notified of updates.', tone: 'blue' })
    },
  },

  propose_profile_update: {
    write: true,
    description: 'Prepare an update to the signed-in person\'s own personal mobile number or emergency contact (name, number, relationship). Does not act - they must confirm. Address, name and bank changes need proof: use propose_ticket (HR Records) for those.',
    schema: obj({
      personal_mobile: str('New personal mobile number'),
      emergency_contact_name: str('Emergency contact name'),
      emergency_contact_phone: str('Emergency contact number'),
      emergency_contact_relationship: str('Relationship, e.g. Spouse, Father'),
    }),
    run(input, ctx) {
      const phoneOk = (v) => /^\+?[0-9][0-9 -]{8,15}$/.test(String(v || '').trim())
      const me = ctx.state.employees.find((e) => e.id === ctx.actor.id) || {}
      const payload = {}
      const lines = []
      if (input.personal_mobile) {
        if (!phoneOk(input.personal_mobile)) deny('"' + input.personal_mobile + '" does not look like a phone number.')
        payload.personalPhone = input.personal_mobile.trim()
        lines.push('personal mobile to ' + payload.personalPhone)
      }
      if (input.emergency_contact_name || input.emergency_contact_phone || input.emergency_contact_relationship) {
        if (input.emergency_contact_phone && !phoneOk(input.emergency_contact_phone)) deny('"' + input.emergency_contact_phone + '" does not look like a phone number.')
        const prev = me.emergencyContact || {}
        const c = { name: input.emergency_contact_name || prev.name, phone: input.emergency_contact_phone?.trim() || prev.phone, relationship: input.emergency_contact_relationship || prev.relationship }
        if (!c.name) deny('Who is the emergency contact? I need their name.')
        if (!c.phone) deny('What is the emergency contact\'s phone number?')
        payload.emergencyContact = c
        lines.push('emergency contact to ' + c.name + (c.relationship ? ' (' + c.relationship + ')' : '') + ', ' + c.phone)
      }
      if (!lines.length) deny('What should I change? I can update your personal mobile number or your emergency contact.')
      return proposal({ type: 'profile.update', payload, summary: 'Update your ' + lines.join(' and '), detail: 'Changes your own HRMS record. Only you and HR can see these details.', tone: 'blue' })
    },
  },

  propose_course_enrollment: {
    write: true,
    description: 'Prepare enrolling the signed-in person in a course from the learning catalogue. Does not act - they must confirm.',
    schema: obj({ course: str('Course id (e.g. CR-107) or title words') }, ['course']),
    run(input, ctx) {
      const t = ctx.state.training || { courses: [], enrollments: [] }
      const q = lc(input.course)
      const c = t.courses.find((x) => lc(x.id) === q) || t.courses.find((x) => lc(x.title).includes(q)) || t.courses.find((x) => lc(x.skill).includes(q))
      if (!c) deny('No course matches "' + input.course + '". Ask me what is in the catalogue or open Learning.')
      if (t.enrollments.some((e) => e.empId === ctx.actor.id && e.courseId === c.id)) deny('You are already enrolled in ' + c.title + '.')
      return proposal({ type: 'course.enroll', payload: { courseId: c.id }, summary: 'Enrol in ' + c.title, detail: c.hours + ' h, ' + c.mode + ', ' + c.provider + '. Builds ' + c.skill + '.', tone: 'green' })
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
    description: 'Prepare a leave application for the signed-in person. It checks the balance, the work calendar (weekends and holidays are not counted) and clashes with existing leave. If the leave type or reason is missing it returns an error - ask the person for them instead of guessing. Does not act - they must confirm. Dates are YYYY-MM-DD.',
    schema: obj({ type: { type: 'string', enum: LEAVE_TYPES }, from: str('Start date YYYY-MM-DD'), to: str('End date YYYY-MM-DD; same as from for one day'), reason: str('Reason') }, ['from']),
    run(input, ctx) {
      const to = input.to || input.from
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to)) deny('I need the dates as YYYY-MM-DD.')
      if (to < input.from) deny('The end date is before the start date.')
      if (input.from < ctx.today && !/sick|casual/i.test(input.type || '')) deny('Planned leave cannot start in the past. For a sick day already taken, choose Casual Or Sick Leave.')
      const days = leaveDays(input.from, to)
      const range = input.from + (to !== input.from ? ' to ' + to : '')
      if (!days) {
        const h = companyHolidays.find((x) => x.date === input.from && !x.optional)
        deny(input.from === to ? input.from + ' is ' + (h ? h.name + ', a company holiday' : 'a weekend') + ' - no leave is needed.' : 'Every day from ' + range + ' is a weekend or holiday - no leave is needed.')
      }
      const clash = overlapping(ctx.actor.id, input.from, to, ctx.state.leaveRequests)
      if (clash) deny('You already have ' + clash.status.toLowerCase() + ' leave ' + clash.id + ' from ' + clash.from + ' to ' + clash.to + '.')
      const balances = balancesFor(ctx.actor.id, ctx.state.leaveRequests, Number(input.from.slice(0, 4))).filter((b) => b.unlimited || b.balance - b.pending > 0)
      const type = input.type && pick(LEAVE_TYPES, input.type)
      if (!type) deny('Which type of leave for ' + range + ' (' + days + ' working day' + (days > 1 ? 's' : '') + ')? Available: ' + balances.map((b) => b.type + (b.unlimited ? '' : ' (' + (b.balance - b.pending) + ' left)')).join(', ') + '. And what is the reason?')
      if (!String(input.reason || '').trim()) deny('What is the reason for the ' + type + ' on ' + range + '? It goes to HR with the request.')
      const balance = checkBalance(ctx.actor.id, type, days, ctx.state.leaveRequests, Number(input.from.slice(0, 4)))
      if (!balance.ok) deny(balance.message)
      const skipped = []
      for (let d = parseISO(input.from); ymd(d) <= to; d.setDate(d.getDate() + 1)) if (!isWorkingDay(ymd(d))) skipped.push(ymd(d))
      const left = balance.available === Infinity ? null : balance.available - days
      return proposal({ type: 'leave.add', payload: { request: { type, from: input.from, to, days, reason: input.reason.trim(), employee: ctx.actor.name, empId: ctx.actor.id } },
        summary: 'Apply for ' + days + ' day' + (days > 1 ? 's' : '') + ' of ' + type + ' (' + range + ')',
        detail: 'Reason: ' + input.reason.trim() + '. ' + (skipped.length ? skipped.length + ' weekend or holiday day' + (skipped.length > 1 ? 's are' : ' is') + ' not counted. ' : '') + (left != null ? left + ' day' + (left === 1 ? '' : 's') + ' will be left. ' : '') + 'Goes to HR for approval; you will be notified of the decision.', tone: 'blue' })
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
  // Changing anyone's pay, or looking at someone else's. Questions about your
  // own payslip ("why is my deduction higher?") are fine.
  [/\b(salary|salaries|ctc|pay|compensation|bonus|wage)s?\s*(hike|raise|cut|revision|increase|increment|change|correction)\b|\b(increase|raise|revise|cut|reduce|change|update|set|modify|double|approve)\b[^.?!]{0,40}\b(salary|salaries|ctc|compensation|bonus|pay)\b|\bincrement\b/i, 'Salary and compensation changes'],
  [/\b(?!my\b|me\b)[a-z]+'s\s+(salary|ctc|pay\s*slip|payslip|compensation|bonus)\b|\b(salary|ctc|payslip|compensation)\s+(of|for)\s+(?!me\b|my\b)[a-z]+|\b(everyone|all|team|department|employees)('s)?\s+(salar|ctc|pay)/i, 'Other people\'s salaries'],
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
