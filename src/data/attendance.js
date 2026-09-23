// Attendance Info dataset, shaped like the greytHR attendance screen:
// one record per day with shift, punches, sessions and derived totals.

export const SHIFT = {
  name: 'General Shift 1 (Sat-Sun)',
  window: '10:00 to 19:00',
  scheme: 'Attendance Scheme - Biometric',
  label: '10 Am To 7pm (1019)',
  hours: 9,
}

const pad = (n) => String(n).padStart(2, '0')

/** Deterministic pseudo-random so the month looks the same on every render. */
const rnd = (i) => Math.abs(Math.sin(i * 45.11) * 9973) % 1

/**
 * Build a month of attendance.
 * status: P (present) | A (absent) | WO (weekly off) | H (holiday) | L (leave)
 */
export function buildMonth(year, month, holidayDates = []) {
  const days = new Date(year, month + 1, 0).getDate()
  const today = new Date(2026, 8, 23) // demo "today"

  return Array.from({ length: days }, (_, idx) => {
    const day = idx + 1
    const date = `${year}-${pad(month + 1)}-${pad(day)}`
    const d = new Date(year, month, day)
    const dow = d.getDay()
    const future = d > today

    if (holidayDates.includes(date)) {
      return { date, day, dow, status: 'H', label: 'Holiday' }
    }
    if (dow === 0 || dow === 6) {
      return { date, day, dow, status: 'WO', label: 'Weekly off' }
    }
    if (future) {
      return { date, day, dow, status: '', label: '' }
    }

    const r = rnd(day + month * 31)
    if (r < 0.06) return { date, day, dow, status: 'A', label: 'Absent' }
    if (r < 0.12) return { date, day, dow, status: 'L', label: 'On leave' }

    const inMin = 600 + Math.floor(r * 45)          // 10:00 - 10:45
    const workMin = 520 + Math.floor(rnd(day + 7) * 90)
    const breakMin = 40 + Math.floor(rnd(day + 13) * 25)
    const outMin = inMin + workMin + breakMin
    const shiftMin = SHIFT.hours * 60
    const diff = workMin - shiftMin

    const hhmm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`

    return {
      date, day, dow, status: 'P', label: 'Present',
      firstIn: hhmm(inMin),
      lastOut: hhmm(outMin),
      lateIn: inMin > 615 ? hhmm(inMin - 615) : '00:00',
      earlyOut: outMin < 1140 ? hhmm(1140 - outMin) : '00:00',
      totalWork: hhmm(workMin),
      breakHrs: hhmm(breakMin),
      inShift: hhmm(Math.min(workMin, shiftMin)),
      shortfall: diff < 0 ? hhmm(-diff) : '00:00',
      excess: diff > 0 ? hhmm(diff) : '00:00',
      sessions: [
        { name: 'Session 1', timing: '10:30 - 14:30', first: hhmm(inMin), last: '14:30' },
        { name: 'Session 2', timing: '14:31 - 19:00', first: '14:31', last: hhmm(outMin) },
      ],
    }
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
  }
}
