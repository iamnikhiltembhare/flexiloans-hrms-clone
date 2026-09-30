// Account recovery and security settings, against the API (server/recovery.js).
// The offline demo has no server to send codes, so recovery is unavailable there.

import { API_MODE, api } from './api.js'

const post = (path, body, auth = false) => api(path, { method: 'POST', body, auth })

export const recoveryAvailable = API_MODE

export const recovery = {
  options: () => api('/api/auth/recovery/options', { auth: false }),
  start: (identifier, channel, purpose) => post('/api/auth/recovery/start', { identifier, channel, purpose }),
  verify: (requestId, code) => post('/api/auth/recovery/verify', { requestId, code }),
  openLink: (token) => post('/api/auth/recovery/link', { token }),
  complete: (ticket, changes) => post('/api/auth/recovery/complete', { ticket, ...changes }),
}

export const security = {
  get: () => api('/api/auth/security'),
  changePassword: (current, password) => post('/api/auth/password', { current, password }, true),
  startPhone: (phone) => post('/api/auth/phone/start', { phone }, true),
  confirmPhone: (requestId, code) => post('/api/auth/phone/confirm', { requestId, code }, true),
}
