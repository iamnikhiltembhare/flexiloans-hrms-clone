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
import { deliveryFor } from './delivery.js'
import { TEST_ACCOUNTS, TEST_PASSWORDS } from '../src/data/testAccounts.js'

const TEST_PREFIX = '/test'

const testLogins = TEST_ACCOUNTS.map((a) => ({ ...a, password: TEST_PASSWORDS[a.username] }))
const derive = (secret, label) => createHmac('sha256', secret).update('hrms-env:' + label).digest('base64url')

/**
 * `makeStore(name)` returns a store for that environment's data. `env` holds
 * the recovery settings: message providers (see delivery.js), HRMS_APP_URL
 * for reset links, HRMS_TEST_APP_URL for the test app's links, and
 * HRMS_DEV_OUTBOX=true to use an outbox in production (local development only).
 */
export function createEnvironments({ makeStore, secret, allowedOrigins, anthropicApiKey, env = {} }) {
  // One assistant for both environments; each still only sees its own data.
  const assistant = createAssistant({ apiKey: anthropicApiKey })
  const prodStore = makeStore('hrms')
  const testStore = makeStore('hrms-test')
  const prod = createApp({
    store: prodStore, secret, allowedOrigins, assistant,
    delivery: deliveryFor(env, prodStore, { allowOutbox: env.HRMS_DEV_OUTBOX === 'true' }),
    appUrl: env.HRMS_APP_URL || 'https://flexiloans-hrms-live.netlify.app',
  })
  // The test environment never sends real messages unless providers are set:
  // codes go to its outbox, readable by the test super admin.
  const test = createApp({
    store: testStore, secret: derive(secret, 'test'), allowedOrigins, accounts: testLogins, assistant,
    delivery: deliveryFor(env, testStore, { allowOutbox: true }),
    appUrl: env.HRMS_TEST_APP_URL || null,
  })

  return function handle(req) {
    const url = new URL(req.url)
    if (url.pathname === TEST_PREFIX + '/api' || url.pathname.startsWith(TEST_PREFIX + '/api/')) {
      url.pathname = url.pathname.slice(TEST_PREFIX.length)
      return test(new Request(url, req))
    }
    return prod(req)
  }
}
