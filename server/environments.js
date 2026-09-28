// Two isolated environments behind one deployment:
//
//   /api/*       production - demo accounts, store "hrms"
//   /test/api/*  test       - test-only accounts, store "hrms-test"
//
// Each has its own data and its own token-signing key (derived from the one
// secret), so a token from one environment is rejected by the other.

import { createHmac } from 'node:crypto'
import { createApp } from './app.js'
import { createAssistant } from './assistant.js'
import { TEST_ACCOUNTS, TEST_PASSWORDS } from '../src/data/testAccounts.js'

const TEST_PREFIX = '/test'

const testLogins = TEST_ACCOUNTS.map((a) => ({ ...a, password: TEST_PASSWORDS[a.username] }))
const derive = (secret, label) => createHmac('sha256', secret).update('hrms-env:' + label).digest('base64url')

/** `makeStore(name)` returns a store for that environment's data. */
export function createEnvironments({ makeStore, secret, allowedOrigins, anthropicApiKey }) {
  // One assistant for both environments; each still only sees its own data.
  const assistant = createAssistant({ apiKey: anthropicApiKey })
  const prod = createApp({ store: makeStore('hrms'), secret, allowedOrigins, assistant })
  const test = createApp({ store: makeStore('hrms-test'), secret: derive(secret, 'test'), allowedOrigins, accounts: testLogins, assistant })

  return function handle(req) {
    const url = new URL(req.url)
    if (url.pathname === TEST_PREFIX + '/api' || url.pathname.startsWith(TEST_PREFIX + '/api/')) {
      url.pathname = url.pathname.slice(TEST_PREFIX.length)
      return test(new Request(url, req))
    }
    return prod(req)
  }
}
