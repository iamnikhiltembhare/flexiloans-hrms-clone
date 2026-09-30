// Sending account-recovery messages: one-time codes, reset links and
// "your password was changed" notices.
//
// Real delivery is switched on by environment variables:
//   Email - RESEND_API_KEY and MAIL_FROM (e.g. "FlexiLoans HRMS <hr@flexiloans.com>")
//   SMS   - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (an E.164 number)
//
// Without them a channel is simply unavailable and the app does not offer it.
// The test environment (and local development, with HRMS_DEV_OUTBOX=true)
// uses an outbox instead: messages are kept in the store for a super admin of
// that environment to read, and never leave the server.

const OUTBOX_KEY = 'outbox'
const OUTBOX_MAX = 50
const OUTBOX_TTL_MS = 60 * 60 * 1000

/** "+91 98200 31009" -> "+919820031009"; ten-digit Indian numbers get +91. */
export function toE164(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '')
  if (/^\+\d{10,15}$/.test(digits)) return digits
  const d = digits.replace(/\D/g, '')
  if (d.length === 10) return '+91' + d
  if (d.length === 12 && d.startsWith('91')) return '+' + d
  return null
}

function resendEmail({ apiKey, from }) {
  return async ({ to, subject, text }) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    })
    if (!res.ok) throw new Error('Email provider returned ' + res.status)
  }
}

function twilioSms({ sid, token, from }) {
  const auth = 'Basic ' + Buffer.from(sid + ':' + token).toString('base64')
  return async ({ to, text }) => {
    const res = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: from, Body: text }),
    })
    if (!res.ok) throw new Error('SMS provider returned ' + res.status)
  }
}

/** Keeps messages in the environment's own store instead of sending them. */
export function outboxDelivery(store) {
  const put = (channel) => async (msg) => {
    const entry = { id: 'MSG-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), channel, at: new Date().toISOString(), ...msg }
    await store.update(OUTBOX_KEY, (cur) => [entry, ...(cur || []).filter((m) => Date.now() - Date.parse(m.at) < OUTBOX_TTL_MS)].slice(0, OUTBOX_MAX))
  }
  return {
    kind: 'outbox',
    channels: { email: true, sms: true },
    email: put('email'),
    sms: put('sms'),
    read: async () => ((await store.get(OUTBOX_KEY)) || []).filter((m) => Date.now() - Date.parse(m.at) < OUTBOX_TTL_MS),
  }
}

/** Real providers from the environment; a channel without settings is off. */
export function providerDelivery(env = {}) {
  const email = env.RESEND_API_KEY && env.MAIL_FROM ? resendEmail({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM }) : null
  const sms = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM
    ? twilioSms({ sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN, from: env.TWILIO_FROM }) : null
  return { kind: 'providers', channels: { email: !!email, sms: !!sms }, email, sms }
}

/** Providers when configured, otherwise the outbox (for test and local use). */
export function deliveryFor(env, store, { allowOutbox }) {
  const real = providerDelivery(env)
  if (real.channels.email || real.channels.sms || !allowOutbox) return real
  return outboxDelivery(store)
}
