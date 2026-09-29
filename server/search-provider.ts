import { LOCALES, type LocaleKey } from './locales.ts'

// Provider-independent result channels. The provider itself is selected outside
// this contract, so downstream curation does not need to know vendor response shapes.
type SearchSource = 'web' | 'web-ig' | 'maps' | 'instagram'

export interface RawResult {
  source: SearchSource
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

export interface SearchProvider {
  readonly name: string
  search(query: string, location: string, locale: LocaleKey): Promise<RawResult[]>
  searchWeb(query: string, locale: LocaleKey): Promise<RawResult[]>
}

// The three channels every provider searches. Same wording for all of them, so a
// locale tweak lands everywhere at once instead of in three near-identical copies.
export function queries(query: string, location: string, localeKey: LocaleKey) {
  const { buyTerm, shopTerms } = LOCALES[localeKey]
  const where = location ? ` ${location}` : ''
  return {
    web: `${query} ${buyTerm}${where}`,
    maps: `${query}${where}`,
    ig: `"${query}"${where} ${shopTerms} site:instagram.com`,
  }
}

const NON_SHOP_HOSTS = /(^|\.)(amazon\.|mercadolibre\.|alibaba\.|shein\.|instagram\.|facebook\.|google\.)/

export function websiteProductQuery(query: string, results: RawResult[]): string | null {
  const hosts = new Set<string>()
  for (const result of results) {
    for (const value of [result.url, result.external_url]) {
      if (!value) continue
      try {
        const host = new URL(value).hostname.replace(/^www\./, '')
        if (!NON_SHOP_HOSTS.test(host)) hosts.add(host)
      } catch {}
      if (hosts.size === 5) break
    }
    if (hosts.size === 5) break
  }
  return hosts.size ? `${query} (${[...hosts].map((host) => `site:${host}`).join(' OR ')})` : null
}
