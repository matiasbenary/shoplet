# Deploy Shoplet as a remote MCP server on Render

Shoplet currently exposes its MCP tool through `stdio`. That works when the MCP
client and Shoplet run on the same computer, but a remote client needs an HTTPS
endpoint using MCP's **Streamable HTTP** transport.

This guide adds a remote endpoint at:

```text
https://your-domain.example/mcp
```

This guide uses a Render Web Service. It includes both dashboard instructions
and an optional `render.yaml` Blueprint.

## Prerequisites

- A Git repository containing this project
- A Render account connected to the Git provider that hosts the repository
- Node.js 24
- A `NEAR_AI_API_KEY`
- A key for the selected search provider:
  - `SERPAPI_KEY` when `SEARCH_PROVIDER=serpapi`
  - `BRAVE_SEARCH_API_KEY` when `SEARCH_PROVIDER=brave`
- A long, random secret to use as `MCP_TOKEN`

Do not commit `.env` or any API keys. The repository's `.gitignore` already
excludes `.env`.

## 1. Add the HTTP MCP server

Create `server/mcp-http.ts` with the following content:

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { findShops, findShopsInput } from './find-shops.ts'

const HOST = '0.0.0.0'
const PORT = Number(process.env.PORT || 3002)
const MCP_TOKEN = process.env.MCP_TOKEN

if (!MCP_TOKEN) {
  throw new Error('MCP_TOKEN is required')
}

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
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  return server
}

