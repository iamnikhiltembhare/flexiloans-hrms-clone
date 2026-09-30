// Standalone API server: `npm run server`.
// Stores data in SQLite (server/data/hrms.db by default). Suitable for local
// development and for hosts with a persistent disk, such as Render.
//
//   PORT                 default 8787
//   HRMS_DB              path to the SQLite file
//   HRMS_TOKEN_SECRET    32+ random characters; required in production
//   HRMS_ALLOWED_ORIGINS comma-separated extra origins allowed by CORS
//   HRMS_APP_URL         web app address used in password-reset links
//   RESEND_API_KEY, MAIL_FROM                          email codes and links
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM SMS codes
//   HRMS_DEV_OUTBOX=true keep messages in an outbox instead (local testing only)

import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ORIGINS } from './app.js'
import { createEnvironments } from './environments.js'
import { sqliteStore } from './store-sqlite.js'

const port = Number(process.env.PORT) || 8787
const dbFile = process.env.HRMS_DB || fileURLToPath(new URL('./data/hrms.db', import.meta.url))

let secret = process.env.HRMS_TOKEN_SECRET
if (!secret) {
  if (process.env.NODE_ENV === 'production') throw new Error('Set HRMS_TOKEN_SECRET before starting in production')
  secret = randomBytes(32).toString('hex')
  console.warn('HRMS_TOKEN_SECRET not set - using a random one; sessions end when the server restarts.')
}

const extra = (process.env.HRMS_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
// Production data in HRMS_DB; the /test/api environment in a sibling file.
const handle = createEnvironments({
  makeStore: (name) => sqliteStore(name === 'hrms' ? dbFile : dbFile.replace(/(\.db)?$/, '-test.db')),
  secret,
  allowedOrigins: [...DEFAULT_ORIGINS, ...extra],
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  env: process.env,
})

createServer(async (req, res) => {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const request = new Request('http://' + (req.headers.host || 'localhost') + req.url, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  })
  const response = await handle(request)
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
}).listen(port, () => console.log('HRMS API listening on http://localhost:' + port + ' (db: ' + dbFile + ')'))
