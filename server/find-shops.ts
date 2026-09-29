import { z } from 'zod'
import { curate, type Shop } from './curate.ts'
import { activeSearchProvider, search, searchWeb } from './search.ts'
import { websiteProductQuery } from './search-provider.ts'
import * as cache from './cache.ts'
import { LOCALES, DEFAULT_LOCALE, type LocaleKey } from './locales.ts'

// The one place the search lives. The chat tool, the HTTP endpoint and the MCP
// server are three thin wrappers around this — same schema, same cache.
export const findShopsInput = z.object({
  query: z.string().describe("the product to look for, in the user's language"),
  loc: z.string().default('').describe('city or area, e.g. "Buenos Aires"'),
  locale: z.enum(Object.keys(LOCALES) as [LocaleKey, ...LocaleKey[]]).default(DEFAULT_LOCALE),
})

export async function findShops(
  query: string,
  loc = '',
  locale: LocaleKey = DEFAULT_LOCALE,
): Promise<{ query: string; shops: Shop[] }> {
  const key = `${activeSearchProvider.name}|${query}|${loc}|${locale}`.toLowerCase()
  const hit = cache.get<{ query: string; shops: Shop[] }>(key)
  if (hit) return hit

  const raw = await search(query, loc, locale)
  if (raw.length === 0) return { query, shops: [] }
  const websiteQuery = websiteProductQuery(query, raw)
  const websiteResults = websiteQuery ? await searchWeb(websiteQuery, locale).catch(() => []) : []
  const payload = { query, shops: await curate(query, loc, [...raw, ...websiteResults]) }
  cache.set(key, payload)
  return payload
}
