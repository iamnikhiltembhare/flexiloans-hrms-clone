import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import ToastStack from '../components/Toast.jsx'
import {
  employees as seedEmployees, leaveRequests as seedLeave, tickets as seedTickets,
  announcements as seedAnnouncements, documents as seedDocuments, candidates as seedCandidates,
  openings as seedOpenings,
} from '../data/mock.js'

const DataContext = createContext(null)

const SEED_NOTIFICATIONS = [
  { id: 'n1', title: 'Leave request awaiting approval', detail: 'Sneha Iyer applied for 1 day of Sick Leave', time: '12 min ago', to: '/leave', kind: 'leave', read: false },
  { id: 'n2', title: 'Reimbursement SLA breached', detail: 'HD-8822 has crossed its resolution window', time: '1 hour ago', to: '/helpdesk', kind: 'alert', read: false },
  { id: 'n3', title: 'Offer awaiting your sign-off', detail: 'Nilesh Bose - Area Sales Manager, Delhi NCR', time: '3 hours ago', to: '/recruitment', kind: 'task', read: false },
  { id: 'n4', title: 'September payroll is processing', detail: 'Payslips will be available on 30 September', time: 'Yesterday', to: '/payroll', kind: 'info', read: false },
  { id: 'n5', title: 'Self-assessment window opens 1 October', detail: 'Mid-year cycle FY 2026-27', time: '2 days ago', to: '/performance', kind: 'info', read: true },
  { id: 'n6', title: 'Address proof pending verification', detail: 'HR Ops will review it within 2 working days', time: '3 days ago', to: '/documents', kind: 'info', read: true },
]

let seq = 100
const nextId = (prefix) => prefix + ++seq

export function DataProvider({ children }) {
  const [employees, setEmployees] = useState(seedEmployees)
  const [leaveRequests, setLeaveRequests] = useState(seedLeave)
  const [tickets, setTickets] = useState(seedTickets)
  const [announcements, setAnnouncements] = useState(seedAnnouncements)
  const [documents, setDocuments] = useState(seedDocuments)
  const [candidates, setCandidates] = useState(seedCandidates)
  const [openings] = useState(seedOpenings)
  const [notifications, setNotifications] = useState(SEED_NOTIFICATIONS)
  const [toasts, setToasts] = useState([])
  const [punch, setPunch] = useState({ inAt: '09:34 AM', outAt: null })

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback((title, detail, kind = 'success') => {
    const id = nextId('t')
    setToasts((t) => [...t, { id, title, detail, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const notify = useCallback((n) => {
    setNotifications((list) => [{ id: nextId('n'), time: 'Just now', read: false, kind: 'info', ...n }, ...list])
  }, [])

  const markRead = useCallback((id) => {
    setNotifications((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])
  const markAllRead = useCallback(() => setNotifications((l) => l.map((n) => ({ ...n, read: true }))), [])
  const clearNotifications = useCallback(() => setNotifications([]), [])

  const addEmployee = useCallback((emp) => {
    setEmployees((list) => [{
      id: 'FL' + (1001 + list.length),
      status: 'Probation', experience: '0 yrs', employmentType: 'Permanent',
      manager: 'Aarti Deshmukh', joinDate: new Date().toISOString().slice(0, 10),
      ...emp,
    }, ...list])
  }, [])

  const addTicket = useCallback((t) => {
    const id = 'HD-' + (8842 + Math.floor(Math.random() * 40))
    setTickets((list) => [{
      id, status: 'Open', sla: '8h left', assignee: 'HR Ops',
      raisedBy: 'Nikhil Tembhare', created: new Date().toISOString().slice(0, 10), ...t,
    }, ...list])
    return id
  }, [])

  const setTicketStatus = useCallback((id, status) => {
    setTickets((l) => l.map((t) => (t.id === id ? { ...t, status, sla: status === 'Resolved' ? 'Met' : t.sla } : t)))
  }, [])

  const addAnnouncement = useCallback((a) => {
    setAnnouncements((l) => [{ id: Date.now(), author: 'Nikhil Tembhare', date: new Date().toISOString().slice(0, 10), pinned: false, ...a }, ...l])
  }, [])

  const addDocument = useCallback((d) => {
    setDocuments((l) => [{ status: 'Pending', uploaded: new Date().toISOString().slice(0, 10), ...d }, ...l])
  }, [])

  const addLeaveRequest = useCallback((r) => {
    setLeaveRequests((l) => [{ id: 'LV-' + (2042 + l.length), status: 'Pending', appliedOn: new Date().toISOString().slice(0, 10), ...r }, ...l])
  }, [])

  const setLeaveStatus = useCallback((id, status) => {
    setLeaveRequests((l) => l.map((r) => (r.id === id ? { ...r, status } : r)))
  }, [])

  const STAGES = ['Shortlisted', 'Tech Screen', 'HR Round', 'Final Round', 'Offer Rolled', 'Hired']
  const advanceCandidate = useCallback((name) => {
    let moved = null
    setCandidates((l) => l.map((c) => {
      if (c.name !== name) return c
      const i = STAGES.indexOf(c.stage)
      const next = STAGES[Math.min(i + 1, STAGES.length - 1)]
      moved = next
      return { ...c, stage: next }
    }))
    return moved
  }, [])

  const punchToggle = useCallback(() => {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    let action
    setPunch((p) => {
      if (p.outAt || !p.inAt) { action = 'in'; return { inAt: now, outAt: null } }
      action = 'out'
      return { ...p, outAt: now }
    })
    return { action, now }
  }, [])

  const value = useMemo(() => ({
    employees, addEmployee,
    leaveRequests, addLeaveRequest, setLeaveStatus,
    tickets, addTicket, setTicketStatus,
    announcements, addAnnouncement,
    documents, addDocument,
    candidates, advanceCandidate, openings,
    notifications, notify, markRead, markAllRead, clearNotifications,
    unread: notifications.filter((n) => !n.read).length,
    toast, punch, punchToggle,
  }), [employees, leaveRequests, tickets, announcements, documents, candidates, openings,
    notifications, punch, addEmployee, addLeaveRequest, setLeaveStatus, addTicket,
    setTicketStatus, addAnnouncement, addDocument, advanceCandidate, notify, markRead,
    markAllRead, clearNotifications, toast, punchToggle])

  return (
    <DataContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </DataContext.Provider>
  )
}

export const useApp = () => useContext(DataContext)
