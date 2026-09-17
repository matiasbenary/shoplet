import { z } from 'zod'
import { curate, type Shop } from './curate.ts'
import { search } from './serpapi.ts'
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
  const key = `${query}|${loc}|${locale}`.toLowerCase()
  const hit = cache.get<{ query: string; shops: Shop[] }>(key)
  if (hit) return hit

  const raw = await search(query, loc, locale)
  if (raw.length === 0) return { query, shops: [] }
  const payload = { query, shops: await curate(query, loc, raw) }
  cache.set(key, payload)
  return payload
}
