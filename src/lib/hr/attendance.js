// Day-by-day attendance for anyone in the directory, shared by the payroll
// run, the HR Assistant, alerts and analytics.
//
// Most people have no punch history in the demo, so each working day is
// derived deterministically from the employee id and the date (the same
// answer every time), with approved leave and holidays applied. A person's
// own real punches replace the derived day.

import { companyHolidays } from '../../data/holidays.js'

export const SHIFT_HOURS = 9
const pad = (n) => String(n).padStart(2, '0')
export const hhmm = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60)
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())

const rnd = (seed) => { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return ((h >>> 0) % 10000) / 10000 }
export const holidaySet = new Set(companyHolidays.map((h) => h.date))

/** "09:34 am" / "18:55" -> minutes after midnight, or null. */
export function toMinutes(t) {
  const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i)
  if (!m) return null
  let h = Number(m[1])
  if (m[3]) h = (h % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0)
  return h * 60 + Number(m[2])
}

export const isWorkingDay = (date) => { const dow = parseISO(date).getDay(); return dow !== 0 && dow !== 6 && !holidaySet.has(date) }

/**
 * One person's day. ctx: { leaveRequests, today, nowMin, self: { id, punch } }.
 * Returns { status, firstIn, lastOut, hours, overtime, late, mode, leaveType }.
 */
export function employeeDay(emp, date, ctx) {
  if (holidaySet.has(date)) return { status: 'Holiday' }
  const dow = parseISO(date).getDay()
  if (dow === 0 || dow === 6) return { status: 'Weekly off' }
  const leave = (ctx.leaveRequests || []).find((r) => r.empId === emp.id && r.status === 'Approved' && r.from <= date && r.to >= date)
  if (leave) return { status: 'On leave', leaveType: leave.type }
  if (ctx.today && date > ctx.today) return { status: 'Upcoming' }

  if (ctx.self && emp.id === ctx.self.id) {
    const real = ctx.self.punch?.history?.[date]
    const inMin = toMinutes(real?.in)
    if (inMin != null) {
      const outMin = toMinutes(real.out) ?? (date === ctx.today && ctx.nowMin != null ? ctx.nowMin : null)
      const hours = outMin != null ? +((outMin - inMin) / 60).toFixed(1) : 0
      return { status: 'Present', firstIn: hhmm(inMin), lastOut: real.out ? hhmm(toMinutes(real.out)) : null, late: inMin > 615,
        hours, overtime: Math.max(0, +(hours - SHIFT_HOURS).toFixed(1)), mode: real.mode || 'Office', real: true }
    }
    // Your own today is real punches only.
    if (date === ctx.today) return { status: 'Not in yet' }
  }

  const r = rnd(emp.id + date)
  if (r < 0.05) return { status: 'Absent' }
  const inMin = 575 + Math.floor(rnd(date + emp.id) * 55)
  const outMin = inMin + 530 + Math.floor(rnd(emp.id + date + 'o') * 80)
  const isToday = date === ctx.today && ctx.nowMin != null
  if (isToday && ctx.nowMin < inMin) return { status: 'Not in yet' }
  const end = isToday ? Math.min(outMin, ctx.nowMin) : outMin
  const hours = +((end - inMin) / 60).toFixed(1)
  return {
    status: 'Present', late: inMin > 615, firstIn: hhmm(inMin), lastOut: isToday && ctx.nowMin < outMin ? null : hhmm(outMin),
    hours, overtime: isToday ? 0 : Math.max(0, +(hours - SHIFT_HOURS).toFixed(1)),
    mode: rnd(emp.id + date + 'm') < 0.15 ? 'Remote' : 'Office',
  }
}

/** Every day of a month up to `until` (inclusive), YYYY-MM-DD strings. */
export function monthDays(month, until) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const out = []
  for (let d = 1; d <= last; d++) { const s = month + '-' + pad(d); if (!until || s <= until) out.push(s) }
  return out
}

/** Month totals for one person. */
export function monthSummary(emp, month, ctx) {
  const days = monthDays(month, ctx.today)
  const recs = days.map((d) => employeeDay(emp, d, ctx))
  const present = recs.filter((r) => r.status === 'Present')
  return {
    working: days.filter(isWorkingDay).length,
    present: present.length,
    late: present.filter((r) => r.late).length,
    absent: recs.filter((r) => r.status === 'Absent').length,
    leave: recs.filter((r) => r.status === 'On leave').length,
    remote: present.filter((r) => r.mode === 'Remote').length,
    overtime: +present.reduce((s, r) => s + (r.overtime || 0), 0).toFixed(1),
    avgHours: present.length ? +(present.reduce((s, r) => s + (r.hours || 0), 0) / present.length).toFixed(1) : 0,
    records: recs,
  }
}
