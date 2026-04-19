// src/pages/ScoopPage.jsx
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'
import { Footer } from '@/components/layout/Footer'

const CATS = [
  { key: 'all',           label: 'All',           icon: 'fa-layer-group',    color: 'text-slate-400' },
  { key: 'premieres',     label: 'Premieres',     icon: 'fa-calendar-star',  color: 'text-cyan-400' },
  { key: 'renewals',      label: 'Renewals',      icon: 'fa-rotate',         color: 'text-green-400' },
  { key: 'cancellations', label: 'Cancellations', icon: 'fa-ban',            color: 'text-red-400' },
  { key: 'casting',       label: 'Casting',       icon: 'fa-user-plus',      color: 'text-purple-400' },
  { key: 'production',    label: 'Production',    icon: 'fa-clapperboard',   color: 'text-orange-400' },
]

const CAT_COLORS = {
  premieres:     'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  renewals:      'text-green-400 bg-green-500/10 border-green-500/20',
  cancellations: 'text-red-400 bg-red-500/10 border-red-500/20',
  casting:       'text-purple-400 bg-purple-500/10 border-purple-500/20',
  production:    'text-orange-400 bg-orange-500/10 border-orange-500/20',
  general:       'text-slate-400 bg-slate-700/40 border-white/10',
}

export function ScoopPage() {
  const { token, isAuthenticated, isPremium } = useAuth()
  const [stories, setStories]     = useState([])
  const [counts, setCounts]       = useState({})
  const [cat, setCat]             = useState('all')
  const [loading, setLoading]     = useState(true)
  const [lastUpdated, setUpdated] = useState('')

  const loadScoop = useCallback(async () => {
    setLoading(true)
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res  = await fetch(`${API_BASE}/scoop`, { headers })
      const data = await res.json()
      setStories(data.stories ?? data.items ?? [])
      setUpdated(data.updated_at ? new Date(data.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '')
      // build counts
      const c = { all: (data.stories ?? []).length }
      CATS.slice(1).forEach(({ key }) => { c[key] = (data.stories ?? []).filter(s => s.category === key).length })
      setCounts(c)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadScoop() }, [loadScoop])

  const filtered = cat === 'all' ? stories : stories.filter(s => s.category === cat)

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      {isAuthenticated && !isPremium && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-cyan-500/20 px-6 py-2.5">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
            <p className="text-slate-200 text-xs font-bold">
              <span className="text-white">You're on the Free Plan</span>
              <span className="mx-2 text-slate-400">·</span>
              Unlock full Scoop access.
            </p>
            <a href="/upgrade" className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap">
              <i className="fa-solid fa-bolt text-xs"></i> Upgrade
            </a>
          </div>
        </div>
      )}

      <div className="w-full max-w-[1600px] mx-auto px-6 pt-36 pb-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-widest mb-3">
              <i className="fa-solid fa-newspaper animate-pulse"></i> Live Industry Intelligence
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2">The Scoop</h1>
            <p className="text-slate-400 text-sm max-w-xl leading-relaxed">Premiere dates · Renewals · Cancellations · Casting · Production updates — sourced from Variety, Deadline, THR, TVLine and more.</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <div className="w-3 h-3 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin"></div>Scanning feeds...
              </div>
            )}
            {lastUpdated && !loading && <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Updated {lastUpdated}</span>}
            <button onClick={loadScoop} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-slate-200 hover:text-white transition-all disabled:opacity-40">
              <i className="fa-solid fa-rotate-right"></i>Refresh
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-8" style={{ scrollbarWidth: 'none' }}>
          {CATS.map(c => (
            <button key={c.key} onClick={() => setCat(c.key)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                ${cat === c.key ? 'bg-white/8 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              <i className={`fa-solid ${c.icon} ${c.color} text-xs`}></i>
              {c.label}
              <span className="px-1.5 py-0.5 bg-slate-800/60 rounded-lg text-[9px] font-black text-slate-400">
                {counts[c.key] ?? '—'}
              </span>
            </button>
          ))}
        </div>

        {/* Feed */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-slate-800/40 rounded-3xl h-72 border border-white/5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}></div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <i className="fa-solid fa-satellite-dish text-slate-700 text-5xl mb-5"></i>
            <h3 className="text-xl font-black text-white mb-2">No stories found</h3>
            <p className="text-slate-400 text-sm">Try refreshing or check back soon.</p>
            <button onClick={loadScoop} className="mt-6 px-6 py-3 bg-cyan-500 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-cyan-400 transition-all">
              Try Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((story, i) => {
              const catStyle = CAT_COLORS[story.category] ?? CAT_COLORS.general
              return (
                <a key={i} href={story.url} target="_blank" rel="noreferrer"
                  className="group bg-slate-900/60 border border-white/5 rounded-3xl p-6 flex flex-col hover:-translate-y-0.5 hover:border-white/10 transition-all">
                  {story.image && (
                    <div className="rounded-2xl overflow-hidden aspect-video mb-4 bg-slate-800">
                      <img src={story.image} alt={story.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${catStyle}`}>
                      {story.category ?? 'General'}
                    </span>
                    {story.source && <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">{story.source}</span>}
                  </div>
                  <h3 className="text-white font-black text-sm leading-snug mb-2 flex-1 line-clamp-3">{story.title}</h3>
                  {story.summary && <p className="text-slate-400 text-xs leading-relaxed line-clamp-3 mb-3">{story.summary}</p>}
                  {story.published_at && (
                    <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mt-auto">
                      {new Date(story.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </a>
              )
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
