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

- `GET /api/search?q=<query>&loc=<city>&locale=<locale>` → `{ q, loc, locale, shops[], curated, cached }`
- `GET /api/locales` → available locales

## Test

```sh
npm test
```
