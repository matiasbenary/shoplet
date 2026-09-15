import OpenAI from 'openai'

// NEAR AI Cloud is OpenAI-compatible: same client, different baseURL.
const client = new OpenAI({
  baseURL: 'https://cloud-api.near.ai/v1',
  apiKey: process.env.NEAR_AI_API_KEY,
})

const MODEL = process.env.NEAR_AI_MODEL || 'deepseek-ai/DeepSeek-V3.1'

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

Reply with JSON only: {"shops":[{"name":str,"category":str|null,"area":str|null,"instagram":str|null,
"whatsapp":str|null,"web":str|null,"address":str|null,"sells_online":bool|null,
"sources":[str],"reason":str}]}`

export async function curate(q, loc, results) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    // ponytail: no temperature — reasoning models (gpt-5*) reject anything but the
    // default, and json_object already pins the shape.
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Product searched: ${q}\nArea: ${loc || 'unspecified'}\n\nRaw results:\n${JSON.stringify(results)}`,
      },
    ],
  })
  const parsed = JSON.parse(completion.choices[0].message.content)
  if (!Array.isArray(parsed.shops)) throw new Error('response has no shops[]')
  return parsed.shops
}
