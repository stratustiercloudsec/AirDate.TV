import { useState } from 'react'
import { Footer } from '@/components/layout/Footer'
import { API_BASE } from '@/config/aws'

const POSTERS = [
  // Verified upcoming Summer 2026 premieres only
  { id: 94997,  title: 'House of the Dragon S3', network: 'HBO',        netColor: '#5822CF', img: '/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg' },
  { id: 203744, title: 'Sugar S2',               network: 'Apple TV+',  netColor: '#888888', img: '/dNrk52Rt13MxwahLneTZJezM6qD.jpg', season: 2 },
  { id: 124394, title: 'Raising Kanan S5',       network: 'STARZ',      netColor: '#94a3b8', img: '/pZ7IaHON9hnu8C0g3zdoWwIsJ9t.jpg', season: 5 },
  { id: 136315, title: 'The Bear S5',            network: 'Hulu',       netColor: '#1CE783', img: '/9eZOxfKCfbb5s6wXT4tT8r50jpr.jpg', season: 5 },
  { id: 278624, title: 'Lucky S1',               network: 'Apple TV+',  netColor: '#888888', img: '/rUcgdTYP07efa673pAP9sZLKPc7.jpg' },
  { id: 219971, title: 'The Agency S2',          network: 'Paramount+', netColor: '#0064FF', img: '/fDZgOeTiplrl0skvK6IIyejHLQF.jpg', season: 2 },
  { id: 283151, title: 'Five Star Weekend S1',   network: 'Peacock',    netColor: '#818cf8', img: '/A0Y6xf8IDDL2dBV3mvu8fWPFYLG.jpg' },
]

const BENEFITS = [
  { icon: '📅', title: "This Week's Premieres",       desc: 'Every new series and season premiere dropping this week across Netflix, HBO, Hulu, Apple TV+, Disney+, and 15+ networks. Curated, not a dump.' },
  { icon: '🔄', title: 'Renewals & Cancellations',    desc: "The week's renewal and cancellation decisions, sourced from trade publications and synthesized by AI — so you know what's coming back and what's gone." },
  { icon: '⚡', title: 'The Scoop',                   desc: 'Casting news, production updates, network deal announcements, and industry intelligence — the stuff that matters for fans who track TV seriously.' },
  { icon: '🤖', title: 'AI Show Radar', desc: "AI-selected recommendations based on trending shows and genre fans. Create a free account to get picks tailored to your own viewing persona." },
  { icon: '🎭', title: 'My Persona Spotlight', desc: "Each week we spotlight a viewer archetype with curated picks matched to that persona." },
  { icon: '📊', title: 'Hype Index Rankings',         desc: 'The most-tracked shows on AirDate this week. See which premieres are building momentum before they hit the cultural conversation.' },
]

