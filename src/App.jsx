import { useState } from 'react'
import { LOCALES, DEFAULT_LOCALE } from '../server/locales.js'

const SOURCES = { instagram: 'IG', maps: 'Maps', google: 'Google', 'google-ig': 'Google' }

function waLink(phone) {
  const digits = phone.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

export default function App() {
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const [locale, setLocale] = useState(DEFAULT_LOCALE)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&loc=${encodeURIComponent(loc)}&locale=${locale}`,
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'search failed')
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <h1>Shoplet</h1>
      <p className="sub">Products in small shops and independent businesses.</p>

      <form onSubmit={submit}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="what you're looking for (soy candles)" />
        <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="city or area (Avellaneda)" />
        <select value={locale} onChange={(e) => setLocale(e.target.value)} aria-label="Country">
          {Object.entries(LOCALES).map(([key, l]) => (
            <option key={key} value={key}>{l.label}</option>
          ))}
        </select>
        <button disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </form>

      {loading && <p className="hint">First search takes 5–10 seconds.</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <p className="meta">
            {data.shops.length} {data.shops.length === 1 ? 'shop' : 'shops'}
            {data.cached && ' · from cache'}
            {!data.curated && ' · uncurated (model failed)'}
          </p>

          <ul className="shops">
            {data.shops.map((s, i) => (
              <li key={i}>
                <h2>{s.name}</h2>
                <p className="reason">{s.reason}</p>
                <p className="details">
                  {[s.category, s.area ?? s.address, s.sells_online && 'sells online'].filter(Boolean).join(' · ')}
                </p>
                <p className="links">
                  {s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer">Instagram</a>}
                  {s.web && <a href={s.web} target="_blank" rel="noreferrer">Web</a>}
                  {s.whatsapp && waLink(s.whatsapp) && (
                    <a href={waLink(s.whatsapp)} target="_blank" rel="noreferrer">WhatsApp</a>
                  )}
                  {s.address && (
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(s.address)}`} target="_blank" rel="noreferrer">
                      Map
                    </a>
                  )}
                  {(s.sources ?? []).map((f) => <span key={f} className="badge">{SOURCES[f] ?? f}</span>)}
                </p>
              </li>
            ))}
          </ul>

          {data.shops.length > 0 && <p className="hint">Nobody verified stock: check with the shop before going.</p>}
        </>
      )}
    </main>
  )
}
