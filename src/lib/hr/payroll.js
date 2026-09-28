// Payroll: salary structures and monthly payslips.
//
// Each person's annual CTC comes from their designation's pay band (stable
// per person), split into the usual Indian components. A payslip prorates
// fixed pay for loss-of-pay days (absences and unpaid leave), adds overtime
// and any bonus, and applies PF, ESI, professional tax and an estimated TDS
// under the new tax regime. Figures are indicative - this is a demo engine,
// not a statutory payroll.

import { monthDays, isWorkingDay, employeeDay, SHIFT_HOURS } from './attendance.js'
import { isUnpaidLeave } from './leave.js'

const rnd = (seed) => { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return ((h >>> 0) % 1000) / 1000 }
const round = (n) => Math.round(n)

// Annual CTC bands in lakh rupees, first match wins.
const BANDS = [
  [/head|controller|policy lead|legal counsel|engineering manager|senior product manager/i, 26, 38],
  [/manager|lead|business partner|risk manager|underwriter/i, 16, 26],
  [/senior/i, 18, 28],
  [/engineer|developer|designer|devops|analyst|product manager|performance marketer|aml/i, 9, 16],
  [/officer|relationship|recovery/i, 7, 11],
  [/executive|associate|inside sales/i, 4.5, 7.5],
]

export function annualCtc(emp) {
  const band = BANDS.find(([re]) => re.test(emp.designation || '')) || [null, 6, 10]
  const lakh = band[1] + rnd(emp.id + 'ctc') * (band[2] - band[1])
  return round(lakh * 100000 / 1000) * 1000
}

/** Monthly salary structure: { ctc, monthlyCtc, earnings: [{ head, amount }], employerPf }. */
export function structureFor(emp) {
  const ctc = annualCtc(emp)
  const monthlyCtc = round(ctc / 12)
  const basic = round(monthlyCtc * 0.4)
  const hra = round(basic * 0.5)
  const conveyance = 1600
  const medical = 1250
  const lta = round(monthlyCtc * 0.06)
  const employerPf = Math.min(1800, round(basic * 0.12))
  const special = Math.max(0, monthlyCtc - basic - hra - conveyance - medical - lta - employerPf)
  return {
    ctc, monthlyCtc, employerPf,
    earnings: [
      { head: 'Basic Salary', amount: basic }, { head: 'House Rent Allowance', amount: hra },
      { head: 'Special Allowance', amount: special }, { head: 'Conveyance', amount: conveyance },
      { head: 'Medical Allowance', amount: medical }, { head: 'LTA', amount: lta },
    ],
  }
}

// New regime slabs (FY 2026-27), with the section 87A rebate up to 12 lakh.
function annualTax(taxable) {
  if (taxable <= 1200000) return 0
  const slabs = [[400000, 0], [800000, 0.05], [1200000, 0.1], [1600000, 0.15], [2000000, 0.2], [2400000, 0.25], [Infinity, 0.3]]
  let tax = 0
  let prev = 0
  for (const [upto, rate] of slabs) {
    if (taxable > prev) tax += (Math.min(taxable, upto) - prev) * rate
    prev = upto
  }
  return round(tax * 1.04) // plus 4% cess
}

export const monthLabel = (month) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/**
 * One payslip. ctx: { leaveRequests } (approved leave and unpaid leave);
 * opts: { bonusPercent, otMultiplier }.
 */
export function computePayslip(emp, month, ctx, opts = {}) {
  const bonusPercent = Number(opts.bonusPercent) || 0
  const otMultiplier = Number(opts.otMultiplier) || 1.5
  const days = monthDays(month)
  const dayCtx = { leaveRequests: ctx.leaveRequests, today: days[days.length - 1] }
  const recs = days.map((d) => ({ d, ...employeeDay(emp, d, dayCtx) }))
  const workingDays = days.filter(isWorkingDay).length
  const lopDays = recs.filter((r) => r.status === 'Absent' || (r.status === 'On leave' && isUnpaidLeave(r.leaveType))).length
  const paidDays = Math.max(0, workingDays - lopDays)
  const factor = workingDays ? paidDays / workingDays : 1
  const overtimeHours = +recs.reduce((s, r) => s + (r.overtime || 0), 0).toFixed(1)

  const s = structureFor(emp)
  const basic = s.earnings[0].amount
  const earnings = s.earnings.map((e) => ({ head: e.head, amount: round(e.amount * factor) }))
  const hourly = basic / Math.max(1, workingDays * SHIFT_HOURS)
  const otPay = round(overtimeHours * hourly * otMultiplier)
  if (otPay) earnings.push({ head: 'Overtime (' + overtimeHours + ' h x ' + otMultiplier + ')', amount: otPay })
  const bonus = round(basic * bonusPercent / 100)
  if (bonus) earnings.push({ head: 'Bonus (' + bonusPercent + '% of basic)', amount: bonus })
  const gross = earnings.reduce((t, e) => t + e.amount, 0)

  const pf = Math.min(1800, round(earnings[0].amount * 0.12))
  const deductions = [{ head: 'Provident Fund (Employee)', amount: pf }]
  if (gross <= 21000) deductions.push({ head: 'ESI (Employee)', amount: round(gross * 0.0075) })
  if (gross > 10000) deductions.push({ head: 'Professional Tax', amount: 200 })
  const tds = round(annualTax(Math.max(0, gross * 12 - 75000 - pf * 12)) / 12)
  if (tds) deductions.push({ head: 'Income Tax (TDS)', amount: tds })
  const totalDeductions = deductions.reduce((t, d) => t + d.amount, 0)

  return {
    id: 'PS-' + month + '-' + emp.id, month, empId: emp.id, employee: emp.name, designation: emp.designation, department: emp.department,
    workingDays, paidDays, lopDays, overtimeHours, earnings, deductions, gross, totalDeductions, net: gross - totalDeductions,
  }
}

/** A full run for everyone in the directory. */
export function computeRun(employees, month, ctx, opts = {}, by = 'System') {
  const payslips = employees.map((e) => computePayslip(e, month, ctx, opts))
  const sum = (k) => payslips.reduce((t, p) => t + p[k], 0)
  return {
    run: { id: 'PR-' + month, month, status: 'Processed', runBy: by, runAt: new Date().toISOString(), bonusPercent: Number(opts.bonusPercent) || 0,
      otMultiplier: Number(opts.otMultiplier) || 1.5, employees: payslips.length, gross: sum('gross'), deductions: sum('totalDeductions'), net: sum('net') },
    payslips,
  }
}
