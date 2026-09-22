// FlexiLoans holiday calendar 2026.
//
// Mirrors the company list published in the HR portal: fixed holidays are days
// the office is closed, optional holidays are the ones an employee applies for.
// Dates marked `lunar` depend on moon sighting and may move by a day.

export const HOLIDAY_YEAR = 2026
export const YEARS = [2025, 2026, 2027]

/** One flat list; `optional` decides whether an Apply action is offered. */
export const holidayList = [
  { date: '2026-01-01', name: 'New Year', optional: false },
  { date: '2026-01-13', name: 'Lohri', optional: true, scope: 'North India' },
  { date: '2026-01-14', name: 'Makar Sankranti / Pongal', optional: true, scope: 'Regional' },
  { date: '2026-01-26', name: 'Republic Day', optional: false },

  { date: '2026-03-19', name: 'Gudi Padwa', optional: true, scope: 'Maharashtra' },
  { date: '2026-03-21', name: 'Ramazan (Id-ul-Fitr)', optional: true, scope: 'All India', lunar: true },
  { date: '2026-03-26', name: 'Ram Navmi', optional: true, scope: 'All India' },
  { date: '2026-03-31', name: 'Mahavir Jayanti', optional: true, scope: 'All India' },

  { date: '2026-05-01', name: 'Labour Day / Maharashtra Day', optional: false },
  { date: '2026-05-27', name: 'Bakri Eid', optional: false, lunar: true },

  { date: '2026-06-26', name: 'Muharram', optional: true, scope: 'All India', lunar: true },

  { date: '2026-08-15', name: 'Independence Day', optional: false },

  { date: '2026-09-14', name: 'Ganesh Chaturthi', optional: false },

  { date: '2026-10-02', name: 'Gandhi Jayanti', optional: false },
  { date: '2026-10-19', name: 'Maha Navami', optional: true, scope: 'East & South' },
  { date: '2026-10-20', name: 'Dussehra', optional: false },

  { date: '2026-11-08', name: 'Diwali (Laxmi Pujan)', optional: false },
  { date: '2026-11-10', name: 'Govardhan Puja', optional: true, scope: 'North & West' },
  { date: '2026-11-11', name: 'Bhai Dooj', optional: true, scope: 'North India' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', optional: true, scope: 'Punjab & North' },

  { date: '2026-12-25', name: 'Christmas', optional: false },
]

export const companyHolidays = holidayList
  .filter((h) => !h.optional)
  .map((h) => ({ ...h, type: ['New Year', 'Republic Day', 'Independence Day', 'Gandhi Jayanti'].includes(h.name) ? 'National' : 'Festival', scope: h.scope || 'All India' }))

export const optionalHolidays = holidayList
  .filter((h) => h.optional)
  .map((h) => ({ ...h, scope: h.scope || 'All India' }))

/** How many optional holidays an employee may take in the year. */
export const OPTIONAL_HOLIDAY_QUOTA = 2

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Local-time parse so a YYYY-MM-DD never slips a day across time zones. */
export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function weekdayOf(iso) {
  return parseDate(iso).toLocaleDateString('en-IN', { weekday: 'long' })
}

export function prettyDate(iso) {
  return parseDate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function isWeekend(iso) {
  const d = parseDate(iso).getDay()
  return d === 0 || d === 6
}
