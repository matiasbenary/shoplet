import { LOCALES, DEFAULT_LOCALE } from './locales.js'

const BASE = 'https://serpapi.com/search.json'

// ponytail: each IG profile costs 1 SerpApi credit. Hard cap — raise it if the
// budget allows, don't remove it.
export const MAX_IG_PROFILES = 5

async function serpapi(params) {
  const url = new URL(BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('api_key', process.env.SERPAPI_KEY)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`SerpApi ${params.engine} ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.error) throw new Error(`SerpApi ${params.engine}: ${json.error}`)
  return json
}

/** Pulls IG handles out of Google results, deduped and capped. */
export function instagramHandles(googleResults) {
  const skip = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts'])
  const handles = []
  for (const r of googleResults) {
    const m = /instagram\.com\/([A-Za-z0-9._]+)/.exec(r.url ?? '')
    if (!m) continue
    const handle = m[1].toLowerCase()
    if (skip.has(handle) || handles.includes(handle)) continue
    handles.push(handle)
    if (handles.length === MAX_IG_PROFILES) break
  }
  return handles
}

// --- normalization: all sources into one common shape -------------------

export function normalizeGoogle(json, source = 'google') {
  return (json.organic_results ?? []).map((r) => ({
    source,
    name: r.title,
    url: r.link,
    snippet: r.snippet ?? '',
  }))
}

export function normalizeMaps(json) {
  return (json.local_results ?? []).map((r) => ({
    source: 'maps',
    name: r.title,
    url: r.website ?? r.link ?? null,
    snippet: [r.type, r.description].filter(Boolean).join('. '),
    address: r.address ?? null,
    phone: r.phone ?? null,
    rating: r.rating ?? null,
    reviews: r.reviews ?? null,
  }))
}

export function normalizeIgProfile(json) {
  const p = json.profile_results ?? json.profile ?? {}
  const handle = p.username ?? json.search_parameters?.profile_id
  if (!handle) return null
  return {
    source: 'instagram',
    name: p.full_name || handle,
    url: `https://www.instagram.com/${handle}`,
    snippet: (p.posts ?? []).slice(0, 3).map((post) => post.caption).filter(Boolean).join(' | ').slice(0, 400),
    bio: p.biography ?? p.bio ?? '',
    followers: p.followers ?? p.followers_count ?? null,
    external_url: p.external_url ?? p.website ?? null,
  }
}

/** The 3 searches + the IG profiles, normalized and flattened. */
export async function search(q, loc, localeKey = DEFAULT_LOCALE) {
  const locale = LOCALES[localeKey] ?? LOCALES[DEFAULT_LOCALE]
  const where = loc ? ` ${loc}` : ''
  const { hl, gl, google_domain } = locale

  const [ig, web, maps] = await Promise.all([
    serpapi({ engine: 'google', q: `"${q}"${where} ${locale.shopTerms} site:instagram.com`, hl, gl, google_domain, num: 20 }),
    serpapi({ engine: 'google', q: `${q} ${locale.buyTerm}${where}`, hl, gl, google_domain, num: 20 }),
    serpapi({ engine: 'google_maps', q: `${q}${where}`, hl, gl, type: 'search' }),
  ])

  const igLinks = normalizeGoogle(ig, 'google-ig')
  const handles = instagramHandles(igLinks)

  const profiles = await Promise.all(
    handles.map((h) =>
      serpapi({ engine: 'instagram_profile', profile_id: h })
        .then(normalizeIgProfile)
        // ponytail: one dead profile must not sink the whole search.
        .catch(() => null),
    ),
  )

  return [
    ...profiles.filter(Boolean),
    ...normalizeMaps(maps),
    ...normalizeGoogle(web),
    ...igLinks,
  ]
}
