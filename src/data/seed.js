// Starting data for every collection in lib/actions.js COLLECTIONS.
// The offline demo loads it into the browser; the API server writes it to
// its database on first start.

import {
  employees, leaveRequests, tickets, announcements, documents, candidates, openings,
} from './mock.js'
import { computeRun } from '../lib/hr/payroll.js'
import { onboardingTasks, POLICIES, seedAppraisal } from '../lib/hr/people.js'
import { seedTraining, SEED_GRIEVANCES } from '../lib/hr/growth.js'

export const SEED_NOTIFICATIONS = [
  { id: 'n1', title: 'Leave request awaiting approval', detail: leaveRequests.find((r) => r.id === 'LV-2040').employee + ' applied for 1 day of Sick Leave', time: '12 min ago', to: '/leave', kind: 'leave', read: false },
  { id: 'n2', title: 'Reimbursement SLA breached', detail: 'HD-8822 has crossed its resolution window', time: '1 hour ago', to: '/helpdesk', kind: 'alert', read: false },
  { id: 'n3', title: 'Offer awaiting your sign-off', detail: 'Nilesh Bose - Area Sales Manager, Delhi NCR', time: '3 hours ago', to: '/recruitment', kind: 'task', read: false },
  { id: 'n4', title: 'September payroll is processing', detail: 'Payslips will be available on 30 September', time: 'Yesterday', to: '/payroll', kind: 'info', read: false },
  { id: 'n5', title: 'Self-assessment window opens 1 October', detail: 'Mid-year cycle FY 2026-27', time: '2 days ago', to: '/performance', kind: 'info', read: true },
  { id: 'n6', title: 'Address proof pending verification', detail: 'HR Ops will review it within 2 working days', time: '3 days ago', to: '/documents', kind: 'info', read: true },
]

const person = (id) => employees.find((e) => e.id === id)
const SEED_REGULARISATIONS = [
  { id: 'RG-1002', empId: 'FL1015', date: '2026-09-22', in: '09:55', out: '19:10', type: 'Missed punch', reason: 'Biometric reader at the Pune office was down in the morning', status: 'Pending', appliedOn: '2026-09-23' },
  { id: 'RG-1001', empId: 'FL1009', date: '2026-09-10', in: '09:48', out: '19:05', type: 'On duty / client visit', reason: 'Client workshop at the Andheri branch, no punch machine on site', status: 'Approved', appliedOn: '2026-09-11', decidedBy: 'Aarti Deshmukh' },
].map((r) => ({ ...r, employee: person(r.empId).name }))

// July and August 2026 are already paid; September is HR's to run.
const PAID_MONTHS = [['2026-07', '2026-07-31T12:00:00.000Z'], ['2026-08', '2026-08-31T12:00:00.000Z']]
const SEED_PAYROLL = PAID_MONTHS.reduce((acc, [month, at]) => {
  const { run, payslips } = computeRun(employees, month, { leaveRequests }, {}, 'Aarti Deshmukh')
  return { runs: [{ ...run, status: 'Paid', runAt: at, paidAt: at, paidBy: 'Aarti Deshmukh' }, ...acc.runs], payslips: [...acc.payslips, ...payslips] }
}, { runs: [], payslips: [] })

