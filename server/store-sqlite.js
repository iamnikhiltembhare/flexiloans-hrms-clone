// SQLite storage for the standalone Node server, via the built-in node:sqlite.
// Each key holds one JSON document; update() runs inside a write transaction.

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export function sqliteStore(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)')

  const getStmt = db.prepare('SELECT value FROM kv WHERE key = ?')
  const putStmt = db.prepare(
    "INSERT INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now')) " +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')

  const get = (key) => {
    const row = getStmt.get(key)
    return row ? JSON.parse(row.value) : undefined
  }
  const set = (key, value) => { putStmt.run(key, JSON.stringify(value)) }

  return {
    async get(key) { return get(key) },
    async set(key, value) { set(key, value) },
    async update(key, fn) {
      db.exec('BEGIN IMMEDIATE')
      try {
        const next = fn(get(key))
        set(key, next)
        db.exec('COMMIT')
        return next
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },
  }
}
