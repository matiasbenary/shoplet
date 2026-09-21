import { LOCALES, type LocaleKey } from '../locales.ts'
import { queries, type RawResult, type SearchProvider } from '../search-provider.ts'

const BASE = 'https://serpapi.com/search.json'

// Each Instagram profile costs one SerpApi credit. Keep the enrichment bounded.
export const MAX_IG_PROFILES = 5

async function request(params: Record<string, string | number>): Promise<any> {
  const url = new URL(BASE)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
  url.searchParams.set('api_key', process.env.SERPAPI_KEY ?? '')

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`SerpApi ${params.engine} ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.error) throw new Error(`SerpApi ${params.engine}: ${json.error}`)
  return json
}

export function instagramHandles(results: { url?: string | null }[]): string[] {
  const skip = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts'])
  const handles = new Set<string>()
  for (const result of results) {
    const match = /instagram\.com\/([A-Za-z0-9._]+)/.exec(result.url ?? '')
    if (!match) continue
    const handle = match[1].toLowerCase()
    if (skip.has(handle)) continue
    handles.add(handle)
    if (handles.size === MAX_IG_PROFILES) break
  }
  return [...handles]
}

export function normalizeGoogle(json: any, source: 'web' | 'web-ig' = 'web'): RawResult[] {
  return (json.organic_results ?? []).map((result: any) => ({
    source,
    name: result.title,
    url: result.link,
    snippet: result.snippet ?? '',
  }))
}

export function normalizeMaps(json: any): RawResult[] {
  return (json.local_results ?? []).map((result: any) => ({
    source: 'maps' as const,
    name: result.title,
    url: result.website ?? result.link ?? null,
    snippet: [result.type, result.description].filter(Boolean).join('. '),
    address: result.address ?? null,
    phone: result.phone ?? null,
    rating: result.rating ?? null,
    reviews: result.reviews ?? null,
  }))
}

export function normalizeIgProfile(json: any): RawResult | null {
  const profile = json.profile_results ?? json.profile ?? {}
  const handle = profile.username ?? json.search_parameters?.profile_id
  if (!handle) return null
  return {
    source: 'instagram',
    name: profile.full_name || handle,
    url: `https://www.instagram.com/${handle}`,
    snippet: (profile.posts ?? []).slice(0, 3).map((post: any) => post.caption).filter(Boolean).join(' | ').slice(0, 400),
    bio: profile.biography ?? profile.bio ?? '',
    followers: profile.followers ?? profile.followers_count ?? null,
    external_url: profile.external_url ?? profile.website ?? null,
  }
}

export const serpapi: SearchProvider = {
  name: 'serpapi',

  async search(query, location, localeKey) {
    const { hl, gl, google_domain } = LOCALES[localeKey]
    const q = queries(query, location, localeKey)

    const web = request({ engine: 'google', q: q.web, hl, gl, google_domain, num: 20 })
    const maps = request({ engine: 'google_maps', q: q.maps, hl, gl, type: 'search' })
    // Kicked off now, awaited last: swallow here so a failure is not an unhandled rejection.
    web.catch(() => {})
    maps.catch(() => {})

    const instagramLinks = normalizeGoogle(
      await request({ engine: 'google', q: q.ig, hl, gl, google_domain, num: 20 }),
      'web-ig',
    )
    const profiles = await Promise.all(
      instagramHandles(instagramLinks).map((handle) =>
        request({ engine: 'instagram_profile', profile_id: handle }).then(normalizeIgProfile).catch(() => null),
      ),
    )

    return [
      ...profiles.filter((profile): profile is RawResult => profile !== null),
      ...normalizeMaps(await maps),
      ...normalizeGoogle(await web),
      ...instagramLinks,
    ]
  },
}
