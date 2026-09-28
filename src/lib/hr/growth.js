// Training, skills and confidential grievances. Shared by the app, the API
// server and the dashboards' alerts.

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
export const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)) }
const rnd = (seed) => { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return ((h >>> 0) % 1000) / 1000 }

// --- skills --------------------------------------------------------------------

// Required level (1-5) for each skill, by department. Everyone also needs the core.
const CORE = { 'Compliance (KYC/AML)': 3, Communication: 3 }
export const SKILL_REQUIREMENTS = {
  Engineering: { 'System design': 4, 'Cloud and DevOps': 3, 'Automated testing': 3 },
  Product: { 'Product discovery': 4, 'Data analysis': 3, 'Stakeholder management': 3 },
  'Credit & Risk': { 'Credit underwriting': 4, 'Data analysis': 3, 'Risk modelling': 3 },
  Sales: { 'Consultative selling': 4, 'Negotiation': 3, 'CRM hygiene': 3 },
  Collections: { 'Negotiation': 4, 'Regulatory conduct': 4, 'CRM hygiene': 3 },
  Operations: { 'Process excellence': 4, 'Data analysis': 3, 'Stakeholder management': 3 },
  Finance: { 'Financial reporting': 4, 'Excel and modelling': 4, 'Regulatory conduct': 3 },
  'Human Resources': { 'Employee relations': 4, 'Stakeholder management': 3, 'Data analysis': 3 },
  Marketing: { 'Digital marketing': 4, 'Data analysis': 3, 'Brand writing': 3 },
  'Legal & Compliance': { 'Regulatory conduct': 4, 'Contract drafting': 4, 'Stakeholder management': 3 },
}
export const requirementsFor = (department) => ({ ...(SKILL_REQUIREMENTS[department] || SKILL_REQUIREMENTS.Operations), ...CORE })

export const COURSE_MODES = ['Online', 'Classroom', 'Workshop']

export const SEED_COURSES = [
  { id: 'CR-101', title: 'KYC, AML and fraud awareness', skill: 'Compliance (KYC/AML)', hours: 3, mode: 'Online', mandatory: true, provider: 'FlexiLoans Academy' },
  { id: 'CR-102', title: 'Information security essentials', skill: 'Compliance (KYC/AML)', hours: 2, mode: 'Online', mandatory: true, provider: 'FlexiLoans Academy' },
  { id: 'CR-103', title: 'Writing and presenting with clarity', skill: 'Communication', hours: 6, mode: 'Workshop', mandatory: false, provider: 'Toastmasters Mumbai' },
  { id: 'CR-104', title: 'Designing distributed systems', skill: 'System design', hours: 12, mode: 'Online', mandatory: false, provider: 'Coursera' },
  { id: 'CR-105', title: 'AWS for application teams', skill: 'Cloud and DevOps', hours: 10, mode: 'Online', mandatory: false, provider: 'AWS Skill Builder' },
  { id: 'CR-106', title: 'SME credit underwriting masterclass', skill: 'Credit underwriting', hours: 8, mode: 'Classroom', mandatory: false, provider: 'CRISIL' },
  { id: 'CR-107', title: 'SQL and dashboards for business teams', skill: 'Data analysis', hours: 8, mode: 'Online', mandatory: false, provider: 'FlexiLoans Academy' },
  { id: 'CR-108', title: 'Consultative selling to MSMEs', skill: 'Consultative selling', hours: 6, mode: 'Workshop', mandatory: false, provider: 'Sales Academy' },
  { id: 'CR-109', title: 'Fair practices code and ethical recovery', skill: 'Regulatory conduct', hours: 4, mode: 'Online', mandatory: false, provider: 'FlexiLoans Academy' },
  { id: 'CR-110', title: 'Negotiation that keeps relationships', skill: 'Negotiation', hours: 6, mode: 'Workshop', mandatory: false, provider: 'Sales Academy' },
  { id: 'CR-111', title: 'Managing stakeholders across teams', skill: 'Stakeholder management', hours: 5, mode: 'Online', mandatory: false, provider: 'LinkedIn Learning' },
  { id: 'CR-112', title: 'Lean process improvement', skill: 'Process excellence', hours: 8, mode: 'Classroom', mandatory: false, provider: 'QAI India' },
]

/** Starting level for a skill: stable per person, a little below what the role needs. */
const baseLevel = (empId, skill, required) => Math.max(1, Math.min(5, required - 2 + Math.floor(rnd(empId + skill) * 3.2)))

/**
 * One person's skills against their role: [{ skill, required, level, gap, courses }].
 * Every completed course adds a level to its skill.
 */
export function skillProfile(emp, training) {
  const req = requirementsFor(emp.department)
  const done = (training?.enrollments || []).filter((e) => e.empId === emp.id && e.status === 'Completed')
  const courses = training?.courses || []
  return Object.entries(req).map(([skill, required]) => {
    const gained = done.filter((e) => courses.find((c) => c.id === e.courseId)?.skill === skill).length
    const level = Math.min(5, baseLevel(emp.id, skill, required) + gained)
    return { skill, required, level, gap: Math.max(0, required - level), courses: courses.filter((c) => c.skill === skill) }
  })
}

