import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { findShops, findShopsInput } from './find-shops.ts'

const HOST = '0.0.0.0'
const PORT = Number(process.env.PORT || 3002)
// Optional: without MCP_TOKEN the /mcp endpoint is public.
const MCP_TOKEN = process.env.MCP_TOKEN

if (!MCP_TOKEN) console.warn('MCP_TOKEN not set: /mcp is unauthenticated')

function createShopletServer(): McpServer {
  const server = new McpServer({ name: 'shoplet', version: '0.1.0' })

  server.registerTool(
    'findShops',
    {
      description: 'Search small shops and independent businesses that may carry a product.',
      inputSchema: findShopsInput.shape,
    },
    async ({ query, loc, locale }) => {
      const result = await findShops(query.trim(), loc.trim(), locale)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  return server
}

// Authentication protects the public binding. Render terminates HTTPS before
// forwarding requests to this process.
const app = createMcpExpressApp({ host: HOST })

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/mcp', (req, res, next) => {
  if (MCP_TOKEN && req.headers.authorization !== `Bearer ${MCP_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
})

app.post('/mcp', async (req, res) => {
  const server = createShopletServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  res.on('close', () => {
    void transport.close()
    void server.close()
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (error) {
    console.error('MCP request failed:', error)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      })
    }
  }
})

app.all('/mcp', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed' },
    id: null,
  })
})

app.listen(PORT, HOST, () => {
  console.log(`Shoplet MCP listening on http://${HOST}:${PORT}/mcp`)
})
