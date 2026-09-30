// Account recovery: forgotten password, forgotten username, or both.
//
//   GET  /api/auth/recovery/options   which channels this server can send on
//   POST /api/auth/recovery/start     { identifier, channel, purpose } -> { requestId }
//   POST /api/auth/recovery/verify    { requestId, code }  -> { ticket, username }
//   POST /api/auth/recovery/link      { token }            -> { ticket, username }
//   POST /api/auth/recovery/complete  { ticket, password?, username? }
//
// Signed in:
//   GET  /api/auth/security           masked contact details, last change
//   POST /api/auth/password           { current, password } -> { token }
//   POST /api/auth/phone/start        { phone } -> { requestId }   verify a recovery mobile
//   POST /api/auth/phone/confirm      { requestId, code }
//
// How it is kept safe:
//   - Codes are 6 digits from a secure random source; links and tickets carry
//     256 random bits. Only keyed hashes are stored, never the values sent.
//   - Codes expire after 10 minutes, links after 30, tickets after 15. Each is
//     single-use, and a code allows 5 tries before it is void.
//   - Starting recovery answers the same way whether or not an account
//     matched, so it cannot be used to find out who has an account.
//   - Rate limits per identifier, per account and per client address, a
//     60-second resend wait, and a 1-hour recovery lock after repeated wrong
//     codes on one account.
//   - A reset ends every existing session, clears the sign-in lock, and the
//     person is told on every channel they have, so an unexpected change is
//     noticed straight away. Every step is in the audit log, with no secrets.

import { HttpError } from './rules.js'
import { newOtp, newSecret, hashSecret, sameHash, passwordProblem, hashPassword, verifyPassword, issueToken } from './auth.js'
import { toE164 } from './delivery.js'
import { BRAND } from '../src/lib/brand.js'

export const OTP_TTL_MS = 10 * 60 * 1000
export const LINK_TTL_MS = 30 * 60 * 1000
const TICKET_TTL_MS = 15 * 60 * 1000
const MAX_CODE_TRIES = 5
const RESEND_WAIT_MS = 60 * 1000
const ACCOUNT_FAILS = 10
const ACCOUNT_LOCK_MS = 60 * 60 * 1000
const MINUTE = 60 * 1000

const PURPOSES = ['password', 'username', 'both']
const USERNAME = /^[a-z][a-z0-9._-]{2,39}$/

const bad = (msg) => { throw new HttpError(400, msg) }
const tooMany = (msg) => { throw new HttpError(429, msg) }

/** "nikhil.tembhare@flexiloans.com" -> "ni•••••@flexiloans.com"; "+919820031009" -> "+91 ••••• ••009". */
export const maskEmail = (e) => { const [u, d] = String(e || '').split('@'); return d ? u.slice(0, 2) + '•'.repeat(Math.max(3, u.length - 2)) + '@' + d : '' }
export const maskPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 10 ? '+' + d.slice(0, d.length - 10) + ' ••••• ••' + d.slice(-3) : '' }

/** The client's address, as the host reports it; used only for rate limits. */
const clientOf = (req) => req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local'

