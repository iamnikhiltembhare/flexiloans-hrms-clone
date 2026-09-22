// India holiday calendar 2026.
//
// Gazetted (closed) holidays and restricted holidays follow the Department of
// Personnel and Training list for 2026. Restricted holidays are the ones an
// employee may apply for - central government practice allows any two.
// Dates marked `lunar: true` depend on moon sighting and may shift by a day.

export const HOLIDAY_YEAR = 2026

/** Company-wide closed holidays. Offices shut; no application needed. */
export const companyHolidays = [
  { date: '2026-01-26', name: 'Republic Day', type: 'National', scope: 'All India' },
  { date: '2026-03-04', name: 'Holi', type: 'Festival', scope: 'All India' },
  { date: '2026-03-21', name: 'Id-ul-Fitr', type: 'Festival', scope: 'All India', lunar: true },
  { date: '2026-03-26', name: 'Ram Navami', type: 'Festival', scope: 'All India' },
  { date: '2026-03-31', name: 'Mahavir Jayanti', type: 'Festival', scope: 'All India' },
  { date: '2026-04-03', name: 'Good Friday', type: 'Festival', scope: 'All India' },
  { date: '2026-05-01', name: 'Buddha Purnima', type: 'Festival', scope: 'All India' },
  { date: '2026-05-27', name: 'Id-ul-Zuha (Bakrid)', type: 'Festival', scope: 'All India', lunar: true },
  { date: '2026-06-26', name: 'Muharram', type: 'Festival', scope: 'All India', lunar: true },
  { date: '2026-08-15', name: 'Independence Day', type: 'National', scope: 'All India' },
  { date: '2026-08-26', name: 'Milad-un-Nabi', type: 'Festival', scope: 'All India', lunar: true },
  { date: '2026-09-04', name: 'Janmashtami', type: 'Festival', scope: 'All India' },
  { date: '2026-10-02', name: 'Gandhi Jayanti', type: 'National', scope: 'All India' },
  { date: '2026-10-20', name: 'Dussehra', type: 'Festival', scope: 'All India' },
  { date: '2026-11-08', name: 'Diwali (Lakshmi Puja)', type: 'Festival', scope: 'All India' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', type: 'Festival', scope: 'All India' },
  { date: '2026-12-25', name: 'Christmas Day', type: 'Festival', scope: 'All India' },
]

/** Restricted / optional holidays. Employees may apply for a limited number. */
export const optionalHolidays = [
  { date: '2026-01-01', name: "New Year's Day", scope: 'All India' },
  { date: '2026-01-03', name: "Hazarat Ali's Birthday", scope: 'All India' },
  { date: '2026-01-14', name: 'Makar Sankranti / Pongal / Magha Bihu', scope: 'Regional' },
  { date: '2026-01-23', name: 'Basant Panchami / Sri Panchami', scope: 'North & East' },
  { date: '2026-02-01', name: "Guru Ravidas's Birthday", scope: 'North India' },
  { date: '2026-02-12', name: 'Swami Dayananda Saraswati Jayanti', scope: 'All India' },
  { date: '2026-02-15', name: 'Maha Shivaratri', scope: 'All India' },
  { date: '2026-02-19', name: 'Shivaji Jayanti', scope: 'Maharashtra' },
  { date: '2026-03-03', name: 'Holika Dahan / Dolyatra', scope: 'All India' },
  { date: '2026-03-19', name: 'Gudi Padwa / Ugadi / Cheti Chand', scope: 'Regional' },
  { date: '2026-03-20', name: 'Jamat-Ul-Vida', scope: 'All India', lunar: true },
  { date: '2026-04-05', name: 'Easter Sunday', scope: 'All India' },
  { date: '2026-04-14', name: 'Vaisakhi / Vishu / Meshadi', scope: 'Regional' },
  { date: '2026-04-15', name: 'Vaisakhadi / Bahag Bihu', scope: 'East India' },
  { date: '2026-05-09', name: 'Rabindranath Tagore Jayanti', scope: 'West Bengal' },
  { date: '2026-07-16', name: 'Rath Yatra', scope: 'Odisha & East' },
  { date: '2026-08-15', name: 'Parsi New Year (Nauraj)', scope: 'Maharashtra & Gujarat' },
  { date: '2026-08-26', name: 'Onam / Thiru Onam', scope: 'Kerala' },
  { date: '2026-08-28', name: 'Raksha Bandhan', scope: 'All India' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi', scope: 'Maharashtra & West' },
  { date: '2026-10-18', name: 'Durga Puja (Saptami)', scope: 'East India' },
  { date: '2026-10-19', name: 'Durga Puja (Mahashtami)', scope: 'East India' },
  { date: '2026-10-26', name: "Maharishi Valmiki's Birthday", scope: 'North India' },
  { date: '2026-10-29', name: 'Karwa Chauth', scope: 'North India' },
  { date: '2026-11-08', name: 'Naraka Chaturdasi', scope: 'South & West' },
  { date: '2026-11-09', name: 'Govardhan Puja / Balipratipada', scope: 'North & West' },
  { date: '2026-11-11', name: 'Bhai Duj', scope: 'North India' },
  { date: '2026-11-15', name: 'Chhath Puja (Surya Shashti)', scope: 'Bihar & East' },
  { date: '2026-11-24', name: "Guru Teg Bahadur's Martyrdom Day", scope: 'Punjab & North' },
  { date: '2026-12-23', name: "Hazarat Ali's Birthday", scope: 'All India' },
]

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
