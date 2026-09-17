import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { findShops, findShopsInput } from './find-shops.ts'

// Same tool as the chat's, over stdio, for any MCP client (Claude Code, Cursor, Desktop).
const server = new McpServer({ name: 'shoplet', version: '0.1.0' })

server.registerTool(
  'findShops',
  {
    description: 'Search small shops and independent businesses that may carry a product.',
    inputSchema: findShopsInput.shape,
  },
  async ({ query, loc, locale }) => {
    const result = await findShops(query.trim(), loc.trim(), locale)
    // ponytail: text content only — structuredContent would need an outputSchema too,
    // and every client reads text. Add it if a client asks for typed output.
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

// stdout is the protocol channel: anything logged there corrupts it.
await server.connect(new StdioServerTransport())
console.error('shoplet mcp ready')