export function createRecovery({ store, secret, users, updateUser, renameUser, delivery, appUrl, publicUser, notify, audit, readBody, actorRecord, takenNames }) {
  const h = (v) => hashSecret(v, secret)

  // --- rate limiting ---------------------------------------------------------
  // Keys are hashed, so the store never holds emails or numbers as key names.
  async function limit(key, max, windowMs, message) {
    const now = Date.now()
    let blocked = false
    await store.update('rl/' + h(key), (cur) => {
      const hits = (cur?.hits || []).filter((t) => now - t < windowMs)
      if (hits.length >= max) { blocked = true; return { hits } }
      return { hits: [...hits, now] }
    })
    if (blocked) tooMany(message || 'Too many attempts. Please wait a few minutes and try again.')
  }

  // --- who is asking ---------------------------------------------------------
  const contactsOf = (u) => ({
    email: u.profile?.email && /@/.test(u.profile.email) ? u.profile.email.toLowerCase() : null,
    phone: u.recoveryPhone || toE164(u.profile?.phone),
  })

  /** An account by username, work email or registered mobile number. */
  async function findAccount(identifier) {
    const raw = String(identifier || '').trim().toLowerCase()
    if (!raw) return null
    const list = await users()
    const phone = /^[+\d][\d\s-]{8,}$/.test(raw) ? toE164(raw) : null
    return list.find((u) => u.username === raw) ||
      list.find((u) => contactsOf(u).email === raw) ||
      (phone && list.find((u) => contactsOf(u).phone === phone)) || null
  }

  const brand = BRAND.company + ' HRMS'
  const send = async (channel, to, subject, text) => {
    if (!to || !delivery.channels[channel]) return false
    try { await delivery[channel]({ to, subject, text }); return true } catch (err) {
      // Never log the message itself - it holds a code.
      console.error('Recovery message could not be sent on ' + channel + ':', err.message)
      return false
    }
  }

  /** Tell the person on every channel they have that their account changed. */
  async function tellOfChange(u, what) {
    const c = contactsOf(u)
    const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
    const text = brand + ': your ' + what + ' was changed on ' + when + ' IST. If this was not you, contact HR immediately to secure your account.'
    await Promise.all([send('email', c.email, 'Your ' + what + ' was changed', text), send('sms', c.phone, null, text)])
    await notify(u.username, { title: 'Your ' + what + ' was changed', detail: when + ' IST - if this was not you, contact HR straight away', to: '/profile', kind: 'alert' })
  }

  // --- routes ------------------------------------------------------------------

  async function options() {
    return { channels: delivery.channels, link: !!(delivery.channels.email && appUrl), otpMinutes: OTP_TTL_MS / MINUTE, linkMinutes: LINK_TTL_MS / MINUTE }
  }

  async function start(req) {
    const b = await readBody(req)
    const identifier = String(b.identifier || '').trim().slice(0, 120)
    const channel = ['email', 'sms'].includes(b.channel) ? b.channel : bad('Choose how to receive the code: email or SMS')
    const purpose = PURPOSES.includes(b.purpose) ? b.purpose : 'password'
    if (!identifier) bad('Enter your username, work email or registered mobile number')
    if (!delivery.channels[channel]) bad(channel === 'sms' ? 'SMS codes are not available right now. Choose email, or contact HR.' : 'Email is not available right now. Choose SMS, or contact HR.')

    const client = clientOf(req)
    await limit('start-ip:' + client, 20, 60 * MINUTE, 'Too many recovery requests from this device. Try again in an hour.')
    await limit('start-id:' + identifier.toLowerCase(), 3, 15 * MINUTE, 'Too many codes requested for this account. Wait 15 minutes, then try again.')

    // The resend wait is per identifier typed, known or not, so it reveals nothing.
    const now = Date.now()
    const lastKey = 'rlast/' + h(identifier.toLowerCase())
    const last = await store.get(lastKey)
    if (last && now - last < RESEND_WAIT_MS) tooMany('Please wait a minute before asking for another code.')
    await store.set(lastKey, now)

    let account = await findAccount(identifier)
    // A locked account is treated like an unknown one: no code is sent.
    if (account && (await store.get('rlock/' + account.username))?.until > now) account = null

    // Unknown identifiers get a decoy request that can never succeed, so the
    // answer - and the next step - look exactly the same.
    const requestId = newSecret()
    const code = newOtp()
    const to = account ? contactsOf(account)[channel === 'sms' ? 'phone' : 'email'] : null
    const withLink = channel === 'email' && !!appUrl && !!to
    const token = withLink ? newSecret() : null
    await store.set('recovery/' + h(requestId), {
      username: account && to ? account.username : null, purpose, channel,
      codeHash: h(code), linkHash: token ? h(token) : null,
      expiresAt: now + OTP_TTL_MS, linkExpiresAt: token ? now + LINK_TTL_MS : 0, tries: 0, used: false, createdAt: now,
    })
    if (token) await store.set('recovery-link/' + h(token), { request: h(requestId), expiresAt: now + LINK_TTL_MS })

    if (account && to) {
      const need = purpose === 'username' ? 'recover your username' : purpose === 'both' ? 'recover your username and reset your password' : 'reset your password'
      if (channel === 'sms') {
        await send('sms', to, null, brand + ': ' + code + ' is your code to ' + need + '. It expires in 10 minutes. Never share it - HR will never ask for it.')
      } else {
        const link = token ? appUrl.replace(/\/+$/, '') + '/#/recover?token=' + token : null
        await send('email', to, 'Your ' + brand + ' recovery code',
          'We received a request to ' + need + '.\n\nYour code: ' + code + ' (expires in 10 minutes)\n' +
          (link ? '\nOr open this link to continue (expires in 30 minutes, works once):\n' + link + '\n' : '') +
          '\nNever share this code - HR will never ask for it. If you did not ask for this, you can ignore this email; your account is unchanged.')
      }
      await audit({ name: account.profile?.name || account.username, username: account.username, role: account.role }, 'recovery.start', channel, 'recovery')
    }
    return {
      requestId, channel, expiresInSec: OTP_TTL_MS / 1000, resendInSec: RESEND_WAIT_MS / 1000,
      message: channel === 'sms'
        ? 'If those details match an account with a registered mobile number, we have sent a 6-digit code by SMS.'
        : 'If those details match an account, we have sent a 6-digit code' + (appUrl ? ' and a recovery link' : '') + ' to its work email.',
    }
  }

  /** A single-use ticket that allows the password or username to be changed. */
  async function issueTicket(username, purpose) {
    const ticket = newSecret()
    await store.set('recovery-ticket/' + h(ticket), { username, purpose, expiresAt: Date.now() + TICKET_TTL_MS, used: false })
    // Identity is proven at this point; the name lets the screen check the new password the same way the server will.
    const name = (await users()).find((u) => u.username === username)?.profile?.name || ''
    return { ticket, username, name, purpose, expiresInSec: TICKET_TTL_MS / 1000 }
  }

  async function failOnAccount(username) {
    if (!username) return
    const now = Date.now()
    const { hits } = await store.update('rfail/' + username, (cur) => ({ hits: [...(cur?.hits || []).filter((t) => now - t < ACCOUNT_LOCK_MS), now] }))
    if (hits.length >= ACCOUNT_FAILS) await store.set('rlock/' + username, { until: now + ACCOUNT_LOCK_MS })
  }

  async function verify(req) {
    const b = await readBody(req)
    await limit('verify-ip:' + clientOf(req), 30, 15 * MINUTE)
    const code = String(b.code || '').replace(/\s/g, '')
    if (!/^\d{6}$/.test(code)) bad('Enter the 6-digit code')
    const key = 'recovery/' + h(String(b.requestId || ''))
    const now = Date.now()
    const pending = await store.get(key)
    if (pending?.username && (await store.get('rlock/' + pending.username))?.until > now) {
      tooMany('Recovery for this account is paused after too many wrong codes. Try again in an hour or contact HR.')
    }
    let outcome = 'unknown'
    let record = null
    await store.update(key, (cur) => {
      if (!cur) return cur
      record = cur
      if (cur.used || cur.tries >= MAX_CODE_TRIES) { outcome = 'spent'; return cur }
      if (now > cur.expiresAt) { outcome = 'expired'; return cur }
      if (cur.username && sameHash(cur.codeHash, h(code))) { outcome = 'ok'; return { ...cur, used: true, tries: cur.tries + 1 } }
      outcome = 'wrong'
      return { ...cur, tries: cur.tries + 1, used: cur.tries + 1 >= MAX_CODE_TRIES }
    })
    if (outcome === 'unknown' || outcome === 'spent') bad('This code can no longer be used. Ask for a new one.')
    if (outcome === 'expired') bad('This code has expired. Ask for a new one.')
    if (outcome === 'wrong') {
      await failOnAccount(record.username)
      const left = MAX_CODE_TRIES - record.tries - 1
      bad(left > 0 ? 'That code is not right. ' + left + ' attempt' + (left === 1 ? '' : 's') + ' left.' : 'That code is not right, and it can no longer be used. Ask for a new one.')
    }
    if (record.linkHash) await store.set('recovery-link/' + record.linkHash, null) // the link dies with the code
    return issueTicket(record.username, record.purpose)
  }

  async function link(req) {
    const b = await readBody(req)
    await limit('link-ip:' + clientOf(req), 30, 15 * MINUTE)
    const now = Date.now()
    let entry = null
    await store.update('recovery-link/' + h(String(b.token || '')), (cur) => { entry = cur; return cur ? null : cur }) // single use
    if (!entry || now > entry.expiresAt) bad('This recovery link has expired or was already used. Ask for a new one.')
    let record = null
    await store.update('recovery/' + entry.request, (cur) => { record = cur; return cur ? { ...cur, used: true } : cur })
    if (!record?.username || record.used) bad('This recovery link has expired or was already used. Ask for a new one.')
    return issueTicket(record.username, record.purpose)
  }

  async function complete(req) {
    const b = await readBody(req)
    await limit('complete-ip:' + clientOf(req), 30, 15 * MINUTE)
    const wantsPassword = typeof b.password === 'string' && b.password !== ''
    const wantsName = typeof b.username === 'string' && b.username.trim() !== ''
    if (!wantsPassword && !wantsName) bad('Enter a new password or a new username')

    // Check the ticket without spending it, so a weak password can be fixed.
    const key = 'recovery-ticket/' + h(String(b.ticket || ''))
    const t = await store.get(key)
    if (!t || t.used || Date.now() > t.expiresAt) bad('This recovery session has expired. Please start again.')
    const account = (await users()).find((u) => u.username === t.username)
    if (!account) bad('This recovery session has expired. Please start again.')

    const newName = wantsName ? b.username.trim().toLowerCase() : null
    if (newName && newName !== account.username) {
      if (!USERNAME.test(newName)) bad('A username is 3-40 characters: lowercase letters, numbers, dots, dashes or underscores, starting with a letter')
      if (await takenNames(newName)) bad('That username is taken. Try another.')
    }
    if (wantsPassword) {
      const problem = passwordProblem(b.password, { username: newName || account.username, name: account.profile?.name })
      if (problem) bad(problem)
      if (await verifyPassword(b.password, account.passwordHash)) bad('Choose a password you have not used for this account')
    }

    let spent = false
    await store.update(key, (cur) => { if (!cur || cur.used) { spent = true; return cur } return { ...cur, used: true } })
    if (spent) bad('This recovery session was already used. Please start again.')

    let username = account.username
    const changed = []
    if (wantsPassword) {
      const passwordHash = await hashPassword(b.password)
      await updateUser(username, (u) => ({ ...u, passwordHash, passwordChangedAt: Date.now(), sessionVersion: (u.sessionVersion || 0) + 1 }))
      await store.set('lock/' + username, { failures: 0, until: 0 })
      changed.push('password')
    }
    if (newName && newName !== username) {
      await renameUser(username, newName)
      username = newName
      changed.push('username')
    }
    const after = (await users()).find((u) => u.username === username)
    if (changed.length) {
      await tellOfChange(after, changed.join(' and '))
      await audit({ name: after.profile?.name || username, username, role: after.role }, 'recovery.complete', changed.join('+'), 'recovery')
    }
    return {
      ok: true, username,
      message: changed.length === 2 ? 'Your username and password have been changed. Sign in with your new details.'
        : changed[0] === 'username' ? 'Your username is now ' + username + '. Sign in with it and your existing password.'
          : 'Your password has been reset. Sign in with your new password.',
    }
  }

  // --- signed-in security settings -----------------------------------------------

  async function security(req) {
    const u = await actorRecord(req)
    const c = contactsOf(u)
    return { email: maskEmail(c.email), phone: maskPhone(c.phone), phoneVerified: !!u.recoveryPhone, passwordChangedAt: u.passwordChangedAt || null, channels: delivery.channels }
  }

  async function changePassword(req) {
    const u = await actorRecord(req)
    const b = await readBody(req)
    await limit('pw:' + u.username, 5, 15 * MINUTE, 'Too many attempts. Try again in 15 minutes.')
    if (!(await verifyPassword(b.current, u.passwordHash))) bad('Your current password is not right')
    const problem = passwordProblem(b.password, { username: u.username, name: u.profile?.name })
    if (problem) bad(problem)
    if (b.password === b.current) bad('The new password must be different from the current one')
    const passwordHash = await hashPassword(b.password)
    const version = (u.sessionVersion || 0) + 1
    await updateUser(u.username, (x) => ({ ...x, passwordHash, passwordChangedAt: Date.now(), sessionVersion: version }))
    await tellOfChange(u, 'password')
    await audit({ name: u.profile?.name, username: u.username, role: u.role }, 'password.change', '', 'app')
    // Other sessions are signed out; this one gets a fresh token.
    return { token: issueToken(u.username, secret, version), user: publicUser(u), message: 'Password changed. You have been signed out everywhere else.' }
  }

  async function phoneStart(req) {
    const u = await actorRecord(req)
    const b = await readBody(req)
    const phone = toE164(b.phone) || bad('Enter a mobile number like +91 98200 12345')
    if (!delivery.channels.sms) bad('SMS is not available right now, so the number cannot be verified. Contact HR.')
    await limit('phone:' + u.username, 3, 15 * MINUTE, 'Too many codes requested. Wait 15 minutes, then try again.')
    const requestId = newSecret()
    const code = newOtp()
    await store.set('phone-verify/' + h(requestId), { username: u.username, phone, codeHash: h(code), expiresAt: Date.now() + OTP_TTL_MS, tries: 0, used: false })
    await send('sms', phone, null, brand + ': ' + code + ' is your code to verify this number for account recovery. It expires in 10 minutes.')
    return { requestId, message: 'We have sent a 6-digit code to ' + maskPhone(phone) + '.', expiresInSec: OTP_TTL_MS / 1000 }
  }

  async function phoneConfirm(req) {
    const u = await actorRecord(req)
    const b = await readBody(req)
    const code = String(b.code || '').replace(/\s/g, '')
    if (!/^\d{6}$/.test(code)) bad('Enter the 6-digit code')
    let outcome = 'unknown'
    let rec = null
    await store.update('phone-verify/' + h(String(b.requestId || '')), (cur) => {
      if (!cur || cur.username !== u.username) return cur
      rec = cur
      if (cur.used || cur.tries >= MAX_CODE_TRIES) { outcome = 'spent'; return cur }
      if (Date.now() > cur.expiresAt) { outcome = 'expired'; return cur }
      if (sameHash(cur.codeHash, h(code))) { outcome = 'ok'; return { ...cur, used: true } }
      outcome = 'wrong'
      return { ...cur, tries: cur.tries + 1 }
    })
    if (outcome === 'unknown' || outcome === 'spent') bad('This code can no longer be used. Ask for a new one.')
    if (outcome === 'expired') bad('This code has expired. Ask for a new one.')
    if (outcome === 'wrong') bad('That code is not right. ' + (MAX_CODE_TRIES - rec.tries - 1) + ' attempts left.')
    await updateUser(u.username, (x) => ({ ...x, recoveryPhone: rec.phone }))
    await tellOfChange({ ...u, recoveryPhone: rec.phone }, 'recovery mobile number')
    await audit({ name: u.profile?.name, username: u.username, role: u.role }, 'recovery.phone', maskPhone(rec.phone), 'app')
    return { ok: true, phone: maskPhone(rec.phone), message: 'Verified. ' + maskPhone(rec.phone) + ' can now be used to recover your account.' }
  }

  return {
    'GET /api/auth/recovery/options': options,
    'POST /api/auth/recovery/start': start,
    'POST /api/auth/recovery/verify': verify,
    'POST /api/auth/recovery/link': link,
    'POST /api/auth/recovery/complete': complete,
    'GET /api/auth/security': security,
    'POST /api/auth/password': changePassword,
    'POST /api/auth/phone/start': phoneStart,
    'POST /api/auth/phone/confirm': phoneConfirm,
  }
}
