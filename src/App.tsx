import { useRef, useState, useEffect, type FormEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isToolUIPart, type UIMessage } from 'ai'
import { LOCALES } from '../server/locales.ts'
import type { Shop } from '../server/curate.ts'
import { ProfilePanel, useProfile, type Profile } from './profile.tsx'

const SOURCES: Record<string, string> = { instagram: 'IG', maps: 'Maps', google: 'Google', 'google-ig': 'Google' }

function waLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

function Shops({ shops }: { shops: Shop[] }) {
  if (shops.length === 0) return null
  return (
    <ul className="space-y-3">
      {shops.map((s, i) => (
        <li key={i} className="rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="font-medium text-slate-900">{s.name}</h3>
          <p className="text-sm text-slate-600">{s.reason}</p>
          <p className="mt-1 text-xs text-slate-500">
            {[s.category, s.area ?? s.address, s.sells_online && 'sells online'].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {s.instagram && <a className="text-blue-600 hover:underline" href={s.instagram} target="_blank" rel="noreferrer">Instagram</a>}
            {s.web && <a className="text-blue-600 hover:underline" href={s.web} target="_blank" rel="noreferrer">Web</a>}
            {s.whatsapp && waLink(s.whatsapp) && (
              <a className="text-blue-600 hover:underline" href={waLink(s.whatsapp)!} target="_blank" rel="noreferrer">WhatsApp</a>
            )}
            {s.address && (
              <a className="text-blue-600 hover:underline" href={`https://maps.google.com/?q=${encodeURIComponent(s.address)}`} target="_blank" rel="noreferrer">Map</a>
            )}
            {(s.sources ?? []).map((f) => (
              <span key={f} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{SOURCES[f] ?? f}</span>
            ))}
          </p>
        </li>
      ))}
    </ul>
  )
}

function Bubble({ message }: { message: UIMessage }) {
  if (message.role === 'user') {
    const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl bg-slate-900 px-4 py-2 text-white">{text}</p>
      </div>
    )
  }

  return (
    <div className="max-w-[90%] space-y-3">
      {message.parts.map((part, i) => {
        if (part.type === 'text') return <p key={i} className="whitespace-pre-wrap text-slate-800">{part.text}</p>
        if (!isToolUIPart(part) || part.type !== 'tool-findShops') return null
        if (part.state !== 'output-available') {
          const query = (part.input as { query?: string } | undefined)?.query
          return <p key={i} className="text-sm text-slate-500">🔎 Searching{query ? ` “${query}”` : ''}…</p>
        }
        const shops = (part.output as { shops?: Shop[] }).shops ?? []
        return shops.length ? <Shops key={i} shops={shops} /> : null
      })}
    </div>
  )
}

export default function App() {
  const [profile, setProfile] = useProfile()
  const [showProfile, setShowProfile] = useState(false)
  const [input, setInput] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // Read at send time, so changing the profile mid-chat takes effect right away.
      body: () => ({ loc: profile?.loc ?? '', locale: profile?.locale }),
    }),
  })
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  function submit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy || !profile) return
    setInput('')
    sendMessage({ text })
  }

  function save(p: Profile) {
    setProfile(p)
    setShowProfile(false)
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="font-semibold">Shoplet</h1>
          <p className="text-xs text-slate-500">Products in small shops and independent businesses.</p>
        </div>
        <button
          onClick={() => setShowProfile((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {profile ? `📍 ${profile.loc}, ${LOCALES[profile.locale].label}` : 'Set location'}
        </button>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto p-4">
        {(showProfile || !profile) && (
          <ProfilePanel profile={profile} onSave={save} onClose={profile ? () => setShowProfile(false) : undefined} />
        )}

        {profile && messages.length === 0 && (
          <p className="text-sm text-slate-500">Tell me what you want to buy: “quiero comprar cartas pokemon”.</p>
        )}

        {messages.map((m) => <Bubble key={m.id} message={m} />)}

        {status === 'submitted' && <p className="text-sm text-slate-500">Thinking…</p>}
        {error && <p className="rounded-2xl bg-red-50 px-4 py-2 text-red-700">{error.message}</p>}
        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="border-t border-slate-200 bg-white p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={profile ? 'what do you want to buy?' : 'set your location first'}
            disabled={!profile}
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 outline-none focus:border-slate-900 disabled:bg-slate-100"
          />
          <button disabled={busy || !profile || !input.trim()} className="rounded-full bg-slate-900 px-5 py-2 text-white disabled:opacity-40">
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
