import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createShopletServer } from './mcp-server.ts'

// Same tool as the chat's, over stdio, for any MCP client (Claude Code, Cursor, Desktop).
const server = createShopletServer()

// stdout is the protocol channel: anything logged there corrupts it.
await server.connect(new StdioServerTransport())
console.error('shoplet mcp ready')
