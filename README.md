# Shoplet

Find small shops and independent sellers that carry what you're looking for.

Live search (no pre-built index): a query uses a configurable search provider across
the web, local results and Instagram, then an LLM curates the results into shops with contact info,
and the answer is cached for 24h in SQLite.

## Run

```sh
cp .env.example .env   # select a provider and fill in its key plus NEAR_AI_API_KEY
npm install
npm run dev            # api on :3001, web on :5173
```

## Search providers

Set `SEARCH_PROVIDER` in `.env`:

- `serpapi` (default): Google, Google Maps, and up to five Instagram profile enrichments. Requires `SERPAPI_KEY`.
- `brave`: Brave web and local search. Requires `BRAVE_SEARCH_API_KEY`. Instagram profiles are discovered through web search but are not enriched.
- `playwright`: self-hosted Google and Google Maps browser automation. No API key; install its browser once with `npx playwright install chromium`. Instagram profiles are discovered through Google but are not opened directly.

Playwright is intended for low-volume deployments. Google can return consent pages, rate limits, or CAPTCHAs, and page markup can change. The provider reports those failures rather than attempting to bypass them.

The application caches curated search output. When using Brave, choose a subscription whose terms permit the storage behavior you deploy.

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
