// Attendance Info dataset, shaped like the greytHR attendance screen:
// one record per day with shift, punches, sessions and derived totals.

import { employeeDay, toMinutes } from '../lib/hr/attendance.js'

export { toMinutes }

export const SHIFT = {
  name: 'General Shift 1 (Sat-Sun)',
  window: '10:00 to 19:00',
  scheme: 'Attendance Scheme - Biometric',
  label: '10 Am To 7pm (1019)',
  hours: 9,
}

const pad = (n) => String(n).padStart(2, '0')

const hhmm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
export const SHIFT_START = 600   // 10:00, in minutes
export const SHIFT_END = 1140    // 19:00
export const LATE_AFTER = 615    // 15 minutes' grace


/** Totals for a day worked from first-in to last-out (or to now, if still in). */
function workedDay(base, inMin, outMin, working, mode) {
  const workMin = Math.max(0, outMin - inMin)
  const shiftMin = SHIFT.hours * 60
  const diff = workMin - shiftMin
  return {
    ...base, status: 'P', label: working ? 'Working now' : mode === 'Remote' ? 'Work from home' : 'Present',
    inMin, outMin, working, mode, late: inMin > LATE_AFTER,
    firstIn: hhmm(inMin),
    lastOut: working ? null : hhmm(outMin),
    lateIn: inMin > LATE_AFTER ? hhmm(inMin - SHIFT_START) : '00:00',
    earlyOut: !working && outMin < SHIFT_END ? hhmm(SHIFT_END - outMin) : '00:00',
    totalWork: hhmm(workMin),
    breakHrs: '00:00',
    inShift: hhmm(Math.max(0, Math.min(outMin, SHIFT_END) - Math.max(inMin, SHIFT_START))),
    shortfall: diff < 0 ? hhmm(-diff) : '00:00',
    excess: diff > 0 ? hhmm(diff) : '00:00',
    overtimeMin: working ? 0 : Math.max(0, diff),
    sessions: [{ name: 'Session 1', timing: SHIFT.window.replace(' to ', ' - '), first: hhmm(inMin), last: working ? 'In progress' : hhmm(outMin) }],
  }
}

const STATUS = { Holiday: ['H', 'Holiday'], 'Weekly off': ['WO', 'Weekly off'], 'On leave': ['L', 'On leave'], Absent: ['A', 'Absent'] }

/**
 * One person's month for the calendar, from the shared attendance model
 * (src/lib/hr/attendance.js) - the same days payroll and reports use.
 * status: P (present) | A (absent) | WO (weekly off) | H (holiday) | L (leave) | '' (not yet)
 * `history` holds real punches ({ 'YYYY-MM-DD': { in, out, mode } }), which
 * replace the modelled day.
 */
export function buildMonth({ emp, year, month, history = {}, todayISO, nowMin, leaveRequests = [] }) {
  const days = new Date(year, month + 1, 0).getDate()
  const ctx = { leaveRequests, today: todayISO, nowMin, self: { id: emp.id, punch: { history } } }

  return Array.from({ length: days }, (_, idx) => {
    const day = idx + 1
    const date = `${year}-${pad(month + 1)}-${pad(day)}`
    const dow = new Date(year, month, day).getDay()
    const isToday = date === todayISO
    const base = { date, day, dow, isToday }
    const rec = employeeDay(emp, date, ctx)
    if (STATUS[rec.status]) return { ...base, status: STATUS[rec.status][0], label: STATUS[rec.status][1], leaveType: rec.leaveType }
    if (rec.status !== 'Present') return { ...base, status: '', label: isToday ? 'Not punched in yet' : '' }
    const inMin = toMinutes(rec.firstIn)
    const working = isToday && !rec.lastOut
    const outMin = rec.lastOut ? toMinutes(rec.lastOut) : Math.max(inMin, nowMin ?? inMin)
    return workedDay(base, inMin, outMin, working, rec.mode)
  })
}

/** Month-level figures shown as tiles above the calendar. */
export function monthSummary(rows) {
  const present = rows.filter((r) => r.status === 'P')
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const avg = present.length
    ? Math.round(present.reduce((s, r) => s + toMin(r.totalWork), 0) / present.length)
    : 0
  const avgActual = present.length
    ? Math.round(present.reduce((s, r) => s + toMin(r.inShift), 0) / present.length)
    : 0
  return {
    avgWork: `${pad(Math.floor(avg / 60))}:${pad(avg % 60)}`,
    avgActual: `${pad(Math.floor(avgActual / 60))}:${pad(avgActual % 60)}`,
    penaltyDays: rows.filter((r) => r.status === 'A').length,
    present: present.length,
    leave: rows.filter((r) => r.status === 'L').length,
    weeklyOff: rows.filter((r) => r.status === 'WO').length,
    holidays: rows.filter((r) => r.status === 'H').length,
    remote: present.filter((r) => r.mode === 'Remote').length,
    overtime: `${pad(Math.floor(present.reduce((t, r) => t + (r.overtimeMin || 0), 0) / 60))}:${pad(present.reduce((t, r) => t + (r.overtimeMin || 0), 0) % 60)}`,
    overtimeMin: present.reduce((t, r) => t + (r.overtimeMin || 0), 0),
  }
}
