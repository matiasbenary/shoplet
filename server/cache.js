import { DatabaseSync } from 'node:sqlite'

// ponytail: node:sqlite is stdlib in Node 24 — no better-sqlite3, no redis.
const db = new DatabaseSync('cache.db')
db.exec(`CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires INTEGER NOT NULL
)`)

const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function get(key) {
  const row = db.prepare('SELECT value, expires FROM cache WHERE key = ?').get(key)
  if (!row) return null
  if (row.expires < Date.now()) {
    db.prepare('DELETE FROM cache WHERE key = ?').run(key)
    return null
  }
  return JSON.parse(row.value)
}

export function set(key, value) {
  db.prepare('INSERT OR REPLACE INTO cache (key, value, expires) VALUES (?, ?, ?)')
    .run(key, JSON.stringify(value), Date.now() + TTL_MS)
}
