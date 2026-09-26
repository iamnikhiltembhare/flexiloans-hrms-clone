// Password hashing and signed session tokens, using only node:crypto.

import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
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

/** A compact HMAC-signed token: base64url(json).signature */
export function issueToken(username, secret) {
  const body = b64url(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S }))
  return body + '.' + sign(body, secret)
}

/** The username a token was issued to, or null if it is forged or expired. */
export function readToken(token, secret) {
  const [body, sig] = String(token || '').split('.')
  if (!body || !sig) return null
  const expected = Buffer.from(sign(body, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const { sub, exp } = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (typeof sub !== 'string' || !(exp > Date.now() / 1000)) return null
    return sub
  } catch {
    return null
  }
}
