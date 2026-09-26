// Client for the HRMS API (server/app.js).
//
// Set VITE_API_BASE_URL at build time to use the server. Without it the app
// runs as the offline demo: mock data in the browser, no network at all.
// Vite inlines the value, so the unused mode is stripped from the bundle.

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
// Read straight from the inlined env value so the bundler can fold it to a
// constant and drop the offline-only code (including the demo passwords).
export const API_MODE = !!import.meta.env.VITE_API_BASE_URL

// Test builds (VITE_APP_ENV=test) talk to the API's isolated /test
// environment and show a TEST banner and the test-only logins.
export const IS_TEST_BUILD = import.meta.env.VITE_APP_ENV === 'test'

const TOKEN_KEY = 'fl_hrms_v1:token'

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export const session = {
  get() { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set(token) { try { localStorage.setItem(TOKEN_KEY, token) } catch { /* memory only */ } },
  clear() { try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } },
}

// Lets AuthContext sign the user out when any request finds the session dead.
let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = session.get()
  if (auth && token) headers.Authorization = 'Bearer ' + token

  let res
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && auth) onUnauthorized()
    throw new ApiError(res.status, data.error || 'Request failed (' + res.status + ')')
  }
  return data
}
