import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createShopletServer } from './mcp-server.ts'

const HOST = '0.0.0.0'
const PORT = Number(process.env.PORT || 3002)

// ponytail: /mcp is public on purpose. Render terminates HTTPS in front.
const app = createMcpExpressApp({ host: HOST })

app.get('/health', (_req, res) => {
  res.json({ ok: true })
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
