# Shoplet

Find small shops and independent sellers that carry what you're looking for.

Live search (no pre-built index): a query hits SerpApi across Google, Google Maps
and Instagram, an LLM curates the results into a list of shops with contact info,
and the answer is cached for 24h in SQLite.

## Run

```sh
cp .env.example .env   # fill in SERPAPI_KEY and NEAR_AI_API_KEY
npm install
npm run dev            # api on :3001, web on :5173
```

## API

- `POST /api/chat` `{ messages[], loc, locale }` → AI SDK UI message stream (what the web app uses)
- `POST /api/search` `{ query, loc?, locale? }` → `{ query, shops[] }` — the search on its own, for agents that don't want a chat
- `GET /api/locales` → available locales

## MCP

The same search as an MCP tool (`findShops`), over stdio:

```sh
npm run mcp
```

In an MCP client (Claude Code, Cursor, Claude Desktop):

```json
{
  "mcpServers": {
    "shoplet": {
      "command": "node",
      "args": ["--env-file=.env", "/absolute/path/to/shoplet/server/mcp.ts"]
    }
  }
}
```

## Test

```sh
npm test
```
