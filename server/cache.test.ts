import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// Must be set before the module is imported: cache.ts opens the database at load time.
const DB = join(mkdtempSync(join(tmpdir(), 'shoplet-cache-')), 'test.db')
process.env.CACHE_DB = DB
const cache = await import('./cache.ts')

// Second handle on the same file: get() filters expired rows out on its own, so counting
// rows is the only way to tell "not served" apart from "actually swept".
const rows = (key: string) =>
  (new DatabaseSync(DB).prepare('SELECT COUNT(*) AS n FROM cache WHERE key = ?').get(key) as { n: number }).n

test('a miss is null, not undefined or a throw', () => {
  assert.equal(cache.get('nothing here'), null)
})

test('values survive the JSON round trip', () => {
  const payload = { query: 'velas', shops: [{ name: 'Velas LP', rating: 4.8, web: null, sources: ['maps'] }] }
  cache.set('k', payload)
  assert.deepEqual(cache.get('k'), payload)
})

test('a second write to the same key replaces it instead of failing on the primary key', () => {
  cache.set('dupe', { n: 1 })
  cache.set('dupe', { n: 2 })
  assert.deepEqual(cache.get('dupe'), { n: 2 })
})

test('expired entries are neither served nor kept', () => {
  cache.set('stale', { n: 1 }, -1) // already expired
  assert.equal(cache.get('stale'), null, 'an expired row must not be served')

  cache.set('fresh', { n: 1 }) // any write sweeps expired rows
  assert.equal(rows('stale'), 0, 'and must be deleted from the table by the next write')
  assert.equal(rows('fresh'), 1, 'the sweep must not take live rows with it')
  assert.deepEqual(cache.get('fresh'), { n: 1 })
})

test('keys are exact: the provider name is part of them, so a near-miss must miss', () => {
  cache.set('serpapi|velas||ar', { n: 1 })
  assert.equal(cache.get('brave|velas||ar'), null)
  assert.equal(cache.get('serpapi|velas||mx'), null)
})
