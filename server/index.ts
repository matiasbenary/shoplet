import express from 'express'
import type { UIMessage } from 'ai'
import { chat } from './chat.ts'
import { LOCALES, DEFAULT_LOCALE, isLocaleKey } from './locales.ts'

const app = express()
app.use(express.json())

// The chat is the whole API: the model decides when to search, and the findShops tool
// does it. Response is the AI SDK UI message stream, consumed by useChat.
app.post('/api/chat', async (req, res) => {
  const { messages, loc, locale } = req.body as { messages?: UIMessage[]; loc?: string; locale?: string }
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'missing messages[]' })
  // Trust boundary: locale reaches the SerpApi query, so it must be a known key.
  const key = String(locale ?? DEFAULT_LOCALE)
  if (!isLocaleKey(key)) {
    return res.status(400).json({ error: `unknown locale, expected one of: ${Object.keys(LOCALES).join(', ')}` })
  }

  try {
    const result = await chat(messages, String(loc ?? '').trim(), key)
    result.pipeUIMessageStreamToResponse(res)
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: (err as Error).message })
  }
})

app.get('/api/locales', (_req, res) => {
  res.json(Object.entries(LOCALES).map(([key, l]) => ({ key, label: l.label })))
})

const missing = ['SERPAPI_KEY', 'NEAR_AI_API_KEY'].filter((k) => !process.env[k])
if (missing.length) console.warn(`⚠️  missing env vars: ${missing.join(', ')} (see .env.example)`)

app.listen(3001, () => console.log('api http://localhost:3001'))
