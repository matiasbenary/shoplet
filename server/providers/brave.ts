import { LOCALES, type LocaleKey } from '../locales.ts'
import { queries, type RawResult, type SearchProvider } from '../search-provider.ts'

const BASE = 'https://api.search.brave.com/res/v1'

async function request(path: string, params: URLSearchParams): Promise<any> {
  const res = await fetch(`${BASE}${path}?${params}`, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY ?? '' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Brave Search ${path} ${res.status}: ${await res.text()}`)
  return res.json()
}

function webParams(query: string, localeKey: LocaleKey): URLSearchParams {
  const locale = LOCALES[localeKey]
  return new URLSearchParams({ q: query, count: '20', country: locale.gl, search_lang: locale.hl })
}

export function normalizeBraveWeb(json: any, source: 'web' | 'web-ig' = 'web'): RawResult[] {
  return (json.web?.results ?? []).map((result: any) => ({
    source,
    name: result.title,
    url: result.url ?? null,
    snippet: result.description ?? '',
  }))
}

export function normalizeBravePois(json: any): RawResult[] {
  return (json.results ?? json.locations?.results ?? []).map((result: any) => ({
    source: 'maps' as const,
    name: result.title,
    url: result.url ?? result.provider_url ?? null,
    snippet: result.description ?? (result.categories ?? []).join(', '),
    address: result.postal_address?.displayAddress ?? result.address ?? null,
    phone: result.contact?.telephone ?? null,
    rating: result.rating?.ratingValue ?? null,
    reviews: result.rating?.reviewCount ?? null,
  }))
}

async function localResults(query: string, localeKey: LocaleKey): Promise<RawResult[]> {
  const webResponse = await request('/web/search', webParams(query, localeKey))
  const locations = webResponse.locations?.results ?? []
  const ids = locations.map((result: any) => result.id).filter(Boolean).slice(0, 20)
  if (ids.length === 0) return normalizeBravePois(webResponse)

  const locale = LOCALES[localeKey]
  const params = new URLSearchParams({ search_lang: locale.hl, ui_lang: `${locale.hl}-${locale.gl.toUpperCase()}` })
  for (const id of ids) params.append('ids', id)
  try {
    return normalizeBravePois(await request('/local/pois', params))
  } catch {
    // The IDs are short-lived and enrichment can fail independently. The web
    // response still contains usable local results, so keep the search useful.
    return normalizeBravePois(webResponse)
  }
}

export const brave: SearchProvider = {
  name: 'brave',

  async search(query, location, localeKey) {
    const q = queries(query, location, localeKey)
    const [web, maps, instagram] = await Promise.all([
      request('/web/search', webParams(q.web, localeKey)),
      localResults(q.maps, localeKey),
      request('/web/search', webParams(q.ig, localeKey)),
    ])
    return [...maps, ...normalizeBraveWeb(web), ...normalizeBraveWeb(instagram, 'web-ig')]
  },
}
