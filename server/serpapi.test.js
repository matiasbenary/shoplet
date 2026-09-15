import test from 'node:test'
import assert from 'node:assert/strict'
import { instagramHandles, normalizeGoogle, normalizeMaps, normalizeIgProfile, MAX_IG_PROFILES } from './serpapi.js'
import { LOCALES, DEFAULT_LOCALE } from './locales.js'

test('instagramHandles: dedupes, ignores non-profile paths and respects the cap', () => {
  const results = [
    { url: 'https://www.instagram.com/velas.lp/' },
    { url: 'https://www.instagram.com/VELAS.LP/?hl=es' }, // same handle, different casing
    { url: 'https://www.instagram.com/p/Cx123/' },        // a post, not a profile
    { url: 'https://www.instagram.com/reel/Cx999/' },
    { url: 'https://tiendanube.com/algo' },               // not IG
    ...Array.from({ length: 10 }, (_, i) => ({ url: `https://instagram.com/tienda${i}` })),
  ]
  const handles = instagramHandles(results)
  assert.equal(handles[0], 'velas.lp')
  assert.equal(new Set(handles).size, handles.length, 'must not repeat handles')
  assert.ok(handles.length <= MAX_IG_PROFILES, 'must not exceed the credit cap')
  assert.ok(!handles.some((h) => ['p', 'reel'].includes(h)))
})

test('all three sources come out with the common shape', () => {
  const g = normalizeGoogle({ organic_results: [{ title: 'Velas LP', link: 'https://x.com', snippet: 'velas' }] })
  const m = normalizeMaps({ local_results: [{ title: 'Deco Sur', address: 'Calle 7 123', phone: '221-555', rating: 4.8 }] })
  const i = normalizeIgProfile({
    profile_results: { username: 'velas.lp', full_name: 'Velas LP', biography: 'velas de soja', followers: 1200, posts: [{ caption: 'nuevo lote' }] },
  })

  for (const r of [g[0], m[0], i]) {
    assert.ok(r.source && r.name, 'every entry needs source and name')
    assert.equal(typeof r.snippet, 'string')
    assert.ok('url' in r)
  }
  assert.equal(m[0].url, null, 'Maps without a website leaves url null, not undefined')
  assert.equal(i.url, 'https://www.instagram.com/velas.lp')
  assert.equal(i.followers, 1200)
})

test('empty or malformed responses do not blow up', () => {
  assert.deepEqual(normalizeGoogle({}), [])
  assert.deepEqual(normalizeMaps({}), [])
  assert.equal(normalizeIgProfile({}), null)
})

test('every locale is complete: a typo here silently ruins a country\'s search', () => {
  assert.ok(LOCALES[DEFAULT_LOCALE], 'the default locale must exist')
  for (const [key, l] of Object.entries(LOCALES)) {
    for (const field of ['label', 'hl', 'gl', 'google_domain', 'shopTerms', 'buyTerm']) {
      assert.ok(l[field], `locale "${key}" is missing ${field}`)
    }
    assert.ok(!/\s/.test(l.google_domain), `locale "${key}" has a broken google_domain`)
  }
})