// Candidates carry their interview schedule and scorecards.
const iv = (round, at, interviewer, status = 'Completed', mode = 'Video call') => ({ id: 'iv-' + round.split(' ')[0].toLowerCase() + at.slice(5, 10), round, at, interviewer, mode, status, by: 'Aarti Deshmukh' })
const ev = (round, technical, communication, culture, recommendation, by, notes) => ({ round, technical, communication, culture, recommendation, by, notes, at: '2026-09-20T12:00:00.000Z' })
const PIPELINE = {
  'Aditya Malhotra': { interviews: [iv('Tech Screen', '2026-09-12T11:00', 'Rahul Patel'), iv('HR Round', '2026-09-18T15:00', 'Aarti Deshmukh'), iv('Final Round', '2026-10-01T16:00', 'Arjun Shaikh', 'Scheduled', 'In person')],
    evaluations: [ev('Tech Screen', 5, 4, 5, 'Strong hire', 'Rahul Patel', 'Deep distributed-systems experience; clean design round.'), ev('HR Round', 4, 5, 4, 'Hire', 'Aarti Deshmukh', 'Notice period 60 days, negotiable to 45.')] },
  'Kavya Menon': { interviews: [iv('Tech Screen', '2026-09-30T11:30', 'Karthik Chawla', 'Scheduled')], evaluations: [] },
  'Nilesh Bose': { interviews: [iv('Tech Screen', '2026-08-18T12:00', 'Rohan Malhotra'), iv('HR Round', '2026-08-22T15:00', 'Aarti Deshmukh'), iv('Final Round', '2026-08-28T17:00', 'Nilesh Shaikh', 'Completed', 'In person')],
    evaluations: [ev('Tech Screen', 5, 5, 4, 'Strong hire', 'Rohan Malhotra', 'Strong SME lending network in NCR.'), ev('HR Round', 5, 5, 5, 'Strong hire', 'Aarti Deshmukh', 'Expected CTC within band.'), ev('Final Round', 5, 4, 5, 'Strong hire', 'Nilesh Shaikh', 'Offer approved.')] },
  'Sanjana Khan': { interviews: [iv('Tech Screen', '2026-09-19T10:00', 'Shruti Sharma'), iv('HR Round', '2026-09-29T14:00', 'Aarti Deshmukh', 'Scheduled', 'Phone')],
    evaluations: [ev('Tech Screen', 4, 4, 4, 'Hire', 'Shruti Sharma', 'Good campaign portfolio; light on performance marketing.')] },
}
const SEED_CANDIDATES = candidates.map((c) => ({ status: 'Active', email: c.name.toLowerCase().replace(' ', '.') + '@mail.com', interviews: [], evaluations: [], ...c, ...PIPELINE[c.name] }))

// Onboarding for the latest joiners; the August joiner is done.
const onboard = (empId, n, doneUpTo, acks) => {
  const e = person(empId)
  const tasks = onboardingTasks(e.designation, e.department, e.joinDate).map((t, i) => (i < doneUpTo ? { ...t, done: true, doneBy: t.owner === 'New joiner' ? e.name : 'Aarti Deshmukh', doneAt: t.due + 'T12:00:00.000Z' } : t))
  const acknowledgements = POLICIES.slice(0, acks).map((policy) => ({ policy, at: e.joinDate + 'T10:30:00.000Z' }))
  const complete = tasks.every((t) => t.done) && acknowledgements.length === POLICIES.length
  return { id: 'OB-' + n, name: e.name, role: e.designation, department: e.department, startDate: e.joinDate, empId, candidate: null,
    tasks, policies: POLICIES, acknowledgements, status: complete ? 'Completed' : 'In progress', startedBy: 'Aarti Deshmukh', createdAt: e.joinDate + 'T09:00:00.000Z' }
}
const SEED_ONBOARDING = [onboard('FL1050', 1003, 7, 2), onboard('FL1005', 1002, 9, 4), onboard('FL1059', 1001, 99, 4)]

export const SEED = {
  employees,
  leaveRequests,
  tickets,
  announcements,
  candidates: SEED_CANDIDATES,
  requisitions: openings,
  regularisations: SEED_REGULARISATIONS,
  payroll: SEED_PAYROLL,
  onboarding: SEED_ONBOARDING,
  appraisals: employees.map(seedAppraisal),
  training: seedTraining(employees),
  grievances: SEED_GRIEVANCES.map((g) => ({ ...g, raisedBy: person(g.raisedById).name })),
  documents,
  notifications: SEED_NOTIFICATIONS,
  punch: { inAt: '09:34 AM', outAt: null },
}
