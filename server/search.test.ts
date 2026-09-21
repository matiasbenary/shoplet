import test from 'node:test'
import assert from 'node:assert/strict'
import { instagramHandles, normalizeGoogle, normalizeMaps, normalizeIgProfile, MAX_IG_PROFILES } from './providers/serpapi.ts'
import { normalizeBravePois, normalizeBraveWeb } from './providers/brave.ts'
import { PROVIDERS } from './search.ts'
import { queries } from './search-provider.ts'
import { LOCALES, DEFAULT_LOCALE, type Locale } from './locales.ts'

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

  assert.ok(i, 'a profile with a username must normalize')
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

test('Brave web and POI responses normalize to the provider-independent shape', () => {
  const web = normalizeBraveWeb({ web: { results: [{ title: 'Tienda Norte', url: 'https://example.com', description: 'local shop' }] } })
  const maps = normalizeBravePois({ results: [{
    title: 'Tienda Sur', url: 'https://shop.example', description: 'Boutique',
    postal_address: { displayAddress: 'Calle 1' }, contact: { telephone: '123' },
    rating: { ratingValue: 4.7, reviewCount: 18 },
  }] })

  assert.equal(web[0].source, 'web')
  assert.deepEqual(maps[0], {
    source: 'maps', name: 'Tienda Sur', url: 'https://shop.example', snippet: 'Boutique',
    address: 'Calle 1', phone: '123', rating: 4.7, reviews: 18,
  })
})

test('every configured provider implements the shared contract', () => {
  for (const [key, provider] of Object.entries(PROVIDERS)) {
    assert.equal(provider.name, key, 'the record key must match the provider name: it is the cache key')
    assert.equal(typeof provider.search, 'function')
  }
})

test('queries: location is optional and never leaves a dangling space', () => {
  const withLoc = queries('velas', 'La Plata', 'ar')
  assert.equal(withLoc.maps, 'velas La Plata')
  assert.ok(withLoc.web.includes('comprar') && withLoc.web.includes('La Plata'))
  assert.ok(withLoc.ig.includes('site:instagram.com'))
  assert.equal(queries('velas', '', 'ar').maps, 'velas')
})

test('every locale is complete: a typo here silently ruins a country\'s search', () => {
  assert.ok(LOCALES[DEFAULT_LOCALE], 'the default locale must exist')
  for (const [key, l] of Object.entries<Locale>(LOCALES)) {
    for (const field of ['label', 'hl', 'gl', 'google_domain', 'shopTerms', 'buyTerm'] as (keyof Locale)[]) {
      assert.ok(l[field], `locale "${key}" is missing ${field}`)
    }
    assert.ok(!/\s/.test(l.google_domain), `locale "${key}" has a broken google_domain`)
  }
})
