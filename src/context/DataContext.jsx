import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { readStored, writeStored, clearStoredState } from '../lib/persist.js'
import { ACTIONS, COLLECTIONS, TICKET_DESKS, applyAction, nextSerial, today, localDate, clockTime, newNotificationId } from '../lib/actions.js'
import { API_MODE, api } from '../lib/api.js'
import { SEED } from '../data/seed.js'
import { ALL_ACCOUNTS, ROLES } from '../data/accounts.js'
import { BRAND } from '../lib/brand.js'
import { createdAccounts, addCreatedAccount } from '../lib/localAccounts.js'
import { useAuth } from './AuthContext.jsx'
import ToastStack from '../components/Toast.jsx'

// Two modes, one interface:
// - Offline demo (no VITE_API_BASE_URL): data lives in this browser only.
// - Server: data comes from the API. Each action updates the screen at once,
//   then the server's answer replaces it, so the server always has the final say.

const DataContext = createContext(null)
const NAMES = Object.keys(COLLECTIONS)
const POLL_MS = 30000

const EMPTY = { ...Object.fromEntries(NAMES.map((n) => [n, []])), punch: { inAt: null, outAt: null } }
const loadLocal = () => Object.fromEntries(NAMES.map((n) => [n, readStored(n, SEED[n])]))

