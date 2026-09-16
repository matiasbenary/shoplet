import { LOCALES, DEFAULT_LOCALE, type LocaleKey } from './locales.ts'

const BASE = 'https://serpapi.com/search.json'

// ponytail: each IG profile costs 1 SerpApi credit. Hard cap — raise it if the
// budget allows, don't remove it.
export const MAX_IG_PROFILES = 5

export interface RawResult {
  source: 'google' | 'google-ig' | 'maps' | 'instagram'
  name: string
  url: string | null
  snippet: string
  address?: string | null
  phone?: string | null
  rating?: number | null
  reviews?: number | null
  bio?: string
  followers?: number | null
  external_url?: string | null
}

async function serpapi(params: Record<string, string | number>): Promise<any> {
  const url = new URL(BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  url.searchParams.set('api_key', process.env.SERPAPI_KEY ?? '')

  // ponytail: SerpApi can hang for minutes on some engines (instagram_profile is the
  // usual suspect). 30s per call, so the whole search stays under ~a minute.
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`SerpApi ${params.engine} ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.error) throw new Error(`SerpApi ${params.engine}: ${json.error}`)
  return json
}

/** Pulls IG handles out of Google results, deduped and capped. */
export function instagramHandles(googleResults: { url?: string | null }[]): string[] {
  const skip = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts'])
  const handles = new Set<string>()
  for (const r of googleResults) {
    const m = /instagram\.com\/([A-Za-z0-9._]+)/.exec(r.url ?? '')
    if (!m) continue
    const handle = m[1].toLowerCase()
    if (skip.has(handle)) continue
    handles.add(handle)
    if (handles.size === MAX_IG_PROFILES) break
  }
  return [...handles]
}

// --- normalization: all sources into one common shape -------------------

export function normalizeGoogle(json: any, source: 'google' | 'google-ig' = 'google'): RawResult[] {
  return (json.organic_results ?? []).map((r: any) => ({
    source,
    name: r.title,
    url: r.link,
    snippet: r.snippet ?? '',
  }))
}

export function normalizeMaps(json: any): RawResult[] {
  return (json.local_results ?? []).map((r: any) => ({
    source: 'maps' as const,
    name: r.title,
    url: r.website ?? r.link ?? null,
    snippet: [r.type, r.description].filter(Boolean).join('. '),
    address: r.address ?? null,
    phone: r.phone ?? null,
    rating: r.rating ?? null,
    reviews: r.reviews ?? null,
  }))
}

export function normalizeIgProfile(json: any): RawResult | null {
  const p = json.profile_results ?? json.profile ?? {}
  const handle = p.username ?? json.search_parameters?.profile_id
  if (!handle) return null
  return {
    source: 'instagram',
    name: p.full_name || handle,
    url: `https://www.instagram.com/${handle}`,
    snippet: (p.posts ?? []).slice(0, 3).map((post: any) => post.caption).filter(Boolean).join(' | ').slice(0, 400),
    bio: p.biography ?? p.bio ?? '',
    followers: p.followers ?? p.followers_count ?? null,
    external_url: p.external_url ?? p.website ?? null,
  }
}

/** The 3 searches + the IG profiles, normalized and flattened. */
export async function search(q: string, loc: string, localeKey: LocaleKey = DEFAULT_LOCALE): Promise<RawResult[]> {
  const locale = LOCALES[localeKey] ?? LOCALES[DEFAULT_LOCALE]
  const where = loc ? ` ${loc}` : ''
  const { hl, gl, google_domain } = locale

  // The IG link search must finish before the profile fetches start, but the
  // web and maps searches keep running alongside them.
  const web = serpapi({ engine: 'google', q: `${q} ${locale.buyTerm}${where}`, hl, gl, google_domain, num: 20 })
  const maps = serpapi({ engine: 'google_maps', q: `${q}${where}`, hl, gl, type: 'search' })
  // A no-op catch attached now keeps a failure during the IG fetches from becoming an
  // unhandled rejection; the real error still throws at the awaits below.
  web.catch(() => {})
  maps.catch(() => {})

  const igLinks = normalizeGoogle(
    await serpapi({ engine: 'google', q: `"${q}"${where} ${locale.shopTerms} site:instagram.com`, hl, gl, google_domain, num: 20 }),
    'google-ig',
  )

  const profiles = await Promise.all(
    instagramHandles(igLinks).map((h) =>
      serpapi({ engine: 'instagram_profile', profile_id: h })
        .then(normalizeIgProfile)
        // ponytail: one dead profile must not sink the whole search.
        .catch(() => null),
    ),
  )

  return [
    ...profiles.filter((p): p is RawResult => p !== null),
    ...normalizeMaps(await maps),
    ...normalizeGoogle(await web),
    ...igLinks,
  ]
}
