import { streamText, stepCountIs, tool, convertToModelMessages, type UIMessage } from 'ai'
import { z } from 'zod'
import { nearai, MODEL } from './curate.ts'
import { findShops } from './find-shops.ts'
import { LOCALES, type LocaleKey } from './locales.ts'

const SYSTEM = `You are Shoplet, a shopping assistant for small shops and independent businesses.

When the user wants to buy something, call findShops with a short product query in the user's
language (e.g. "cartas pokemon", "velas de soja"). Do not answer from your own knowledge:
the tool is the only source of real shops.

After the tool returns, write ONE short sentence introducing the results. The shops themselves are
rendered by the app, so never list them, never repeat links or addresses. If the tool returns no
shops, say so and suggest other words to try. For anything that is not a shopping request, just
answer normally in the user's language.`

export async function chat(messages: UIMessage[], loc: string, locale: LocaleKey) {
  return streamText({
    model: nearai(MODEL),
    system: `${SYSTEM}\n\nThe user shops in: ${loc || 'unspecified'} (${LOCALES[locale].label}).`,
    messages: await convertToModelMessages(messages),
    // One search, then the wrap-up sentence. More steps only buys repeated SerpApi bills.
    stopWhen: stepCountIs(3),
    tools: {
      findShops: tool({
        description: 'Search small shops and independent businesses that may carry a product.',
        inputSchema: z.object({
          query: z.string().describe("the product to look for, in the user's language"),
        }),
        execute: ({ query }) => findShops(query, loc, locale),
      }),
    },
  })
}
