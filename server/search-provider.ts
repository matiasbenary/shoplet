import { LOCALES, type LocaleKey } from './locales.ts'

// Provider-independent result channels. The provider itself is selected outside
// this contract, so downstream curation does not need to know vendor response shapes.
export type SearchSource = 'web' | 'web-ig' | 'maps' | 'instagram'

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
