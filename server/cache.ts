import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'

// ponytail: node:sqlite is stdlib in Node 24 — no better-sqlite3, no redis.
// Path is anchored to the repo, not cwd: an MCP client launches us from anywhere.
// CACHE_DB overrides it so the tests never touch the real cache.
const db = new DatabaseSync(process.env.CACHE_DB || join(import.meta.dirname, '..', 'cache.db'))
db.exec(`CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires INTEGER NOT NULL
)`)

const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Prepared once, reused for every request.
const selectStmt = db.prepare('SELECT value FROM cache WHERE key = ? AND expires > ?')
const upsertStmt = db.prepare('INSERT OR REPLACE INTO cache (key, value, expires) VALUES (?, ?, ?)')
const purgeStmt = db.prepare('DELETE FROM cache WHERE expires <= ?')

// ponytail: expired rows are swept on write, not read — one statement instead of
// a per-miss DELETE. Add an index on expires if the table ever gets big.
export function get<T>(key: string): T | null {
  const row = selectStmt.get(key, Date.now()) as { value: string } | undefined
  return row ? (JSON.parse(row.value) as T) : null
}

export function set(key: string, value: unknown, ttlMs = TTL_MS): void {
  const now = Date.now()
  purgeStmt.run(now)
  upsertStmt.run(key, JSON.stringify(value), now + ttlMs)
}
