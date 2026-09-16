import { useEffect, useState } from 'react'
import { LOCALES, DEFAULT_LOCALE, isLocaleKey, type LocaleKey } from '../server/locales.ts'

export interface Profile {
  loc: string
  locale: LocaleKey
}

const KEY = 'shoplet.profile'

// ponytail: localStorage, not an account system. Swap for a real user record if login ever happens.
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      const p = JSON.parse(raw) as Profile
      return isLocaleKey(p.locale) ? p : null
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (profile) localStorage.setItem(KEY, JSON.stringify(profile))
  }, [profile])
  return [profile, setProfile] as const
}

// Keyless reverse geocoding: browser gives coordinates, BigDataCloud gives a city name.
async function locate(): Promise<Profile> {
  const pos = await new Promise<GeolocationPosition>((ok, fail) =>
    navigator.geolocation.getCurrentPosition(ok, fail, { timeout: 10_000 }),
  )
  const { latitude, longitude } = pos.coords
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
  )
  if (!res.ok) throw new Error('could not resolve your location')
  const j = (await res.json()) as { city?: string; locality?: string; countryCode?: string }
  const country = (j.countryCode ?? '').toLowerCase()
  return {
    loc: j.city || j.locality || '',
    locale: isLocaleKey(country) ? country : DEFAULT_LOCALE,
  }
}

export function ProfilePanel({
  profile,
  onSave,
  onClose,
}: {
  profile: Profile | null
  onSave: (p: Profile) => void
  onClose?: () => void
}) {
  const [loc, setLoc] = useState(profile?.loc ?? '')
  const [locale, setLocale] = useState<LocaleKey>(profile?.locale ?? DEFAULT_LOCALE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function autolocate() {
    setBusy(true)
    setError(null)
    try {
      const p = await locate()
      setLoc(p.loc)
      setLocale(p.locale)
    } catch (err) {
      setError((err as Error).message || 'location denied')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (loc.trim()) onSave({ loc: loc.trim(), locale })
      }}
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-slate-900">Your search area</h2>
        {onClose && (
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500">Every search runs here until you change it.</p>

      <div className="flex flex-wrap gap-2">
        <input
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          placeholder="city or area (Avellaneda)"
          className="flex-1 min-w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as LocaleKey)}
          aria-label="Country"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        >
          {Object.entries(LOCALES).map(([key, l]) => (
            <option key={key} value={key}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={autolocate}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? 'Locating…' : '📍 Use my location'}
        </button>
        <button
          disabled={!loc.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Save
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  )
}
