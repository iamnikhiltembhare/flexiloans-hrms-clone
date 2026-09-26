// Starting data for every collection in lib/actions.js COLLECTIONS.
// The offline demo loads it into the browser; the API server writes it to
// its database on first start.

import {
  employees, leaveRequests, tickets, announcements, documents, candidates, openings,
} from './mock.js'

export const SEED_NOTIFICATIONS = [
  { id: 'n1', title: 'Leave request awaiting approval', detail: 'Sneha Iyer applied for 1 day of Sick Leave', time: '12 min ago', to: '/leave', kind: 'leave', read: false },
  { id: 'n2', title: 'Reimbursement SLA breached', detail: 'HD-8822 has crossed its resolution window', time: '1 hour ago', to: '/helpdesk', kind: 'alert', read: false },
  { id: 'n3', title: 'Offer awaiting your sign-off', detail: 'Nilesh Bose - Area Sales Manager, Delhi NCR', time: '3 hours ago', to: '/recruitment', kind: 'task', read: false },
  { id: 'n4', title: 'September payroll is processing', detail: 'Payslips will be available on 30 September', time: 'Yesterday', to: '/payroll', kind: 'info', read: false },
  { id: 'n5', title: 'Self-assessment window opens 1 October', detail: 'Mid-year cycle FY 2026-27', time: '2 days ago', to: '/performance', kind: 'info', read: true },
  { id: 'n6', title: 'Address proof pending verification', detail: 'HR Ops will review it within 2 working days', time: '3 days ago', to: '/documents', kind: 'info', read: true },
]

export const SEED = {
  employees,
  leaveRequests,
  tickets,
  announcements,
  candidates,
  requisitions: openings,
  documents,
  notifications: SEED_NOTIFICATIONS,
  punch: { inAt: '09:34 AM', outAt: null },
}
