import express from 'express'
import * as cache from './cache.js'
import { search } from './serpapi.js'
import { curate } from './curate.js'
import { LOCALES, DEFAULT_LOCALE } from './locales.js'

const app = express()

app.get('/api/search', async (req, res) => {
  const q = (req.query.q ?? '').trim()
  const loc = (req.query.loc ?? '').trim()
  const locale = (req.query.locale ?? DEFAULT_LOCALE).trim()
  if (!q) return res.status(400).json({ error: 'missing q parameter' })
  // Trust boundary: locale reaches the SerpApi query, so it must be a known key.
  if (!LOCALES[locale]) {
    return res.status(400).json({ error: `unknown locale, expected one of: ${Object.keys(LOCALES).join(', ')}` })
  }

  const key = `${q}|${loc}|${locale}`.toLowerCase()
  const hit = cache.get(key)
  if (hit) return res.json({ ...hit, cached: true })

  try {
    const raw = await search(q, loc, locale)
    if (raw.length === 0) return res.json({ q, loc, locale, shops: [], curated: true, cached: false })

    let payload
    try {
      payload = { q, loc, locale, shops: await curate(q, loc, raw), curated: true }
    } catch (err) {
      // ponytail: if the LLM fails, return the normalized raw results instead of a 500.
      console.error('curate failed, returning uncurated:', err.message)
      payload = {
        q,
        loc,
        locale,
        curated: false,
        shops: raw.map((r) => ({
          name: r.name,
          category: null,
          area: null,
          instagram: r.source === 'instagram' ? r.url : null,
          whatsapp: null,
          web: r.url,
          address: r.address ?? null,
          sells_online: null,
          sources: [r.source],
          reason: r.snippet,
        })),
      }
    }

    cache.set(key, payload)
    res.json({ ...payload, cached: false })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: err.message })
  }
})

const missing = ['SERPAPI_KEY', 'NEAR_AI_API_KEY'].filter((k) => !process.env[k])
if (missing.length) console.warn(`⚠️  missing env vars: ${missing.join(', ')} (see .env.example)`)

app.get('/api/locales', (_req, res) => {
  res.json(Object.entries(LOCALES).map(([key, l]) => ({ key, label: l.label })))
})

app.listen(3001, () => console.log('api http://localhost:3001'))
