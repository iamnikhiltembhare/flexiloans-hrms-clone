// Templates and seed builders for recruitment, onboarding and appraisals.
// Shared by the app, the API server and the HR Assistant.

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)) }
const rnd = (seed) => { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return ((h >>> 0) % 1000) / 1000 }

// --- recruitment ------------------------------------------------------------

export const INTERVIEW_ROUNDS = ['Tech Screen', 'HR Round', 'Final Round']
export const INTERVIEW_MODES = ['Video call', 'In person', 'Phone']
export const RECOMMENDATIONS = ['Strong hire', 'Hire', 'Hold', 'No hire']
export const CANDIDATE_SOURCES = ['Referral', 'LinkedIn', 'Naukri', 'Careers Page', 'Walk-in', 'Agency']

/** Average of every evaluation's three scores, one decimal. */
export function candidateRating(evaluations = []) {
  const scores = evaluations.flatMap((e) => [e.technical, e.communication, e.culture]).filter(Number.isFinite)
  return scores.length ? +(scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : null
}

// --- onboarding --------------------------------------------------------------

export const POLICIES = ['Code of conduct', 'POSH policy', 'Information security and acceptable use', 'Leave and attendance policy']

/** Checklist for a new joiner: [{ id, owner, task, due }] relative to the start date. */
export function onboardingTasks(role, department, start) {
  const tech = /engineer|developer|devops|qa|data|designer/i.test(role || '')
  const sales = /sales|relationship|collection/i.test(role || '')
  const list = [
    ['HR', 'Send offer acceptance and joining instructions', -7],
    ['HR', 'Collect documents: PAN, Aadhaar, address proof, relieving letter', -3],
    ['Finance', 'Set up payroll, bank account and tax declaration', -2],
    ['IT', tech ? 'Laptop with developer image, VPN, GitHub and Jira access' : 'Laptop, email and HRMS access', -2],
    ['Admin', 'Access card and seat' + (department ? ' in the ' + department + ' bay' : ''), -1],
    ['Manager', 'Share a 30-60-90 day plan and assign a buddy', 0],
    ['HR', 'Day 1 induction: policies, POSH, code of conduct', 0],
    ['New joiner', 'Complete your profile and nominations in the HRMS', 2],
    ...(tech ? [['Manager', 'Walk through architecture, codebase and on-call process', 3], ['IT', 'Grant staging and production read access after security training', 5]] : []),
    ...(sales ? [['Manager', 'Product and credit policy training; CRM access', 3], ['Admin', 'Visiting cards and field travel policy briefing', 5]] : []),
    ['New joiner', 'Complete mandatory compliance training (KYC, AML, information security)', 7],
    ['HR', '30-day check-in with the new joiner and manager', 30],
  ]
  return list.map(([owner, task, day], i) => ({ id: 't' + (i + 1), owner, task, due: addDays(start, day), done: false }))
}

export function onboardingProgress(rec) {
  const total = rec.tasks.length + POLICIES.length
  const done = rec.tasks.filter((t) => t.done).length + (rec.acknowledgements || []).length
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}

// --- appraisals ----------------------------------------------------------------

export const CYCLE = 'Mid-year FY 2026-27'
// Deadlines for the current cycle, shown in the app and by the HR Assistant.
export const CYCLE_DATES = { goalsDue: '2026-09-30', selfReviewCloses: '2026-10-12', managerReviewDue: '2026-10-24' }
export const COMPETENCIES = ['Customer focus', 'Execution', 'Collaboration', 'Ownership', 'Communication']
export const APPRAISAL_STAGES = ['Goal setting', 'Self review', 'Manager review', 'Completed']

const GOALS = {
  Engineering: ['Ship the merchant cash-advance journey v2', 'Cut p95 API latency below 300 ms', 'Raise automated test coverage to 80%'],
  Product: ['Launch partner API self-serve sandbox', 'Reduce application drop-off below 18%', 'Run two customer discovery sprints'],
  'Credit & Risk': ['Keep 30+ DPD under 3.5% for new cohorts', 'Automate bureau pull for 90% of files', 'Complete advanced credit-risk certification'],
  Sales: ['Disburse INR 12 Cr this half', 'Onboard 40 new merchant partners', 'Keep cost per acquisition within budget'],
  Collections: ['Recover 85% of 1-30 DPD accounts', 'Resolve disputes within 7 days', 'Complete soft-skills recovery training'],
  Operations: ['Hold turnaround time under 24 hours', 'Cut manual rework by 30%', 'Document three core SOPs'],
  Finance: ['Close books by day 5 each month', 'Automate vendor reconciliation', 'Zero audit observations this half'],
  'Human Resources': ['Fill 90% of requisitions within 45 days', 'Lift engagement score by 5 points', 'Launch the manager training programme'],
  Marketing: ['Grow organic leads by 25%', 'Launch the festive campaign on time', 'Bring cost per lead under INR 400'],
  'Legal & Compliance': ['Close all RBI observations', 'Train 100% of staff on AML', 'Review every partner agreement'],
}

/** A seed appraisal for one person in the current cycle. */
export function seedAppraisal(emp) {
  const titles = GOALS[emp.department] || GOALS.Operations
  const weights = [40, 35, 25]
  const goals = titles.map((title, i) => ({
    id: 'g' + (i + 1), title, weight: weights[i], due: '2026-12-' + (15 + i * 5),
    progress: Math.round(20 + rnd(emp.id + title) * 70),
  }))
  const r = rnd(emp.id + 'stage')
  const status = r < 0.55 ? 'Self review' : r < 0.85 ? 'Manager review' : 'Goal setting'
  const self = status === 'Manager review'
    ? { rating: +(3 + rnd(emp.id + 'self') * 1.8).toFixed(1), comments: 'Delivered my main goals; want to grow in stakeholder management.', at: '2026-09-20T10:00:00.000Z',
      competencies: Object.fromEntries(COMPETENCIES.map((c) => [c, Math.round(3 + rnd(emp.id + c) * 2)])) }
    : null
  const past = (label, seed) => ({ cycle: label, rating: +(2.6 + rnd(emp.id + seed) * 2.2).toFixed(1) })
  return {
    id: 'AP-' + emp.id, empId: emp.id, employee: emp.name, department: emp.department, designation: emp.designation,
    cycle: CYCLE, status, goals, self, manager: null,
    history: [past('Year-end FY 2025-26', 'y26'), past('Year-end FY 2024-25', 'y25')],
  }
}

export const RATING_LABEL = (r) => (r == null ? '--' : r >= 4.5 ? 'Outstanding' : r >= 3.8 ? 'Exceeds' : r >= 3 ? 'Meets' : r >= 2.3 ? 'Partly meets' : 'Below')