const app = createMcpExpressApp({ host: HOST })

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/mcp', (req, res, next) => {
  if (req.headers.authorization !== `Bearer ${MCP_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
})

app.post('/mcp', async (req, res) => {
  const server = createShopletServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

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
```

This creates a stateless MCP server for each HTTP request. Stateless mode is a
good fit for Shoplet because `findShops` does not need an in-memory conversation
or session.

## 2. Add the start command

Add this script to the `scripts` object in `package.json`:

```json
"mcp:http": "node --env-file=.env server/mcp-http.ts"
```

The complete section will include both transports:

```json
{
  "scripts": {
    "mcp": "node --env-file=.env server/mcp.ts",
    "mcp:http": "node --env-file=.env server/mcp-http.ts"
  }
}
```

Keep the existing `mcp` command. It remains useful for local clients that use
`stdio`.

## 3. Configure and test locally

Add a token to `.env`:

```dotenv
MCP_TOKEN=replace-this-with-a-long-random-secret
```

Start the HTTP server:

```sh
npm run mcp:http
```

Check the health endpoint:

```sh
curl http://localhost:3002/health
```

Expected response:

```json
{"ok":true}
```

Check the MCP initialization handshake:

```sh
curl -i http://localhost:3002/mcp \
  -X POST \
  -H 'Authorization: Bearer replace-this-with-a-long-random-secret' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": { "name": "curl-test", "version": "1.0.0" }
    }
  }'
```

A `200` response containing Shoplet's server information means the transport is
working. An MCP client or MCP Inspector should be used for a complete tool call
test.

Before deploying, run the project checks:

```sh
npm test
npm run typecheck
```

## 4. Push the project

Commit the new server and script, then push them to your Git provider:

```sh
git add server/mcp-http.ts render.yaml package.json .env.example DEPLOY_MCP.md
git commit -m "Add remote MCP transport"
git push
```

Review the staged changes before committing if the working tree contains other
work you do not want in this commit.

## 5. Deploy from the Render dashboard

In the Render dashboard, select **New > Web Service**, connect the repository,
and use these settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Node version | 24 |
| Build command | `npm ci` |
| Start command | `node server/mcp-http.ts` |
| Health check path | `/health` |

The service must be a Web Service, not a Static Site. Choose a paid instance if
you want to attach a persistent disk for the SQLite cache.

Add the following environment variables in the service dashboard:

```text
SEARCH_PROVIDER=serpapi
SERPAPI_KEY=your-serpapi-key
NEAR_AI_API_KEY=your-near-ai-key
MCP_TOKEN=your-long-random-secret
```

`NEAR_AI_MODEL` is optional. If you use Brave instead of SerpApi, set
`SEARCH_PROVIDER=brave` and provide `BRAVE_SEARCH_API_KEY`.

After deployment, verify:

```sh
curl https://your-service.example/health
```

Your remote MCP URL is:

```text
https://your-service.example/mcp
```

Render supplies the `PORT` environment variable automatically. Do not set it in
the dashboard; `server/mcp-http.ts` reads it at startup.

## 6. Optional: deploy with a Render Blueprint

Instead of entering the service settings manually, create `render.yaml` in the
repository root:

```yaml
services:
  - type: web
    name: shoplet-mcp
    runtime: node
    plan: starter
    buildCommand: npm ci
    startCommand: node server/mcp-http.ts
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: 24
      - key: SEARCH_PROVIDER
        value: serpapi
      - key: SERPAPI_KEY
        sync: false
      - key: NEAR_AI_API_KEY
        sync: false
      - key: MCP_TOKEN
        sync: false
      - key: CACHE_DB
        value: /var/data/cache.db
    disk:
      name: shoplet-cache
      mountPath: /var/data
      sizeGB: 1
```

Commit and push `render.yaml`. In Render, select **New > Blueprint**, connect the
repository, and apply the Blueprint. Render will ask for values marked
`sync: false`. Generate the MCP token locally with `openssl rand -hex 32`, enter
that value when Render prompts for `MCP_TOKEN`, and save the same token in your
MCP client.

If you choose Brave, change the provider and secret entries to:

```yaml
      - key: SEARCH_PROVIDER
        value: brave
      - key: BRAVE_SEARCH_API_KEY
        sync: false
```

Remove the `SERPAPI_KEY` entry in that case.

## 7. Preserve the SQLite cache

Shoplet stores cached searches in `cache.db`. Most cloud services use an
ephemeral filesystem, so that file can disappear after a restart or redeploy.

The Blueprint above creates a 1 GB disk automatically. When configuring the
service manually, open its **Disks** settings, attach a disk at `/var/data`, and
add:

```text
CACHE_DB=/var/data/cache.db
```

The server still works without a persistent disk, but it will lose cached
results whenever its instance is replaced.

Do not run multiple replicas against the same SQLite file on a shared network
volume. If the service needs horizontal scaling, replace SQLite with a shared
cache such as Redis or a database service.

## 8. Connect an MCP client

Remote-client configuration varies, but the client needs the endpoint and the
bearer token:

```json
{
  "url": "https://your-service.example/mcp",
  "headers": {
    "Authorization": "Bearer your-long-random-secret"
  }
}
```

The client should discover one tool:

```text
findShops
```

Example arguments:

```json
{
  "query": "ceramic coffee dripper",
  "loc": "Buenos Aires",
  "locale": "ar"
}
```

Supported locale values are `ar`, `mx`, `es`, `us`, `gb`, and `br`.

## Security checklist

- Use HTTPS. Cloud web-service providers normally terminate HTTPS for you.
- Generate a unique, high-entropy `MCP_TOKEN`; do not reuse an API key.
- Store all secrets in the hosting provider's environment-variable manager.
- Do not expose `SERPAPI_KEY`, `BRAVE_SEARCH_API_KEY`, or `NEAR_AI_API_KEY` to
  MCP clients.
- Rotate `MCP_TOKEN` if it is copied into logs, source control, or screenshots.
- Add rate limiting before sharing the endpoint with untrusted users. Every
  uncached tool call can consume search-provider and model credits.
- For a public multi-user integration, replace the single bearer token with a
  proper OAuth-based authorization flow.

## Troubleshooting

### The service exits immediately

Make sure `MCP_TOKEN` is configured. The HTTP server deliberately refuses to
start without it.

### `401 Unauthorized`

Check that the client sends exactly:

```text
Authorization: Bearer YOUR_TOKEN
```

### The host reports that no port is open

The start command must run `server/mcp-http.ts`, not the `stdio` server in
`server/mcp.ts`. The HTTP server reads the platform-assigned `PORT` variable and
binds to `0.0.0.0`.

### Search requests fail

Confirm that `SEARCH_PROVIDER` and its corresponding provider key are set. Also
confirm that `NEAR_AI_API_KEY` is present, because Shoplet uses the model to
curate raw search results.

### Cached results disappear

Attach persistent storage and set `CACHE_DB=/var/data/cache.db`, or accept that
the cache will be temporary.

### Playwright fails in production

The `playwright` provider requires Chromium and additional system packages. For
the simplest deployment, start with `serpapi` or `brave`. If Playwright is
required, deploy with a Docker image that installs the browser dependencies.
