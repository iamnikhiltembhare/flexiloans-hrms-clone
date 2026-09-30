// Password hashing and signed session tokens, using only node:crypto.

import { createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const KEY_LEN = 32
const TOKEN_TTL_S = 12 * 60 * 60

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scrypt(String(password), salt, KEY_LEN)
  return 'scrypt$' + salt.toString('base64') + '$' + key.toString('base64')
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = String(stored || '').split('$')
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false
  const expected = Buffer.from(keyB64, 'base64')
  const actual = await scrypt(String(password), Buffer.from(saltB64, 'base64'), expected.length)
  return timingSafeEqual(expected, actual)
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const sign = (data, secret) => createHmac('sha256', secret).update(data).digest('base64url')

/**
 * A compact HMAC-signed token: base64url(json).signature. `version` is the
 * account's session version; changing the password bumps it, which ends
 * every session issued before.
 */
export function issueToken(username, secret, version = 0) {
  const now = Math.floor(Date.now() / 1000)
  const body = b64url(JSON.stringify({ sub: username, v: version, iat: now, exp: now + TOKEN_TTL_S }))
  return body + '.' + sign(body, secret)
}

/** The username a token was issued to, or null if it is forged or expired. */
export function readToken(token, secret) {
  return readTokenClaims(token, secret)?.sub ?? null
}

/** { sub, v, iat } for a valid token, or null. */
export function readTokenClaims(token, secret) {
  const [body, sig] = String(token || '').split('.')
  if (!body || !sig) return null
  const expected = Buffer.from(sign(body, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const { sub, exp, iat, v } = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (typeof sub !== 'string' || !(exp > Date.now() / 1000)) return null
    return { sub, v: Number(v) || 0, iat: Number(iat) || 0 }
  } catch {
    return null
  }
}

// --- one-time secrets for account recovery ------------------------------

/** A 6-digit code from a cryptographically secure source. */
export const newOtp = () => String(randomInt(0, 1000000)).padStart(6, '0')

/** 256 random bits, URL-safe - for reset links and reset tickets. */
export const newSecret = () => randomBytes(32).toString('base64url')

/** Secrets are stored only as keyed hashes, never as they were sent. */
export const hashSecret = (value, secret) => createHmac('sha256', secret).update('hrms-recovery:' + String(value)).digest('base64url')

/** Constant-time comparison of two hashes. */
export function sameHash(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

// Password rules live with the app so the screens can check them too.
export { passwordProblem } from '../src/lib/passwords.js'
