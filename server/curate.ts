import { generateObject } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'
import type { RawResult } from './serpapi.ts'

// The schema is the contract: the AI SDK enforces it, so no hand-parsing of JSON.
const shopSchema = z.object({
  name: z.string(),
  category: z.string().nullable(),
  area: z.string().nullable(),
  instagram: z.string().nullable(),
  whatsapp: z.string().nullable(),
  web: z.string().nullable(),
  address: z.string().nullable(),
  sells_online: z.boolean().nullable(),
  sources: z.array(z.string()),
  reason: z.string(),
})

export type Shop = z.infer<typeof shopSchema>

// NEAR AI Cloud is OpenAI-compatible: same protocol, different baseURL.
export const nearai = createOpenAICompatible({
  name: 'near-ai',
  baseURL: 'https://cloud-api.near.ai/v1',
  apiKey: process.env.NEAR_AI_API_KEY,
  // Without this the SDK downgrades to plain json_object and the model drifts off-schema.
  supportsStructuredOutputs: true,
})

export const MODEL = process.env.NEAR_AI_MODEL || 'deepseek-ai/DeepSeek-V3.1'

const SYSTEM = `You curate results for a search engine focused on small shops and independent businesses.
You receive raw results from Google, Google Maps and Instagram about a product, and you do FOUR things in a single pass:

1. FILTER: drop big chains, marketplaces (Amazon, Mercado Libre, Alibaba, Shein), supermarkets,
   blogs, news articles, aggregators, directories, and anything that is not a real small business.
2. DEDUPLICATE: if the same business shows up in several sources, merge it into ONE entry, combining its links.
3. EXTRACT: fill the fields using ONLY data present in the text you received.
4. RANK: order by how likely that business is to carry the product being searched for.

HARD RULES:
- Never invent a link, a phone number, a handle or an address. If it is not in the input, use null.
- Copy URLs verbatim from the input.
- "reason" is ONE line in ENGLISH explaining why this shop might carry the product. Plain language, no marketing copy.
- "sources" is where the info came from: only the literal strings "instagram", "maps" and/or "google". Never a URL.
- Do not promise availability: nobody checked inventory.

Reply with a json object shaped {"shops":[...]}. The word "json" must stay in this prompt: some
providers reject json_object mode unless the messages mention it.`

// ponytail: generateObject, not streamObject — the curated list is delivered to the chat as a
// single tool result, and streamObject's `object` never resolves unless its stream is consumed.
// ponytail: no temperature — reasoning models (gpt-5*) reject anything but the default.
export async function curate(q: string, loc: string, results: RawResult[]): Promise<Shop[]> {
  const { object } = await generateObject({
    model: nearai(MODEL),
    schema: z.object({ shops: z.array(shopSchema) }),
    system: SYSTEM,
    prompt: `Product searched: ${q}\nArea: ${loc || 'unspecified'}\n\nRaw results:\n${JSON.stringify(results)}`,
  })
  return object.shops
}
