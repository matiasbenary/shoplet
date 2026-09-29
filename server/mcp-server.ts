import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { findShops, findShopsInput } from './find-shops.ts'

export function createShopletServer() {
  const server = new McpServer({ name: 'shoplet', version: '0.1.0' })
  server.registerTool(
    'findShops',
    {
      description: 'Search small shops and independent businesses for a product, including their websites when available.',
      inputSchema: findShopsInput.shape,
    },
    async ({ query, loc, locale }) => ({
      content: [{ type: 'text', text: JSON.stringify(await findShops(query.trim(), loc.trim(), locale), null, 2) }],
    }),
  )
  return server
}
