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

const hhmm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
export const SHIFT_START = 600   // 10:00, in minutes
export const SHIFT_END = 1140    // 19:00
export const LATE_AFTER = 615    // 15 minutes' grace

/** "09:34 am" / "06:55 PM" / "18:55" -> minutes after midnight. */
export function toMinutes(t) {
  const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i)
  if (!m) return null
  let h = Number(m[1]) % 12
  if (!m[3]) h = Number(m[1])
  else if (m[3].toLowerCase() === 'pm') h += 12
  return h * 60 + Number(m[2])
}

/** Totals for a day worked from first-in to last-out (or to now, if still in). */
function workedDay(base, inMin, outMin, working) {
  const workMin = Math.max(0, outMin - inMin)
  const shiftMin = SHIFT.hours * 60
  const diff = workMin - shiftMin
  return {
    ...base, status: 'P', label: working ? 'Working now' : 'Present',
    inMin, outMin, working, late: inMin > LATE_AFTER,
    firstIn: hhmm(inMin),
    lastOut: working ? null : hhmm(outMin),
    lateIn: inMin > LATE_AFTER ? hhmm(inMin - SHIFT_START) : '00:00',
    earlyOut: !working && outMin < SHIFT_END ? hhmm(SHIFT_END - outMin) : '00:00',
    totalWork: hhmm(workMin),
    breakHrs: '00:00',
    inShift: hhmm(Math.max(0, Math.min(outMin, SHIFT_END) - Math.max(inMin, SHIFT_START))),
    shortfall: diff < 0 ? hhmm(-diff) : '00:00',
    excess: diff > 0 ? hhmm(diff) : '00:00',
    sessions: [{ name: 'Session 1', timing: SHIFT.window.replace(' to ', ' - '), first: hhmm(inMin), last: working ? 'In progress' : hhmm(outMin) }],
  }
}

/**
 * Build a month of attendance.
 * status: P (present) | A (absent) | WO (weekly off) | H (holiday) | L (leave)
 *
 * `history` holds the person's real punches ({ 'YYYY-MM-DD': { in, out } });
 * those days show what was actually punched. Earlier days fall back to
 * sample data so the calendar is never empty.
 */
export function buildMonth(year, month, holidayDates = [], history = {}, todayISO, nowMin) {
  const days = new Date(year, month + 1, 0).getDate()
  const [ty, tm, td] = (todayISO || '2026-09-23').split('-').map(Number)
  const today = new Date(ty, tm - 1, td)

  return Array.from({ length: days }, (_, idx) => {
    const day = idx + 1
    const date = `${year}-${pad(month + 1)}-${pad(day)}`
    const d = new Date(year, month, day)
    const dow = d.getDay()
    const isToday = date === todayISO
    const base = { date, day, dow, isToday }

    // Real punches always win, even on a weekend or holiday.
    const real = history[date]
    const inMin = toMinutes(real?.in)
    if (inMin != null) {
      const out = toMinutes(real.out)
      const working = isToday && out == null
      return workedDay(base, inMin, working ? Math.max(inMin, nowMin ?? inMin) : (out ?? inMin), working)
    }

    if (holidayDates.includes(date)) return { ...base, status: 'H', label: 'Holiday' }
    if (dow === 0 || dow === 6) return { ...base, status: 'WO', label: 'Weekly off' }
    if (d >= today) return { ...base, status: '', label: isToday ? 'Not punched in yet' : '' }

    const r = rnd(day + month * 31)
    if (r < 0.06) return { ...base, status: 'A', label: 'Absent' }
    if (r < 0.12) return { ...base, status: 'L', label: 'On leave' }

    const sampleIn = 575 + Math.floor(r * 50)          // about 09:40 - 10:25; a few late
    const sampleWork = 540 + Math.floor(rnd(day + 7) * 75)  // 9h to 10h15 on site
    return workedDay(base, sampleIn, sampleIn + sampleWork, false)
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