let seq = 100
const nextToastId = () => 't' + ++seq

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState(() => (API_MODE ? EMPTY : loadLocal()))
  const [ready, setReady] = useState(!API_MODE)
  const [loadError, setLoadError] = useState('')
  const [toasts, setToasts] = useState([])

  // The ref is the synchronous source of truth, so a dispatch can return a
  // result (a new id, the next stage) straight after an earlier dispatch.
  const stateRef = useRef(state)
  const commit = useCallback((next) => { stateRef.current = next; setState(next) }, [])

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback((title, detail, kind = 'success') => {
    const id = nextToastId()
    setToasts((t) => [...t, { id, title, detail, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  // --- offline demo: persist each collection that changed ----------------
  const saved = useRef(state)
  useEffect(() => {
    if (API_MODE) return
    for (const n of NAMES) if (state[n] !== saved.current[n]) writeStored(n, state[n])
    saved.current = state
  }, [state])

  // --- server sync ---------------------------------------------------------
  const pending = useRef(0)   // actions in flight; polls must not undo them
  const latest = useRef(0)    // only the newest action response is applied

  const refresh = useCallback(async () => {
    if (!API_MODE) return true
    try {
      const fresh = await api('/api/state')
      if (pending.current === 0) commit(fresh)
      setReady(true)
      setLoadError('')
      return true
    } catch (err) {
      setLoadError(err.message)
      return false
    }
  }, [commit])

  useEffect(() => {
    if (!API_MODE) return
    if (!user) { commit(EMPTY); setReady(false); return }
    refresh()
    const tick = () => { if (document.visibilityState === 'visible') refresh() }
    const timer = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [user, refresh, commit])

  const dispatch = useCallback((type, payload) => {
    const { collection } = ACTIONS[type]
    const { value, result } = applyAction(stateRef.current[collection], { type, payload })
    commit({ ...stateRef.current, [collection]: value })

    if (API_MODE) {
      const mine = ++latest.current
      pending.current++
      api('/api/actions', { method: 'POST', body: { type, payload } })
        .then(({ state: server }) => { if (mine === latest.current) commit(server) })
        .catch((err) => {
          toast('Not saved', err.message, 'error')
          pending.current = 0
          refresh()
        })
        .finally(() => { pending.current = Math.max(0, pending.current - 1) })
    }
    return result
  }, [commit, refresh, toast])

  // --- actions (same names and return values the pages always used) ------
  const me = user?.name || 'Current user'

  const notify = useCallback((n) => dispatch('notification.add', {
    notification: { id: newNotificationId(), time: 'Just now', at: new Date().toISOString(), read: false, kind: 'info', ...n },
  }), [dispatch])
  const markRead = useCallback((id) => dispatch('notification.read', { id }), [dispatch])
  const markAllRead = useCallback(() => dispatch('notification.readAll'), [dispatch])
  const clearNotifications = useCallback(() => dispatch('notification.clear'), [dispatch])

  const addEmployee = useCallback((emp) => dispatch('employee.add', { employee: {
    id: nextSerial(stateRef.current.employees, 'FL', 1000),
    status: 'Probation', experience: '0 yrs', employmentType: 'Permanent', manager: me, joinDate: today(),
    ...emp,
  } }), [dispatch, me])

  const addTicket = useCallback((t) => dispatch('ticket.add', { ticket: {
    id: nextSerial(stateRef.current.tickets, 'HD-', 8841),
    status: 'Open', sla: '8h left', assignee: TICKET_DESKS[t.category]?.desk || 'HR Ops',
    raisedBy: me, raisedById: user?.id, created: today(),
    ...t,
  } }), [dispatch, me, user])

  const setTicketStatus = useCallback((id, status) => dispatch('ticket.setStatus', { id, status, by: me }), [dispatch, me])

  const addAnnouncement = useCallback((a) => dispatch('announcement.add', { announcement: {
    id: Date.now(), author: me, date: today(), pinned: false, ...a,
  } }), [dispatch, me])

  const addDocument = useCallback((d) => dispatch('document.add', { document: {
    status: 'Pending', uploaded: today(), ...d,
  } }), [dispatch])

  const addLeaveRequest = useCallback((r) => dispatch('leave.add', { request: {
    id: nextSerial(stateRef.current.leaveRequests, 'LV-', 2041), status: 'Pending', appliedOn: today(), ...r,
  } }), [dispatch])

  const setLeaveStatus = useCallback((id, status) => dispatch('leave.setStatus', { id, status }), [dispatch])

  const advanceCandidate = useCallback((name) => dispatch('candidate.advance', { name }), [dispatch])

  const addRequisition = useCallback((r) => dispatch('requisition.add', { requisition: {
    id: nextSerial(stateRef.current.requisitions, 'REQ-', 311),
    applicants: 0, stage: 'Sourcing', owner: me, posted: today(), ...r,
  } }), [dispatch, me])

  const punchToggle = useCallback(() => dispatch('punch.toggle', { now: clockTime(), date: localDate() }), [dispatch])

  const addRegularisation = useCallback((r) => dispatch('regularisation.add', { request: {
    id: nextSerial(stateRef.current.regularisations, 'RG-', 1000),
    empId: user?.id, employee: me, status: 'Pending', appliedOn: today(), ...r,
  } }), [dispatch, me, user])
  const decideRegularisation = useCallback((id, status) => dispatch('regularisation.decide', { id, status, by: me }), [dispatch, me])

  // --- user administration (super admin) ---------------------------------
  // Server mode asks the API; the offline demo keeps created users in this
  // browser. Both add the person to the People directory.
  const listUsers = useCallback(async () => {
    if (API_MODE) return (await api('/api/admin/users')).users
    const row = (a, source) => ({ username: a.username, name: a.profile.name, email: a.profile.email, empId: a.profile.id,
      role: ROLES[a.role].label, roleKey: a.role, source, createdBy: a.createdBy || null })
    return [...ALL_ACCOUNTS.map((a) => row(a, 'seed')), ...createdAccounts().map((a) => row(a, 'admin'))]
  }, [])

  const createUser = useCallback(async (form) => {
    if (API_MODE) {
      const { user: made, state: server } = await api('/api/admin/users', { method: 'POST', body: { ...form } })
      commit(server)
      return made
    }
    const username = form.username.trim().toLowerCase()
    if (!/^[a-z][a-z0-9._-]{2,39}$/.test(username)) throw new Error('Username must be 3-40 characters: lowercase letters, numbers, dots, dashes or underscores, starting with a letter')
    if (form.password.length < 8 || !/[a-z]/i.test(form.password) || !/\d/.test(form.password)) throw new Error('The password needs at least 8 characters, with letters and numbers')
    const taken = [...ALL_ACCOUNTS, ...createdAccounts()].some((a) => a.username === username)
    if (taken) throw new Error('The username ' + username + ' is already taken')
    const id = nextSerial(stateRef.current.employees, 'FL', 1000)
    const profile = {
      id, name: form.name.trim(), email: username + '@' + BRAND.emailDomain,
      designation: form.designation || ROLES[form.role].label, department: form.department, location: form.location,
      manager: me, joinDate: today(), phone: 'Not provided', gender: 'Not specified', employmentType: 'Permanent',
    }
    addCreatedAccount({ username, role: form.role, profile, password: form.password, createdBy: me })
    dispatch('employee.add', { employee: { ...profile, status: 'Probation', experience: '0 yrs', username } })
    return { username, name: profile.name, role: ROLES[form.role].label }
  }, [commit, dispatch, me])

  // Restore the starting data: on the server for everyone, or in this browser.
  const resetData = useCallback(async () => {
    if (!API_MODE) return clearStoredState()
    const { state: server } = await api('/api/admin/reset', { method: 'POST' })
    commit(server)
    return NAMES.length
  }, [commit])

  const value = useMemo(() => ({
    ...state,
    openings: state.requisitions,
    addEmployee, addLeaveRequest, setLeaveStatus, addTicket, setTicketStatus,
    addAnnouncement, addDocument, advanceCandidate, addRequisition,
    notify, markRead, markAllRead, clearNotifications,
    unread: state.notifications.filter((n) => !n.read).length,
    toast, punchToggle, addRegularisation, decideRegularisation, resetData, listUsers, createUser,
    ready, loadError, refresh, online: API_MODE,
  }), [state, addEmployee, addLeaveRequest, setLeaveStatus, addTicket, setTicketStatus,
    addAnnouncement, addDocument, advanceCandidate, addRequisition, notify, markRead,
    markAllRead, clearNotifications, toast, punchToggle, addRegularisation, decideRegularisation, resetData, listUsers, createUser, ready, loadError, refresh])

  return (
    <DataContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </DataContext.Provider>
  )
}

export const useApp = () => useContext(DataContext)
