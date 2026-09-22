// Live holiday sync from Google Calendar.
//
// Google publishes national holiday calendars publicly, so the Calendar API v3
// `events.list` endpoint can be read with an API key alone - no OAuth, no
// backend, and the endpoint sends CORS headers so the browser can call it
// directly.
//
// Setup:
//   1. Google Cloud Console -> enable "Google Calendar API"
//   2. Create an API key, restrict it to your domain (HTTP referrer) and to
//      the Calendar API only
//   3. Put it in .env as:  VITE_GOOGLE_API_KEY=your_key
//
// Without a key the app falls back to the bundled 2026 list, so the calendar
// always renders.

export const HOLIDAY_CALENDARS = {
  india: 'en.indian#holiday@group.v.calendar.google.com',
  uk: 'en.uk#holiday@group.v.calendar.google.com',
  us: 'en.usa#holiday@group.v.calendar.google.com',
}

const API = 'https://www.googleapis.com/calendar/v3/calendars'
const CACHE_KEY = 'fl_hrms_google_holidays'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // half a day

export const apiKey = () => import.meta.env?.VITE_GOOGLE_API_KEY || ''
export const isConfigured = () => Boolean(apiKey())

function readCache(year, region) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const hit = raw[region + ':' + year]
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items
  } catch { /* storage unavailable or corrupt - ignore */ }
  return null
}

function writeCache(year, region, items) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    raw[region + ':' + year] = { at: Date.now(), items }
    localStorage.setItem(CACHE_KEY, JSON.stringify(raw))
  } catch { /* ignore */ }
}

/**
 * Fetch holidays for a year from Google.
 * Resolves to { status, items, error } and never throws, so the page can
 * always fall back to the bundled list.
 *   status: 'live' | 'cached' | 'not-configured' | 'error'
 */
export async function fetchGoogleHolidays(year, { region = 'india', force = false } = {}) {
  if (!isConfigured()) {
    return { status: 'not-configured', items: [], error: null }
  }

  if (!force) {
    const cached = readCache(year, region)
    if (cached) return { status: 'cached', items: cached, error: null }
  }

  const calendarId = encodeURIComponent(HOLIDAY_CALENDARS[region] || HOLIDAY_CALENDARS.india)
  const params = new URLSearchParams({
    key: apiKey(),
    timeMin: `${year}-01-01T00:00:00Z`,
    timeMax: `${year + 1}-01-01T00:00:00Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  try {
    const res = await fetch(`${API}/${calendarId}/events?${params}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return {
        status: 'error',
        items: [],
        error: body?.error?.message || `Google returned ${res.status}`,
      }
    }
    const data = await res.json()
    const items = (data.items || [])
      .filter((e) => e.start?.date)
      .map((e) => ({
        date: e.start.date,
        name: e.summary,
        // Google tags public holidays in the description; anything else is an
        // observance rather than a day off.
        type: /public holiday/i.test(e.description || '') ? 'Public holiday' : 'Observance',
        scope: 'From Google Calendar',
        source: 'google',
      }))
    writeCache(year, region, items)
    return { status: 'live', items, error: null }
  } catch (err) {
    return { status: 'error', items: [], error: err?.message || 'Network request failed' }
  }
}

export const SYNC_LABEL = {
  live: 'Synced from Google Calendar',
  cached: 'Google Calendar (cached)',
  'not-configured': 'Bundled list - Google sync not configured',
  error: 'Bundled list - Google sync unavailable',
}
