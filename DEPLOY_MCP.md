# Deploy Shoplet's MCP server on Render

The repository already contains a stateless Streamable HTTP endpoint at `/mcp`
and a Render Blueprint in `render.yaml`.

## Deploy

1. Push the repository to a Git provider connected to Render.
2. In Render, create a Blueprint and select this repository.
3. Set the secret values requested by the Blueprint:
   - `SERPAPI_KEY`
   - `NEAR_AI_API_KEY`
4. Deploy and check `https://<service>.onrender.com/health` returns `{"ok":true}`.
5. Configure the MCP client with `https://<service>.onrender.com/mcp`.

The endpoint is public by design for marketplace clients. Render terminates HTTPS,
and the persistent disk stores the SQLite cache at `/var/data/cache.db`.

## Local check

```sh
cp .env.example .env
npm install
npm run mcp:http
curl http://localhost:3002/health
```

Before deploying:

```sh
npm test
npm run typecheck
```