export function seedTraining(employees) {
  const enrollments = []
  let n = 5000
  for (const e of employees) {
    const add = (courseId, r, assignedBy = null, due = null) => {
      const status = r < 0.45 ? 'Completed' : r < 0.8 ? 'In progress' : 'Not started'
      const progress = status === 'Completed' ? 100 : status === 'In progress' ? 10 + Math.round(r * 60) : 0
      enrollments.push({ id: 'EN-' + ++n, courseId, empId: e.id, employee: e.name, status, progress, assignedBy, due,
        enrolledAt: '2026-0' + (4 + Math.floor(r * 5)) + '-1' + Math.floor(r * 9), completedAt: status === 'Completed' ? '2026-08-2' + Math.floor(r * 9) : null })
    }
    add('CR-101', rnd(e.id + 'kyc'), 'Aarti Deshmukh', '2026-10-15')
    const skills = Object.keys(requirementsFor(e.department))
    const pick = SEED_COURSES.find((c) => c.skill === skills[Math.floor(rnd(e.id + 'pick') * 3)] && !c.mandatory)
    if (pick && rnd(e.id + 'opt') < 0.55) add(pick.id, rnd(e.id + pick.id))
  }
  return { courses: SEED_COURSES, enrollments }
}

// --- grievances ------------------------------------------------------------------

export const GRIEVANCE_CATEGORIES = ['Harassment (POSH)', 'Discrimination', 'Manager conduct', 'Pay and benefits', 'Workplace safety', 'Policy violation', 'Other']
export const GRIEVANCE_SEVERITIES = ['Low', 'Medium', 'High', 'Critical']
export const GRIEVANCE_STATUSES = ['Submitted', 'Under investigation', 'Action taken', 'Closed']
export const SLA_DAYS = { Critical: 2, High: 5, Medium: 10, Low: 15 }
// POSH complaints always go to the Internal Committee and are never below High.
export const severityFor = (category, severity) => (category === 'Harassment (POSH)' && ['Low', 'Medium'].includes(severity) ? 'High' : severity)

/** { due, overdue, daysLeft, open } for a case on a given day. */
export function grievanceSla(g, today) {
  const due = addDays(g.created, SLA_DAYS[g.severity] || 10)
  const open = g.status !== 'Closed' && g.status !== 'Action taken'
  const daysLeft = Math.round((Date.parse(due) - Date.parse(today)) / 86400000)
  return { due, open, daysLeft, overdue: open && daysLeft < 0 }
}

export const SEED_GRIEVANCES = [
  { id: 'GR-1004', category: 'Manager conduct', severity: 'High', subject: 'Repeated public criticism in team meetings', description: 'My manager has criticised me in front of the whole team in three stand-ups this month. I would like this handled confidentially.',
    anonymous: false, raisedById: 'FL1015', created: '2026-09-18', status: 'Under investigation', assignedTo: 'Aarti Deshmukh',
    updates: [{ at: '2026-09-19T10:00:00.000Z', by: 'Aarti Deshmukh', note: 'Case acknowledged. I will speak with you on Monday.', internal: false }, { at: '2026-09-22T15:00:00.000Z', by: 'Aarti Deshmukh', note: 'Two team members confirm the pattern; scheduling a conversation with the manager.', internal: true }] },
  { id: 'GR-1003', category: 'Workplace safety', severity: 'Medium', subject: 'Fire exit blocked on the 4th floor', description: 'Boxes from the facilities move are blocking the east fire exit at Mumbai HQ.',
    anonymous: true, raisedById: 'FL1022', created: '2026-09-15', status: 'Submitted', assignedTo: null, updates: [] },
  { id: 'GR-1002', category: 'Pay and benefits', severity: 'Low', subject: 'Night shift allowance not paid for August', description: 'Collections night shift allowance is missing from my August payslip.',
    anonymous: false, raisedById: 'FL1031', created: '2026-09-02', status: 'Action taken', assignedTo: 'Aarti Deshmukh',
    updates: [{ at: '2026-09-05T11:00:00.000Z', by: 'Aarti Deshmukh', note: 'Payroll confirmed the miss; the arrears will be paid with September salary.', internal: false }] },
  { id: 'GR-1001', category: 'Harassment (POSH)', severity: 'Critical', subject: 'Inappropriate messages from a colleague', description: 'Details shared with the Internal Committee.',
    anonymous: true, raisedById: 'FL1040', created: '2026-09-23', status: 'Under investigation', assignedTo: 'Internal Committee',
    updates: [{ at: '2026-09-23T17:00:00.000Z', by: 'Aarti Deshmukh', note: 'Referred to the Internal Committee under the POSH Act.', internal: false }] },
]
