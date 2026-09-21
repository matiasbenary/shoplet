import { DEFAULT_LOCALE, type LocaleKey } from './locales.ts'
import { brave } from './providers/brave.ts'
import { playwright } from './providers/playwright.ts'
import { serpapi } from './providers/serpapi.ts'
import type { SearchProvider } from './search-provider.ts'

// ponytail: a record, not a factory. Three stateless providers, one is picked by env.
export const PROVIDERS = { serpapi, brave, playwright } satisfies Record<string, SearchProvider>

const configured = process.env.SEARCH_PROVIDER || 'serpapi'
if (!(configured in PROVIDERS)) {
  throw new Error(`Unknown SEARCH_PROVIDER "${configured}". Expected: ${Object.keys(PROVIDERS).join(', ')}`)
}

export const activeSearchProvider = PROVIDERS[configured as keyof typeof PROVIDERS]

export function search(query: string, location: string, locale: LocaleKey = DEFAULT_LOCALE) {
  return activeSearchProvider.search(query, location, locale)
}
