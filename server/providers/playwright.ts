import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { LOCALES, type LocaleKey } from '../locales.ts'
import { queries, type RawResult, type SearchProvider } from '../search-provider.ts'

const TIMEOUT_MS = 30_000

let browserPromise: Promise<Browser> | undefined

function browser(): Promise<Browser> {
  // PLAYWRIGHT_HEADLESS=false to watch the scrape when a selector breaks.
  browserPromise ??= chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS !== 'false' }).catch((error) => {
    browserPromise = undefined
    throw error
  })
  return browserPromise
}

async function assertNotBlocked(page: Page): Promise<void> {
  const title = await page.title()
  const text = await page.locator('body').innerText().catch(() => '')
  const challenge = `${title}\n${text}`
  if (new URL(page.url()).pathname.startsWith('/sorry/') || /sorry|captcha|unusual traffic|tr[aá]fico inusual|tr[aá]fego incomum/i.test(challenge)) {
    throw new Error('Google blocked the Playwright search with a CAPTCHA or traffic challenge')
  }
}

function successfulResults(settled: PromiseSettledResult<RawResult[]>[]): RawResult[] {
  const results = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  if (results.length > 0) return results
  const errors = settled.flatMap((result) => result.status === 'rejected' ? [result.reason] : [])
  throw new AggregateError(errors, 'All Playwright search channels failed')
}

async function googleSearch(
  context: BrowserContext,
  query: string,
  localeKey: LocaleKey,
  source: 'web' | 'web-ig',
): Promise<RawResult[]> {
  const locale = LOCALES[localeKey]
  const url = new URL(`https://www.${locale.google_domain}/search`)
  url.search = new URLSearchParams({ q: query, hl: locale.hl, gl: locale.gl, num: '20' }).toString()

  const page = await context.newPage()
  try {
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS })
    await assertNotBlocked(page)
    await page.locator('#search h3').first().waitFor({ state: 'attached', timeout: TIMEOUT_MS })
    return await page.locator('#search a:has(h3)').evaluateAll((anchors, resultSource) => {
      const seen = new Set<string>()
      return anchors.flatMap((node) => {
        const anchor = node as HTMLAnchorElement
        const title = anchor.querySelector('h3')?.textContent?.trim()
        if (!title || !anchor.href || seen.has(anchor.href)) return []
        seen.add(anchor.href)
        const container = anchor.closest('.MjjYud') ?? anchor.parentElement?.parentElement
        const snippet = container?.querySelector('.VwiC3b')?.textContent?.trim() ?? ''
        return [{ source: resultSource, name: title, url: anchor.href, snippet }]
      })
    }, source)
  } finally {
    await page.close()
  }
}

async function googleMaps(context: BrowserContext, query: string, localeKey: LocaleKey): Promise<RawResult[]> {
  const locale = LOCALES[localeKey]
  const url = `https://www.${locale.google_domain}/maps/search/${encodeURIComponent(query)}?hl=${locale.hl}`
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS })
    await assertNotBlocked(page)
    await page.locator('a[href*="/maps/place/"]').first().waitFor({ state: 'attached', timeout: TIMEOUT_MS })
    return await page.locator('a[href*="/maps/place/"]').evaluateAll((anchors) => {
      const seen = new Set<string>()
      return anchors.flatMap((node) => {
        const anchor = node as HTMLAnchorElement
        const name = anchor.getAttribute('aria-label')?.trim()
        if (!name || seen.has(anchor.href)) return []
        seen.add(anchor.href)
        const card = anchor.closest('[role="article"]') ?? anchor.closest('.Nv2PK')
        const ratingLabel = card?.querySelector('[role="img"][aria-label*="star"], [role="img"][aria-label*="estrella"]')?.getAttribute('aria-label') ?? ''
        const rating = Number(ratingLabel.match(/[0-9]+(?:[.,][0-9]+)?/)?.[0]?.replace(',', '.'))
        return [{
          source: 'maps' as const,
          name,
          url: anchor.href,
          snippet: card?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 500) ?? '',
          rating: Number.isFinite(rating) ? rating : null,
        }]
      })
    })
  } finally {
    await page.close()
  }
}

export const playwright: SearchProvider = {
  name: 'playwright',

  async search(query, location, localeKey) {
    const q = queries(query, location, localeKey)
    const locale = LOCALES[localeKey]
    const instance = await browser()
    const context = await instance.newContext({ locale: `${locale.hl}-${locale.gl.toUpperCase()}` })
    try {
      return successfulResults(await Promise.allSettled([
        googleSearch(context, q.web, localeKey, 'web'),
        googleMaps(context, q.maps, localeKey),
        googleSearch(context, q.ig, localeKey, 'web-ig'),
      ]))
    } finally {
      await context.close()
    }
  },
}
