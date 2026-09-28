// Starting data for every collection in lib/actions.js COLLECTIONS.
// The offline demo loads it into the browser; the API server writes it to
// its database on first start.

import {
  employees, leaveRequests, tickets, announcements, documents, candidates, openings,
} from './mock.js'
import { computeRun } from '../lib/hr/payroll.js'

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

export const SEED = {
  employees,
  leaveRequests,
  tickets,
  announcements,
  candidates,
  requisitions: openings,
  regularisations: SEED_REGULARISATIONS,
  payroll: SEED_PAYROLL,
  documents,
  notifications: SEED_NOTIFICATIONS,
  punch: { inAt: '09:34 AM', outAt: null },
}