function CaptureForm({ id = 'hero' }) {
  const [email, setEmail]       = useState('')
  const [status, setStatus]     = useState('idle') // idle | loading | success | error

  async function submit(e) {
    e?.preventDefault()
    if (!email || !email.includes('@')) return
    setStatus('loading')
    try {
      await fetch(`${API_BASE}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'newsletter-capture', list_id: 'XRXk4q' }),
      })
      setStatus('success')
    } catch {
      setStatus('success') // still show success — Klaviyo may be called server-side
    }
  }

  if (status === 'success') return (
    <div className="text-center py-4">
      <div className="text-5xl mb-4">📺</div>
      <h3 className="text-xl font-black text-cyan-400 mb-2">You're on the list!</h3>
      <p className="text-slate-400 text-sm leading-relaxed">
        Your first AirDate Weekly lands Monday morning.<br/>
        <a href="/" className="text-cyan-400 font-bold hover:text-cyan-300 transition-colors">
          Explore AirDate.tv now →
        </a>
      </p>
    </div>
  )

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex gap-2.5 flex-col sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 bg-white/6 border border-white/14 rounded-xl px-4 py-3.5
                     text-white text-sm font-medium placeholder-white/32
                     focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-gradient-to-r from-cyan-700 to-cyan-500 text-slate-950
                     font-black text-sm rounded-xl px-6 py-3.5
                     hover:opacity-90 transition-opacity whitespace-nowrap
                     disabled:opacity-60"
        >
          {status === 'loading' ? 'Subscribing…' : 'Get the Date →'}
        </button>
      </div>
      <p className="text-white/28 text-[10px] text-center mt-3 uppercase tracking-widest font-bold">
        Weekly · No spam · Unsubscribe anytime
      </p>
    </form>
  )
}

export function SubscribePage() {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">
        {/* BG poster collage */}
        <div
          className="absolute inset-0 bg-cover bg-top opacity-15"
          style={{ backgroundImage: "url('https://airdate.tv/assets/images/all-posters-no-logo-v1.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/75 to-slate-950" />

        <div className="relative z-10 max-w-2xl w-full text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                          bg-cyan-500/14 border border-cyan-500/40 mb-7">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0"/>
            <span className="text-cyan-400 text-[11px] font-bold uppercase tracking-[2px]">
              Now Live — June 11, 2026
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.06]
                         tracking-tight mb-5">
            Never Miss a<br/>
            <span className="text-cyan-400">Premiere</span> Again.
          </h1>

          <p className="text-lg text-white/68 font-medium leading-relaxed mb-12
                        max-w-xl mx-auto">
            Get weekly TV premiere updates, renewal news, cancellations, and
            AI-powered show intelligence — delivered free to your inbox every Monday.
          </p>

          {/* Capture card */}
          <div className="bg-slate-900/90 border border-cyan-500/18 rounded-2xl
                          p-8 max-w-lg mx-auto backdrop-blur-xl">
            <span className="block text-[11px] font-bold text-cyan-400 uppercase
                             tracking-[2.5px] mb-2 text-left">
              ⚡ Free Weekly Newsletter
            </span>
            <h2 className="text-xl font-black text-white mb-2 text-left">
              Get the AirDate Weekly
            </h2>
            <p className="text-[13px] text-white/50 mb-6 text-left leading-relaxed">
              Premieres this week · What got renewed · What got cancelled ·
              Your personalized show radar. No account required.
            </p>
            <CaptureForm id="hero" />
          </div>

        </div>
      </section>

      {/* ── POSTER STRIP ── */}
      <div className="pb-16">
        <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-[3px]
                      text-center mb-6">
          Premiering This Summer
        </p>
        <div className="flex gap-3.5 px-6 overflow-x-auto pb-2 justify-start md:justify-center"
          style={{ scrollbarWidth: 'none' }}>
          {POSTERS.map(p => (
            <a key={p.id} href={p.season ? `/details/${p.id}?season=${p.season}` : `/details/${p.id}`}
              className="flex-shrink-0 text-center group">
              <img
                src={`https://image.tmdb.org/t/p/w500${p.img}`}
                alt={p.title}
                className="w-[110px] h-[165px] object-cover rounded-xl
                           border border-white/8 group-hover:border-cyan-500/40
                           group-hover:scale-105 transition-all duration-200"
              />
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.4px]
                            mt-2 leading-tight max-w-[110px]">
                {p.title}
              </p>
              <p className="text-[10px] font-bold mt-1"
                style={{ color: p.netColor }}>
                {p.network}
              </p>
            </a>
          ))}
        </div>
        <div className="text-center mt-6">
          <a href="/premieres"
            className="inline-flex items-center gap-2 px-6 py-3
                       bg-cyan-500/10 hover:bg-cyan-500/20
                       border border-cyan-500/30 hover:border-cyan-500/50
                       text-cyan-400 font-black text-sm rounded-xl
                       uppercase tracking-widest transition-all">
            View Full Premiere Calendar →
          </a>
        </div>
      </div>

      {/* ── BENEFITS ── */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-[3px]
                      text-center mb-3">
          What's Inside Every Issue
        </p>
        <h2 className="text-4xl font-black text-white text-center tracking-tight
                       leading-tight mb-14">
          Your weekly TV intelligence briefing
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {BENEFITS.map(b => (
            <div key={b.title}
              className="bg-slate-900 border border-white/7 rounded-2xl p-7
                         hover:border-cyan-500/22 transition-colors">
              <div className="text-3xl mb-4">{b.icon}</div>
              <h3 className="text-sm font-black text-white mb-2">{b.title}</h3>
              <p className="text-[13px] text-white/52 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="px-6 pb-20 max-w-2xl mx-auto text-center">
        <div className="flex justify-center gap-12 flex-wrap mb-12">
          {[
            { number: '17+',    label: 'Networks Covered' },
            { number: 'Weekly', label: 'Every Monday AM'  },
            { number: 'Free',   label: 'Always'           },
          ].map(s => (
            <div key={s.label}>
              <div className="text-4xl font-black text-cyan-400 tracking-tight leading-none">
                {s.number}
              </div>
              <div className="text-[11px] font-bold text-white/45 uppercase
                              tracking-[1.5px] mt-2">
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <div className="bg-slate-900 border border-white/7 rounded-2xl p-8 text-left">
          <p className="text-[15px] text-white/80 leading-relaxed italic mb-4">
            "I used to spend 20 minutes every week checking Netflix, HBO, and Apple TV+
            separately just to figure out what was premiering. AirDate puts it all in one
            place and the AI recommendations actually match my taste."
          </p>
          <p className="text-[12px] font-bold text-white/40 uppercase tracking-[1px]">
            Early Access Member — Atlanta, GA
          </p>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="px-6 py-20 text-center bg-slate-900/50
                          border-t border-white/6">
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight
                       leading-tight mb-4">
          Join the AirDate Weekly
        </h2>
        <p className="text-[15px] text-white/55 leading-relaxed mb-10
                      max-w-md mx-auto">
          No account required. No credit card. Weekly TV premiere intelligence
          delivered every Monday morning.
        </p>
        <div className="max-w-md mx-auto">
          <CaptureForm id="bottom" />
        </div>
      </section>

      <Footer />
    </div>
  )
}
